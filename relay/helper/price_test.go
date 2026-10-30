package helper

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestModelPriceHelperRequestBillingRatiosOnlyApplyToFixedPrice(t *testing.T) {
	gin.SetMode(gin.TestMode)
	savedModelPrices := ratio_setting.ModelPrice2JSONString()
	savedModelRatios := ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedModelPrices))
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedModelRatios))
	})

	modelPrices, err := common.Marshal(map[string]float64{
		"fixed-image-price":      0.04,
		"fractional-image-price": 0.0000012,
		"overflow-image-price":   float64(common.MaxQuota) / common.QuotaPerUnit / 2,
	})
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(string(modelPrices)))

	tests := []struct {
		name           string
		model          string
		wantQuota      int
		wantImageCount bool
	}{
		{
			name:           "fixed price applies image count",
			model:          "fixed-image-price",
			wantQuota:      180000,
			wantImageCount: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Set("group", "default")
			info := &relaycommon.RelayInfo{
				OriginModelName: tt.model,
				UserGroup:       "default",
				UsingGroup:      "default",
			}
			meta := &types.TokenCountMeta{
				ImagePriceRatio: 3,
				BillingRatios:   map[string]float64{"n": 3},
			}

			priceData, err := ModelPriceHelper(ctx, info, 1000, meta)

			require.NoError(t, err)
			require.Equal(t, tt.wantQuota, priceData.QuotaToPreConsume)
			require.Equal(t, tt.wantImageCount, priceData.HasOtherRatio("n"))
			require.Equal(t, priceData.OtherRatios(), info.PriceData.OtherRatios())
		})
	}

	newInfo := func(model string) (*gin.Context, *relaycommon.RelayInfo) {
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		ctx.Set("group", "default")
		return ctx, &relaycommon.RelayInfo{
			OriginModelName: model,
			UserGroup:       "default",
			UsingGroup:      "default",
		}
	}
	meta := &types.TokenCountMeta{BillingRatios: map[string]float64{"n": 3}}

	ctx, info := newInfo("fractional-image-price")
	priceData, err := ModelPriceHelper(ctx, info, 0, meta)
	require.NoError(t, err)
	// 0.0000012 * 500000 * 3 = 1.8, then truncate once to 1.
	require.Equal(t, 1, priceData.QuotaToPreConsume)

	ctx, info = newInfo("overflow-image-price")
	_, err = ModelPriceHelper(ctx, info, 0, meta)
	var clamp *common.QuotaClamp
	require.ErrorAs(t, err, &clamp)
	require.Equal(t, "QuotaFromFloat", clamp.Op)
	require.Equal(t, common.QuotaClampOverflow, clamp.Kind)
	require.Nil(t, info.Billing)
}

// Pricing identity is resolved once in ModelPriceHelper via the candidate
// ladder: raw name (only when it has no @ modifiers) → canonical
// base@effort:E@thinking:S → base@thinking:S → base. Each level is looked up
// after FormatMatchingModelName wildcard normalization. A hit on the raw
// gemini-2.5-flash-thinking-* wildcard must keep the client origin as the
// consume-log name.
func TestModelPriceHelperUsesSuffixedOriginLikeMain(t *testing.T) {
	gin.SetMode(gin.TestMode)

	savedPrices := ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedPrices))
	})
	prices := ratio_setting.GetModelPriceMap()
	prices["gemini-2.5-flash"] = 0.15
	prices["gemini-2.5-flash-thinking-*"] = 0.075
	priceJSON, err := common.Marshal(prices)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(string(priceJSON)))


	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("group", "default")

	suffixed := &relaycommon.RelayInfo{
		OriginModelName: "gemini-2.5-flash-thinking-8192",
		UserGroup:       "default",
		UsingGroup:      "default",
	}
	suffixedPrice, err := ModelPriceHelper(ctx, suffixed, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.Empty(t, suffixed.BillingModelName)
	assert.Equal(t, "gemini-2.5-flash-thinking-8192", suffixed.GetBillingModelName())
	assert.Equal(t, 0.075, suffixedPrice.ModelPrice)

	geminiSettings := model_setting.GetGeminiSettings()
	oldThinking := geminiSettings.ThinkingAdapterEnabled
	geminiSettings.ThinkingAdapterEnabled = true
	t.Cleanup(func() { geminiSettings.ThinkingAdapterEnabled = oldThinking })

	adapterOn := &relaycommon.RelayInfo{
		OriginModelName: "gemini-2.5-flash-thinking-8192",
		UserGroup:       "default",
		UsingGroup:      "default",
	}
	adapterOnPrice, err := ModelPriceHelper(ctx, adapterOn, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.Empty(t, adapterOn.BillingModelName)
	assert.Equal(t, "gemini-2.5-flash-thinking-8192", adapterOn.GetBillingModelName())
	assert.Equal(t, 0.075, adapterOnPrice.ModelPrice)

	base := &relaycommon.RelayInfo{
		OriginModelName: "gemini-2.5-flash",
		UserGroup:       "default",
		UsingGroup:      "default",
	}
	basePrice, err := ModelPriceHelper(ctx, base, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.Empty(t, base.BillingModelName)
	assert.Equal(t, "gemini-2.5-flash", base.GetBillingModelName())
	assert.Equal(t, 0.15, basePrice.ModelPrice)
}

func TestModelPriceHelperHonorsCustomClaudeThinkingAlias(t *testing.T) {
	gin.SetMode(gin.TestMode)

	savedPrices := ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedPrices))
	})
	prices := ratio_setting.GetModelPriceMap()
	prices["claude-3-7-sonnet"] = 1.5
	prices["claude-3-7-sonnet-thinking"] = 3.0
	priceJSON, err := common.Marshal(prices)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(string(priceJSON)))


	claudeSettings := model_setting.GetClaudeSettings()
	oldThinking := claudeSettings.ThinkingAdapterEnabled
	claudeSettings.ThinkingAdapterEnabled = true
	t.Cleanup(func() { claudeSettings.ThinkingAdapterEnabled = oldThinking })

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("group", "default")
	info := &relaycommon.RelayInfo{
		OriginModelName: "claude-3-7-sonnet-thinking",
		UserGroup:       "default",
		UsingGroup:      "default",
	}
	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.Empty(t, info.BillingModelName)
	assert.Equal(t, "claude-3-7-sonnet-thinking", info.GetBillingModelName())
	assert.Equal(t, 3.0, priceData.ModelPrice)
}

func TestModelPriceHelperCanonicalBillingLadder(t *testing.T) {
	gin.SetMode(gin.TestMode)

	savedPrices := ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedPrices))
	})

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("group", "default")

	t.Run("level2 full form", func(t *testing.T) {
		prices := ratio_setting.GetModelPriceMap()
		delete(prices, "qwen3-max")
		prices["qwen3-max@effort:high@thinking:on"] = 4.0
		prices["qwen3-max@thinking:on"] = 3.0
		priceJSON, err := common.Marshal(prices)
		require.NoError(t, err)
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(string(priceJSON)))

		info := &relaycommon.RelayInfo{
			OriginModelName: "qwen3-max@thinking:on@effort:high@temperature:0.2",
			UserGroup:       "default",
			UsingGroup:      "default",
		}
		priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
		require.NoError(t, err)
		assert.Equal(t, "qwen3-max@effort:high@thinking:on", info.BillingModelName)
		assert.Equal(t, 4.0, priceData.ModelPrice)
	})

	t.Run("level3 thinking form shuffled budget", func(t *testing.T) {
		prices := ratio_setting.GetModelPriceMap()
		delete(prices, "qwen3-max")
		delete(prices, "qwen3-max@effort:high@thinking:on")
		prices["qwen3-max@thinking:on"] = 3.0
		priceJSON, err := common.Marshal(prices)
		require.NoError(t, err)
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(string(priceJSON)))

		info := &relaycommon.RelayInfo{
			OriginModelName: "qwen3-max@temperature:0.3@thinking:8192",
			UserGroup:       "default",
			UsingGroup:      "default",
		}
		priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
		require.NoError(t, err)
		assert.Equal(t, "qwen3-max@thinking:on", info.BillingModelName)
		assert.Equal(t, 3.0, priceData.ModelPrice)
	})

	t.Run("level4 base fallback", func(t *testing.T) {
		prices := ratio_setting.GetModelPriceMap()
		delete(prices, "qwen3-max@thinking:on")
		delete(prices, "qwen3-max@effort:high@thinking:on")
		prices["qwen3-max"] = 1.25
		priceJSON, err := common.Marshal(prices)
		require.NoError(t, err)
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(string(priceJSON)))

		info := &relaycommon.RelayInfo{
			OriginModelName: "qwen3-max@thinking:off",
			UserGroup:       "default",
			UsingGroup:      "default",
		}
		priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
		require.NoError(t, err)
		assert.Equal(t, "qwen3-max", info.BillingModelName)
		assert.Equal(t, 1.25, priceData.ModelPrice)
	})

	t.Run("thinking minus one bills as on", func(t *testing.T) {
		prices := ratio_setting.GetModelPriceMap()
		prices["qwen3-max@thinking:on"] = 3.0
		priceJSON, err := common.Marshal(prices)
		require.NoError(t, err)
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(string(priceJSON)))

		info := &relaycommon.RelayInfo{
			OriginModelName: "qwen3-max@thinking:-1",
			UserGroup:       "default",
			UsingGroup:      "default",
		}
		priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
		require.NoError(t, err)
		assert.Equal(t, "qwen3-max@thinking:on", info.BillingModelName)
		assert.Equal(t, 3.0, priceData.ModelPrice)
	})
}

func TestModelPriceHelperMigratesLegacyGeminiWildcardToCanonical(t *testing.T) {
	gin.SetMode(gin.TestMode)

	savedPrices := ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedPrices))
	})
	prices := ratio_setting.GetModelPriceMap()
	delete(prices, "gemini-2.5-flash-thinking-*")
	prices["gemini-2.5-flash"] = 0.15
	prices["gemini-2.5-flash@thinking:on"] = 0.09
	priceJSON, err := common.Marshal(prices)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(string(priceJSON)))


	geminiSettings := model_setting.GetGeminiSettings()
	oldThinking := geminiSettings.ThinkingAdapterEnabled
	geminiSettings.ThinkingAdapterEnabled = true
	t.Cleanup(func() { geminiSettings.ThinkingAdapterEnabled = oldThinking })

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("group", "default")
	info := &relaycommon.RelayInfo{
		OriginModelName: "gemini-2.5-flash-thinking-8192",
		UserGroup:       "default",
		UsingGroup:      "default",
	}
	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.Equal(t, "gemini-2.5-flash@thinking:on", info.BillingModelName)
	assert.Equal(t, 0.09, priceData.ModelPrice)
}

func TestModelPriceHelperModifierNameFallsBackToBase(t *testing.T) {
	gin.SetMode(gin.TestMode)

	savedPrices := ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedPrices))
	})
	prices := ratio_setting.GetModelPriceMap()
	prices["qwen3.8-max"] = 2.0
	priceJSON, err := common.Marshal(prices)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(string(priceJSON)))


	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("group", "default")
	info := &relaycommon.RelayInfo{
		OriginModelName: "qwen3.8-max@thinking:on@temperature:0.2",
		UserGroup:       "default",
		UsingGroup:      "default",
	}
	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.Equal(t, "qwen3.8-max", info.BillingModelName)
	assert.Equal(t, 2.0, priceData.ModelPrice)
}

func TestModelPriceHelperExemptAtNameBillsVerbatim(t *testing.T) {
	gin.SetMode(gin.TestMode)

	settings := model_setting.GetGlobalSettings()
	originalBlacklist := append([]string(nil), settings.ThinkingModelBlacklist...)
	t.Cleanup(func() { settings.ThinkingModelBlacklist = originalBlacklist })
	settings.ThinkingModelBlacklist = append(originalBlacklist, "re:.*@sha256:.*")

	savedPrices := ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedPrices))
	})
	prices := ratio_setting.GetModelPriceMap()
	prices["opaque"] = 1.0
	prices["opaque@sha256:deadbeef"] = 7.0
	priceJSON, err := common.Marshal(prices)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(string(priceJSON)))


	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("group", "default")
	info := &relaycommon.RelayInfo{
		OriginModelName: "opaque@sha256:deadbeef",
		UserGroup:       "default",
		UsingGroup:      "default",
	}
	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.Empty(t, info.BillingModelName)
	assert.Equal(t, "opaque@sha256:deadbeef", info.GetBillingModelName())
	assert.Equal(t, 7.0, priceData.ModelPrice)
}

func TestModelPriceHelperPreservesGpt51CodexMaxIdentity(t *testing.T) {
	gin.SetMode(gin.TestMode)

	savedPrices := ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedPrices))
	})
	prices := ratio_setting.GetModelPriceMap()
	prices["gpt-5.1-codex-max"] = 1.75
	prices["gpt-5.1-codex"] = 9.9
	priceJSON, err := common.Marshal(prices)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(string(priceJSON)))


	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("group", "default")
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-5.1-codex-max",
		UserGroup:       "default",
		UsingGroup:      "default",
	}
	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.Empty(t, info.BillingModelName)
	assert.Equal(t, "gpt-5.1-codex-max", info.GetBillingModelName())
	assert.Equal(t, 1.75, priceData.ModelPrice)
}

func TestModelPriceHelperNativeGeminiNoThinkingDoesNotAliasBillingModel(t *testing.T) {
	gin.SetMode(gin.TestMode)

	savedPrices := ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedPrices))
	})
	prices := ratio_setting.GetModelPriceMap()
	prices["gemini-3-pro"] = 1.25
	priceJSON, err := common.Marshal(prices)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(string(priceJSON)))


	geminiSettings := model_setting.GetGeminiSettings()
	oldThinking := geminiSettings.ThinkingAdapterEnabled
	geminiSettings.ThinkingAdapterEnabled = true
	t.Cleanup(func() { geminiSettings.ThinkingAdapterEnabled = oldThinking })

	budget := 0
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("group", "default")
	info := &relaycommon.RelayInfo{
		OriginModelName: "gemini-3-pro",
		UserGroup:       "default",
		UsingGroup:      "default",
		Request: &dto.GeminiChatRequest{
			GenerationConfig: dto.GeminiChatGenerationConfig{
				ThinkingConfig: &dto.GeminiThinkingConfig{
					ThinkingBudget: &budget,
				},
			},
		},
	}

	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.Empty(t, info.BillingModelName)
	assert.Equal(t, "gemini-3-pro", info.GetBillingModelName())
	assert.Equal(t, 1.25, priceData.ModelPrice)
	assert.NotEqual(t, 37.5, priceData.ModelPrice)
}
