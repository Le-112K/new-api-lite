package service

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	hosttypes "github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newPerCallRelayInfo(price, groupRatio float64) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		OriginModelName: "deepseek-v4-1-flash-260910",
		StartTime:       time.Now(),
		PriceData: hosttypes.PriceData{
			ModelPrice:     price,
			GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: groupRatio},
		},
	}
}

func withQuotaPerUnit(t *testing.T, unit float64) {
	t.Helper()
	old := common.QuotaPerUnit
	common.QuotaPerUnit = unit
	t.Cleanup(func() { common.QuotaPerUnit = old })
}

// 站点只按调用次数计费：同样的单次价，无论输入输出是多少 token，
// 结算额度必须完全一致。
func TestPerCallQuotaIgnoresTokenUsage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withQuotaPerUnit(t, 500_000)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

	small := calculateTextQuotaSummary(ctx, newPerCallRelayInfo(0.0032, 1), &dto.Usage{
		PromptTokens: 10, CompletionTokens: 1, TotalTokens: 11,
	})
	large := calculateTextQuotaSummary(ctx, newPerCallRelayInfo(0.0032, 1), &dto.Usage{
		PromptTokens: 200_000, CompletionTokens: 20_000, TotalTokens: 220_000,
	})

	require.Equal(t, 1600, small.Quota)
	require.Equal(t, 1600, large.Quota)
}

// 上游没有返回 usage 时也必须照单次价收费，否则会出现"拿到内容却不扣费"。
func TestPerCallQuotaBillsWithoutUsage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withQuotaPerUnit(t, 500_000)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

	summary := calculateTextQuotaSummary(ctx, newPerCallRelayInfo(0.0032, 1), nil)

	require.Equal(t, 1600, summary.Quota)
}

// 分组倍率与附加倍率（如图片张数 n）都参与按次报价。
func TestPerCallQuotaAppliesGroupAndOtherRatios(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withQuotaPerUnit(t, 500_000)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

	withGroup := calculateTextQuotaSummary(ctx, newPerCallRelayInfo(0.0032, 0.5), &dto.Usage{
		PromptTokens: 100, TotalTokens: 100,
	})
	require.Equal(t, 800, withGroup.Quota)

	info := newPerCallRelayInfo(0.04, 1)
	info.PriceData.AddOtherRatio("n", 4)
	withRatio := calculateTextQuotaSummary(ctx, info, &dto.Usage{PromptTokens: 100, TotalTokens: 100})
	require.Equal(t, 80000, withRatio.Quota)
}

// 单次价为 0 的模型不产生额度，但请求仍然可用。
func TestPerCallQuotaZeroPriceIsFree(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withQuotaPerUnit(t, 500_000)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

	summary := calculateTextQuotaSummary(ctx, newPerCallRelayInfo(0, 1), &dto.Usage{PromptTokens: 100, TotalTokens: 100})

	require.Equal(t, 0, summary.Quota)
}
