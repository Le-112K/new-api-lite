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

// TestPrepareImageBillingForRequestPricesEveryImage locks the two billing
// shapes behind /v1/images/generations and /v1/images/edits: a fixed price is
// multiplied by the requested image count, while ratio billing keeps the frozen
// per-request estimate and only applies the group ratio.
func TestPrepareImageBillingForRequestPricesEveryImage(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name                 string
		usePrice             bool
		modelPrice           float64
		imageQuotaBeforeGrou float64
		groupRatio           float64
		count                int
		wantQuota            int
	}{
		{
			name:       "fixed price charges every requested image",
			usePrice:   true,
			modelPrice: 0.1,
			groupRatio: 1,
			count:      3,
			wantQuota:  150000,
		},
		{
			name:                 "ratio billing keeps the frozen estimate and applies the group ratio",
			imageQuotaBeforeGrou: 1000,
			groupRatio:           1.5,
			count:                2,
			wantQuota:            1500,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{
				PriceData: hosttypes.PriceData{
					UsePrice:   test.usePrice,
					ModelPrice: test.modelPrice,
				},
				ImageQuotaBeforeGroup: test.imageQuotaBeforeGrou,
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
