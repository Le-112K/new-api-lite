package model

import (
	"testing"
	"time"
)

// 有效期口径：到期时刻与开通时刻是同一时点，不做整点对齐。
func TestCalcPlanEndTimeKeepsSameClockTime(t *testing.T) {
	loc := time.FixedZone("CST", 8*3600)
	cases := []struct {
		name    string
		start   time.Time
		unit    string
		value   int
		wantEnd time.Time
	}{
		{
			name:    "12:36 开通 1 个月 → 下月同日 12:36",
			start:   time.Date(2026, 12, 2, 12, 36, 0, 0, loc),
			unit:    SubscriptionDurationMonth,
			value:   1,
			wantEnd: time.Date(2027, 1, 2, 12, 36, 0, 0, loc),
		},
		{
			name:    "12:36 开通 1 天 → 次日 12:36",
			start:   time.Date(2026, 12, 2, 12, 36, 0, 0, loc),
			unit:    SubscriptionDurationDay,
			value:   1,
			wantEnd: time.Date(2026, 12, 3, 12, 36, 0, 0, loc),
		},
		{
			name:    "12:36 开通 1 小时 → 13:36",
			start:   time.Date(2026, 12, 2, 12, 36, 0, 0, loc),
			unit:    SubscriptionDurationHour,
			value:   1,
			wantEnd: time.Date(2026, 12, 2, 13, 36, 0, 0, loc),
		},
		{
			name:    "12:36 开通 1 年 → 次年同日 12:36",
			start:   time.Date(2026, 12, 2, 12, 36, 0, 0, loc),
			unit:    SubscriptionDurationYear,
			value:   1,
			wantEnd: time.Date(2027, 12, 2, 12, 36, 0, 0, loc),
		},
		{
			name:    "12:36 开通 3 个月 → 3 个月后同日 12:36",
			start:   time.Date(2026, 12, 2, 12, 36, 0, 0, loc),
			unit:    SubscriptionDurationMonth,
			value:   3,
			wantEnd: time.Date(2027, 3, 2, 12, 36, 0, 0, loc),
		},
		{
			name:    "跨年：12/31 12:36 + 1 个月 → 次年 1/31 12:36",
			start:   time.Date(2026, 12, 31, 12, 36, 0, 0, loc),
			unit:    SubscriptionDurationMonth,
			value:   1,
			wantEnd: time.Date(2027, 1, 31, 12, 36, 0, 0, loc),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			plan := &SubscriptionPlan{DurationUnit: tc.unit, DurationValue: tc.value}
			got, err := calcPlanEndTime(tc.start, plan)
			if err != nil {
				t.Fatalf("calcPlanEndTime: %v", err)
			}
			if got != tc.wantEnd.Unix() {
				t.Fatalf("期望 %s，实际 %s",
					tc.wantEnd.Format("2006-01-02 15:04:05"),
					time.Unix(got, 0).In(loc).Format("2006-01-02 15:04:05"))
			}
		})
	}
}

// 月末不足时夹到目标月最后一天，不能像 time.AddDate 那样顺延到下下月。
func TestCalcPlanEndTimeClampsToMonthEnd(t *testing.T) {
	loc := time.FixedZone("CST", 8*3600)
	cases := []struct {
		name    string
		start   time.Time
		unit    string
		value   int
		wantEnd time.Time
	}{
		{
			name:    "1/31 + 1 个月 → 2/28（非闰年）",
			start:   time.Date(2026, 1, 31, 12, 36, 0, 0, loc),
			unit:    SubscriptionDurationMonth,
			value:   1,
			wantEnd: time.Date(2026, 2, 28, 12, 36, 0, 0, loc),
		},
		{
			name:    "1/31 + 1 个月 → 2/29（闰年）",
			start:   time.Date(2024, 1, 31, 12, 36, 0, 0, loc),
			unit:    SubscriptionDurationMonth,
			value:   1,
			wantEnd: time.Date(2024, 2, 29, 12, 36, 0, 0, loc),
		},
		{
			name:    "3/31 + 1 个月 → 4/30",
			start:   time.Date(2026, 3, 31, 12, 36, 0, 0, loc),
			unit:    SubscriptionDurationMonth,
			value:   1,
			wantEnd: time.Date(2026, 4, 30, 12, 36, 0, 0, loc),
		},
		{
			name:    "5/31 + 1 个月 → 6/30",
			start:   time.Date(2026, 5, 31, 12, 36, 0, 0, loc),
			unit:    SubscriptionDurationMonth,
			value:   1,
			wantEnd: time.Date(2026, 6, 30, 12, 36, 0, 0, loc),
		},
		{
			name:    "闰日 2/29 + 1 年 → 次年 2/28",
			start:   time.Date(2024, 2, 29, 12, 36, 0, 0, loc),
			unit:    SubscriptionDurationYear,
			value:   1,
			wantEnd: time.Date(2025, 2, 28, 12, 36, 0, 0, loc),
		},
		{
			name:    "12/31 + 2 个月 → 次年 2 月末",
			start:   time.Date(2026, 12, 31, 12, 36, 0, 0, loc),
			unit:    SubscriptionDurationMonth,
			value:   2,
			wantEnd: time.Date(2027, 2, 28, 12, 36, 0, 0, loc),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			plan := &SubscriptionPlan{DurationUnit: tc.unit, DurationValue: tc.value}
			got, err := calcPlanEndTime(tc.start, plan)
			if err != nil {
				t.Fatalf("calcPlanEndTime: %v", err)
			}
			if got != tc.wantEnd.Unix() {
				t.Fatalf("期望 %s，实际 %s",
					tc.wantEnd.Format("2006-01-02 15:04:05"),
					time.Unix(got, 0).In(loc).Format("2006-01-02 15:04:05"))
			}
		})
	}
}
