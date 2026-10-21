package service

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
)

// PrepareImageBillingForRequest reserves the effective outbound image quantity
// before each attempt, including channel retries and parameter overrides. The
// client request body stays frozen; only the independent quantity is refreshed.
func PrepareImageBillingForRequest(c *gin.Context, info *relaycommon.RelayInfo, count int) *types.NewAPIError {
	if count < 1 || count > dto.MaxImageN {
		return types.NewErrorWithStatusCode(fmt.Errorf("image_count must be an integer between 1 and %d", dto.MaxImageN), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	info.ImageRequestCount = count
	var quota int
	var err error
	quantity := 1
	if info.PriceData.UsePrice {
		quantity = count
	}
	// Overwrite the per-attempt ratio so a failed attempt cannot leak its
	// quantity into another channel.
	info.PriceData.AddOtherRatio("n", float64(quantity))
	base := info.ImageQuotaBeforeGroup
	if info.PriceData.UsePrice {
		base = info.PriceData.ModelPrice * common.QuotaPerUnit
	}
	quota, err = common.QuotaFromFloatStrict(info.PriceData.ApplyOtherRatiosToFloat(base * info.PriceData.GroupRatioInfo.GroupRatio))
	if err != nil {
		return types.NewErrorWithStatusCode(err, types.ErrorCodeModelPriceError, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	info.PriceData.QuotaToPreConsume = quota
	if quota == 0 && info.Billing == nil {
		return nil
	}
	info.PriceData.FreeModel = false
	if info.Billing == nil {
		return PreConsumeBilling(c, quota, info)
	}
	if err := info.Billing.Reserve(quota); err != nil {
		var apiErr *types.NewAPIError
		if errors.As(err, &apiErr) {
			return apiErr
		}
		return types.NewErrorWithStatusCode(err, types.ErrorCodeInsufficientUserQuota, http.StatusForbidden, types.ErrOptionWithSkipRetry())
	}
	info.FinalPreConsumedQuota = info.Billing.GetPreConsumedQuota()
	return nil
}
