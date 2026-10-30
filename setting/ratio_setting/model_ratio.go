package ratio_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	hostreasoning "github.com/QuantumNous/new-api/setting/reasoning"
	"github.com/QuantumNous/new-api/types"
)

// 站点只按调用次数计费：这一层只保留"模型 → 单次价格（美元）"。
// 按量计费所需的输入/输出/缓存/图像/音频倍率已随 token 计费一并移除。

var defaultModelPrice = map[string]float64{
	"suno_music":                     0.1,
	"suno_lyrics":                    0.01,
	"dall-e-3":                       0.04,
	"imagen-3.0-generate-002":        0.03,
	"black-forest-labs/flux-1.1-pro": 0.04,
	"gpt-4-gizmo-*":                  0.1,
	"sora-2":                         0.3,
	"sora-2-pro":                     0.5,
	"gpt-4o-mini-tts":                0.3,
	"veo-3.0-generate-001":           0.4,
	"veo-3.0-fast-generate-001":      0.15,
	"veo-3.1-generate-preview":       0.4,
	"veo-3.1-fast-generate-preview":  0.15,
}

var modelPriceMap = types.NewRWMap[string, float64]()

// InitRatioSettings initializes the per-call price map.
func InitRatioSettings() {
	modelPriceMap.AddAll(defaultModelPrice)
}

func GetModelPriceMap() map[string]float64 {
	return modelPriceMap.ReadAll()
}

func ModelPrice2JSONString() string {
	return modelPriceMap.MarshalJSONString()
}

func UpdateModelPriceByJSONString(jsonStr string) error {
	return types.LoadFromJsonStringWithCallback(modelPriceMap, jsonStr, nil)
}

// GetModelPrice 返回模型单次调用价格（美元）。未配置时返回 -1, false。
func GetModelPrice(name string, printErr bool) (float64, bool) {
	name = FormatMatchingModelName(name)

	if price, ok := modelPriceMap.Get(name); ok {
		return price, true
	}

	if printErr {
		common.SysError("model price not found: " + name)
	}
	return -1, false
}

func GetDefaultModelPriceMap() map[string]float64 {
	return defaultModelPrice
}

// GetDefaultPricingMaps returns an independent copy of the built-in default
// price table, used by the pricing reset/first-write paths.
func GetDefaultPricingMaps() map[string]map[string]float64 {
	prices := make(map[string]float64, len(defaultModelPrice))
	for name, value := range defaultModelPrice {
		prices[name] = value
	}
	return map[string]map[string]float64{"ModelPrice": prices}
}

// 处理带有思考预算的模型名称，方便统一定价
func handleThinkingBudgetModel(name, prefix, wildcard string) string {
	if strings.HasPrefix(name, prefix) && strings.Contains(name, "-thinking-") {
		return wildcard
	}
	return name
}

// RoutingMatchModelName 归一化用于渠道匹配的模型名。
func RoutingMatchModelName(name string) string {
	return FormatMatchingModelName(hostreasoning.BaseModelName(name))
}

// 转换模型名，减少渠道必须配置各种带参数模型
func FormatMatchingModelName(name string) string {
	if strings.HasPrefix(name, "gemini-2.5-flash-lite") {
		name = handleThinkingBudgetModel(name, "gemini-2.5-flash-lite", "gemini-2.5-flash-lite-thinking-*")
	} else if strings.HasPrefix(name, "gemini-2.5-flash") {
		name = handleThinkingBudgetModel(name, "gemini-2.5-flash", "gemini-2.5-flash-thinking-*")
	} else if strings.HasPrefix(name, "gemini-2.5-pro") {
		name = handleThinkingBudgetModel(name, "gemini-2.5-pro", "gemini-2.5-pro-thinking-*")
	}

	if strings.HasPrefix(name, "gpt-4-gizmo") {
		name = "gpt-4-gizmo-*"
	}
	if strings.HasPrefix(name, "gpt-4o-gizmo") {
		name = "gpt-4o-gizmo-*"
	}
	return name
}
