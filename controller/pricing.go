package controller

import (
	"maps"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func filterPricingByUsableGroups(pricing []model.Pricing, usableGroup map[string]string) []model.Pricing {
	if len(pricing) == 0 {
		return pricing
	}
	if len(usableGroup) == 0 {
		return []model.Pricing{}
	}

	filtered := make([]model.Pricing, 0, len(pricing))
	for _, item := range pricing {
		if common.StringsContains(item.EnableGroup, "all") {
			filtered = append(filtered, item)
			continue
		}
		for _, group := range item.EnableGroup {
			if _, ok := usableGroup[group]; ok {
				filtered = append(filtered, item)
				break
			}
		}
	}
	return filtered
}

// filterPricingByConfiguredPrice 剔除未配置计费规则的模型。
//
// 这类模型在 /v1/models 中本来就不会出现，调用也会被计费校验拒绝，因此不应该
// 出现在价格页上——否则等于对用户展示一个买不到的价格（历史上会显示成自用模式
// 遗留的 37.5 倍兜底值）。
func filterPricingByConfiguredPrice(pricing []model.Pricing) []model.Pricing {
	if len(pricing) == 0 {
		return pricing
	}

	filtered := make([]model.Pricing, 0, len(pricing))
	for _, item := range pricing {
		if item.PriceConfigured {
			filtered = append(filtered, item)
		}
	}
	return filtered
}

// Public subscription plan summary carried on the pricing payload so the
// anonymous model square can group models by subscription tier. Only
// marketing fields are exposed; purchase limits and quota internals stay on
// the authenticated subscription APIs.
type publicSubscriptionPlan struct {
	Title         string  `json:"title"`
	Subtitle      string  `json:"subtitle,omitempty"`
	PriceAmount   float64 `json:"price_amount"`
	Currency      string  `json:"currency"`
	DurationUnit  string  `json:"duration_unit"`
	DurationValue int     `json:"duration_value"`
	UpgradeGroup  string  `json:"upgrade_group,omitempty"`
}

func getPublicSubscriptionPlans() []publicSubscriptionPlan {
	if !operation_setting.IsPaymentComplianceConfirmed() {
		return []publicSubscriptionPlan{}
	}
	var plans []model.SubscriptionPlan
	if err := model.DB.Where("enabled = ?", true).Order("sort_order desc, id desc").Find(&plans).Error; err != nil {
		return []publicSubscriptionPlan{}
	}
	result := make([]publicSubscriptionPlan, 0, len(plans))
	for _, p := range plans {
		result = append(result, publicSubscriptionPlan{
			Title:         p.Title,
			Subtitle:      p.Subtitle,
			PriceAmount:   p.PriceAmount,
			Currency:      p.Currency,
			DurationUnit:  p.DurationUnit,
			DurationValue: p.DurationValue,
			UpgradeGroup:  p.UpgradeGroup,
		})
	}
	return result
}

func GetPricing(c *gin.Context) {
	pricing := model.GetPricing()
	userId, exists := c.Get("id")
	usableGroup := map[string]string{}
	groupRatio := map[string]float64{}
	maps.Copy(groupRatio, ratio_setting.GetGroupRatioCopy())
	var group string
	if exists {
		user, err := model.GetUserCache(userId.(int))
		if err == nil {
			group = user.Group
			for g := range groupRatio {
				ratio, ok := ratio_setting.GetGroupGroupRatio(group, g)
				if ok {
					groupRatio[g] = ratio
				}
			}
		}
	}

	usableGroup = service.GetUserUsableGroups(group)
	pricing = filterPricingByConfiguredPrice(pricing)
	pricing = filterPricingByUsableGroups(pricing, usableGroup)
	// check groupRatio contains usableGroup
	for group := range ratio_setting.GetGroupRatioCopy() {
		if _, ok := usableGroup[group]; !ok {
			delete(groupRatio, group)
		}
	}

	c.JSON(200, gin.H{
		"success":            true,
		"data":               pricing,
		"vendors":            model.GetVendors(),
		"group_ratio":        groupRatio,
		"usable_group":       usableGroup,
		"supported_endpoint": model.GetSupportedEndpointMap(),
		"auto_groups":        service.GetUserAutoGroup(group),
		"subscription_plans": getPublicSubscriptionPlans(),
	})
}

func ResetModelRatio(c *gin.Context) {
	defaultStr := ratio_setting.DefaultModelRatio2JSONString()
	err := model.UpdateOption("ModelRatio", defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	err = ratio_setting.UpdateModelRatioByJSONString(defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "重置模型倍率成功",
	})
}
