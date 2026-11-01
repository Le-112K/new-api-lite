package service

import (
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/model"
)

// 订阅档位，从低到高。分组名即定价分组表里的分组名。
//
// 访问控制是「向下兼容」的：低档位的模型对所有更高档位开放，
// 高档位的专属模型只有该档位及更高档位可用。
const (
	SubscriptionTierFree = "free"
	SubscriptionTierVip  = "vip"
	SubscriptionTierSvip = "svip"
)

var subscriptionTiers = []string{
	SubscriptionTierFree,
	SubscriptionTierVip,
	SubscriptionTierSvip,
}

// subscriptionTierAliases 让历史分组名也能落到对应档位。
// `default` 是 new-api 的出厂默认分组名，迁移期仍按免费档处理，
// 避免存量用户被判定成「非订阅分组」而直接失去全部权限。
var subscriptionTierAliases = map[string]string{
	"default": SubscriptionTierFree,
}

// NormalizeSubscriptionTier 把分组名归一化为档位名；非档位分组返回空串。
func NormalizeSubscriptionTier(group string) string {
	trimmed := strings.TrimSpace(group)
	if trimmed == "" {
		return ""
	}
	if slices.Contains(subscriptionTiers, trimmed) {
		return trimmed
	}
	return subscriptionTierAliases[trimmed]
}

// SubscriptionTierIndex 返回档位在序列中的下标；非档位分组返回 -1。
func SubscriptionTierIndex(group string) int {
	tier := NormalizeSubscriptionTier(group)
	if tier == "" {
		return -1
	}
	return slices.Index(subscriptionTiers, tier)
}

// SubscriptionTierGroups 返回该档位可访问的全部分组（含所有更低档位）。
// 用于「模型列表按档位取并集」与「模型最低档位」两类判断。
func SubscriptionTierGroups(group string) []string {
	index := SubscriptionTierIndex(group)
	if index < 0 {
		return nil
	}
	return subscriptionTiers[:index+1]
}

// SubscriptionTierList 返回档位序列副本（低 → 高），供批量标注按下标取值。
func SubscriptionTierList() []string {
	return subscriptionTiers
}

// SubscriptionTierDisplayName 返回档位的中文展示名，用于错误提示。
func SubscriptionTierDisplayName(group string) string {
	switch NormalizeSubscriptionTier(group) {
	case SubscriptionTierFree:
		return "免费"
	case SubscriptionTierVip:
		return "VIP"
	case SubscriptionTierSvip:
		return "SVIP"
	default:
		return group
	}
}

// RequiredTierForModel 返回调用该模型所需的最低订阅档位。
//
// 取值来自 abilities：模型在所有已启用分组中出现的最低档位。
// 例如 DeepSeek 同时挂在 free 与 vip 下，最低档就是 free（免费模型）；
// GPT 只挂在 svip 下，最低档就是 svip（SVIP 专属）。
//
// 第二个返回值为 false 表示该模型没有挂在任何档位分组下——
// 可能是渠道配置缺失，也可能是挂了非档位分组，此时不据此判定权限。
func RequiredTierForModel(modelName string) (string, bool) {
	if strings.TrimSpace(modelName) == "" {
		return "", false
	}
	groups := model.GetEnabledModelGroups(modelName)
	lowest := -1
	for _, group := range groups {
		index := SubscriptionTierIndex(group)
		if index >= 0 && (lowest < 0 || index < lowest) {
			lowest = index
		}
	}
	if lowest < 0 {
		return "", false
	}
	return subscriptionTiers[lowest], true
}

// CanTierAccessModel 判断某档位能否调用某模型。
// 模型没有挂在任何档位分组时返回 true —— 这种情况交给渠道选择去报
// 「无可用渠道」，而不是误判成越权。
func CanTierAccessModel(tier, modelName string) bool {
	required, ok := RequiredTierForModel(modelName)
	if !ok {
		return true
	}
	requiredIndex := SubscriptionTierIndex(required)
	userIndex := SubscriptionTierIndex(tier)
	if userIndex < 0 {
		return false
	}
	return userIndex >= requiredIndex
}
