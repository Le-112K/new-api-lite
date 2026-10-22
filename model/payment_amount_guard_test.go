package model

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 金额篡改回归：易支付回调的实付金额必须与订单预设金额一致，
// 否则拒绝入账（F-001：低价付款买大额订单的防御）。

func TestRechargeEpayRejectsTamperedPaidMoney(t *testing.T) {
	testCases := []struct {
		name      string
		paidMoney string
	}{
		{name: "underpaid one cent against large order", paidMoney: "0.01"},
		{name: "underpaid by one cent", paidMoney: "9.99"},
		{name: "overpaid", paidMoney: "100.00"},
		{name: "empty paid money", paidMoney: ""},
		{name: "unparseable paid money", paidMoney: "abc"},
		{name: "negative paid money", paidMoney: "-10.00"},
	}

	for i, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)

			oldQuotaPerUnit := common.QuotaPerUnit
			common.QuotaPerUnit = 500000
			t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

			user := insertUserForPaymentGuardTest(t, 601, 0)
			tradeNo := "EPAYTESTAMTREJ" + strconv.Itoa(i)
			order := createEpayTestOrder(t, user.Id, tradeNo, PaymentProviderEpay, common.TopUpStatusPending)

			_, err := RechargeEpay(order.TradeNo, tc.paidMoney, "alipay", "127.0.0.1")
			require.ErrorIs(t, err, ErrPaymentAmountMismatch)
			assert.Equal(t, 0, getUserQuotaForPaymentGuardTest(t, user.Id))
			assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, order.TradeNo))
		})
	}
}

func TestRechargeEpayAcceptsEquivalentPaidMoneyFormats(t *testing.T) {
	testCases := []struct {
		name      string
		paidMoney string
	}{
		{name: "two decimals", paidMoney: "10.00"},
		{name: "one decimal", paidMoney: "10.0"},
		{name: "integer", paidMoney: "10"},
	}

	for i, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)

			oldQuotaPerUnit := common.QuotaPerUnit
			common.QuotaPerUnit = 500000
			t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

			user := insertUserForPaymentGuardTest(t, 602, 0)
			tradeNo := "EPAYTESTAMTOK" + strconv.Itoa(i)
			order := createEpayTestOrder(t, user.Id, tradeNo, PaymentProviderEpay, common.TopUpStatusPending)

			alreadyDone, err := RechargeEpay(order.TradeNo, tc.paidMoney, "alipay", "127.0.0.1")
			require.NoError(t, err)
			assert.False(t, alreadyDone)
			assert.Equal(t, 2*500000, getUserQuotaForPaymentGuardTest(t, user.Id))
			assert.Equal(t, common.TopUpStatusSuccess, getTopUpStatusForPaymentGuardTest(t, order.TradeNo))
		})
	}
}

func TestCompleteSubscriptionOrderRejectsTamperedPaidMoney(t *testing.T) {
	testCases := []struct {
		name      string
		paidMoney string
	}{
		{name: "underpaid one cent", paidMoney: "0.01"},
		{name: "empty paid money", paidMoney: ""},
		{name: "unparseable paid money", paidMoney: "abc"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)

			insertUserForPaymentGuardTest(t, 603, 0)
			plan := insertSubscriptionPlanForPaymentGuardTest(t, 501)
			insertSubscriptionOrderForPaymentGuardTest(t, "sub-amt-"+tc.name, 603, plan.Id, PaymentProviderEpay)

			err := CompleteSubscriptionOrder("sub-amt-"+tc.name, tc.paidMoney, `{"provider":"epay"}`, PaymentProviderEpay, "alipay")
			require.ErrorIs(t, err, ErrPaymentAmountMismatch)

			order := GetSubscriptionOrderByTradeNo("sub-amt-" + tc.name)
			require.NotNil(t, order)
			assert.Equal(t, common.TopUpStatusPending, order.Status)
			assert.Zero(t, countUserSubscriptionsForPaymentGuardTest(t, 603))
			assert.Nil(t, GetTopUpByTradeNo("sub-amt-"+tc.name))
		})
	}
}

func TestCompleteSubscriptionOrderAcceptsMatchingPaidMoney(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 604, 0)
	plan := insertSubscriptionPlanForPaymentGuardTest(t, 502)
	insertSubscriptionOrderForPaymentGuardTest(t, "sub-amt-ok", 604, plan.Id, PaymentProviderEpay)

	err := CompleteSubscriptionOrder("sub-amt-ok", "9.99", `{"provider":"epay"}`, PaymentProviderEpay, "alipay")
	require.NoError(t, err)

	order := GetSubscriptionOrderByTradeNo("sub-amt-ok")
	require.NotNil(t, order)
	assert.Equal(t, common.TopUpStatusSuccess, order.Status)
	assert.Equal(t, int64(1), countUserSubscriptionsForPaymentGuardTest(t, 604))
}
