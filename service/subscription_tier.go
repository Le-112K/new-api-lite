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

// SubscriptionTierList 返回档位序列副本（低 → 高），供批量标注按下标取值。
func SubscriptionTierList() []string {
	return subscriptionTiers
}

// SubscriptionTierDisplayName 返回档位的展示名，用于错误提示。
// 刻意只用英文/大写：错误文案本身走 i18n，档位名保持中性才不会出现
// 中文环境之外的混排（"Free" 对中文用户同样可读）。
func SubscriptionTierDisplayName(group string) string {
	switch NormalizeSubscriptionTier(group) {
	case SubscriptionTierFree:
		return "Free"
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

// DeniedTierForCall 判断一次调用是否因订阅档位不足而应被拒绝。
// 返回的档位是「调用该模型所需的最低档位」，供错误提示使用。
//
// 两种情形不作为档位问题处理，交由渠道选择给出「无可用渠道」：
//   - 用户所在分组不是订阅档位（如管理员自建的 enterprise 分组）
//   - 模型没有挂在任何档位分组下（配置缺失）
//
// 这里的 userIndex < 0 判断是必须的：SubscriptionTierIndex 对非档位分组
// 返回 -1，若不排除，任何档位都会「大于 -1」，自定义分组用户会收到
// 荒谬的档位不足提示。
func DeniedTierForCall(userGroup, modelName string) (string, bool) {
	userIndex := SubscriptionTierIndex(userGroup)
	if userIndex < 0 {
		return "", false
	}
	requiredTier, ok := RequiredTierForModel(modelName)
	if !ok {
		return "", false
	}
	if SubscriptionTierIndex(requiredTier) <= userIndex {
		return "", false
	}
	return requiredTier, true
}
