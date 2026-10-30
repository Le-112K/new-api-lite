package model

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// pricingJSONFields 列出 Pricing 结构体真正会参与序列化的 JSON 键。
// 这里刻意不看序列化后的取值：omitempty 会让零值字段整���消失，
// 只比对序列化结果会漏掉「加回来一个默认值字段」这种回归。
func pricingJSONFields() map[string]bool {
	typ := reflect.TypeOf(Pricing{})
	fields := make(map[string]bool, typ.NumField())
	for i := 0; i < typ.NumField(); i++ {
		name := strings.Split(typ.Field(i).Tag.Get("json"), ",")[0]
		if name == "" || name == "-" {
			continue
		}
		fields[name] = true
	}
	return fields
}

// 站点改为按次计费后，公开价格接口只下发「单次价格」。
// 这条断言锁住前后端契约：前端不再消费 quota_type / model_ratio 等倍率字段。
func TestPricingJSONOnlyCarriesPerCallPrice(t *testing.T) {
	fields := pricingJSONFields()

	assert.True(t, fields["model_price"], "公开价格必须带单次价格")
	for _, removed := range []string{
		"quota_type",
		"model_ratio",
		"completion_ratio",
		"cache_ratio",
		"create_cache_ratio",
		"image_ratio",
		"audio_ratio",
		"audio_completion_ratio",
	} {
		assert.False(t, fields[removed], "字段 %s 不应再出现在公开价格响应里", removed)
	}
	// PriceConfigured 只用于内部过滤，未配置的模型不该出现在公开价格页。
	assert.False(t, fields["PriceConfigured"])
}

// 单次价格本身仍要按原样下发，不能被换算或截断。
func TestPricingJSONCarriesConfiguredPerCallPrice(t *testing.T) {
	encoded, err := json.Marshal(Pricing{
		ModelName:   "deepseek-v4-pro-ga-260813",
		ModelPrice:  0.0128,
		EnableGroup: []string{"default"},
	})
	require.NoError(t, err)

	var payload map[string]any
	require.NoError(t, json.Unmarshal(encoded, &payload))
	assert.Equal(t, 0.0128, payload["model_price"])
	assert.Equal(t, "deepseek-v4-pro-ga-260813", payload["model_name"])
}
