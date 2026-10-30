package service

import (
	"net/http/httptest"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	hosttypes "github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// stubBillingSettler records the quota the image path reserves so the test can
// prove the billed amount without touching the wallet or the database.
type stubBillingSettler struct {
	reserved int
}

func (b *stubBillingSettler) Settle(int) error           { return nil }
func (b *stubBillingSettler) Refund(*gin.Context)       {}
func (b *stubBillingSettler) NeedsRefund() bool         { return false }
func (b *stubBillingSettler) GetPreConsumedQuota() int  { return b.reserved }
func (b *stubBillingSettler) Reserve(targetQuota int) error {
	b.reserved = targetQuota
	return nil
}

// TestPrepareImageBillingForRequestPricesEveryImage 固定按次计价：
// 每张图都按单次价计费，并叠加分组倍率。
func TestPrepareImageBillingForRequestPricesEveryImage(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name                 string
		modelPrice           float64
		groupRatio           float64
		count                int
		wantQuota            int
	}{
		{
			name:       "fixed price charges every requested image",
			modelPrice: 0.1,
			groupRatio: 1,
			count:      3,
			wantQuota:  150000,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{
				PriceData: hosttypes.PriceData{
					ModelPrice: test.modelPrice,
				},
			}
			info.PriceData.GroupRatioInfo = hosttypes.GroupRatioInfo{GroupRatio: test.groupRatio}
			billing := &stubBillingSettler{}
			info.Billing = billing

			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			require.Nil(t, PrepareImageBillingForRequest(ctx, info, test.count))

			require.Equal(t, test.count, info.ImageRequestCount)
			require.Equal(t, test.wantQuota, info.PriceData.QuotaToPreConsume)
			require.Equal(t, test.wantQuota, billing.reserved)
		})
	}
}

// TestPrepareImageBillingForRequestRejectsOutOfRangeCount keeps the quantity
// inside the range the host protocol accepts; an unbounded n would let a caller
// reserve an arbitrary amount.
func TestPrepareImageBillingForRequestRejectsOutOfRangeCount(t *testing.T) {
	gin.SetMode(gin.TestMode)

	for _, count := range []int{0, -1} {
		info := &relaycommon.RelayInfo{}
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		require.NotNil(t, PrepareImageBillingForRequest(ctx, info, count), "count %d must be rejected", count)
	}
}
