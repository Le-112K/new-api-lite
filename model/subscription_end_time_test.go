package model

import (
	"testing"
	"time"
)

// 订阅按整点计时：起点抬到下一个整点，到期时间必然落在整点上。
func TestCalcPlanEndTimeAlignsToFullHour(t *testing.T) {
	loc := time.Local
	cases := []struct {
		name      string
		start     time.Time
		unit      string
		value     int
		wantEnd   time.Time
	}{
		{
			name:    "整点购买不顺延",
			start:   time.Date(2026, 3, 1, 10, 0, 0, 0, loc),
			unit:    SubscriptionDurationHour,
			value:   1,
			wantEnd: time.Date(2026, 3, 1, 11, 0, 0, 0, loc),
		},
		{
			name:    "半点购买抬到下一个整点",
			start:   time.Date(2026, 3, 1, 10, 37, 0, 0, loc),
			unit:    SubscriptionDurationHour,
			value:   1,
			wantEnd: time.Date(2026, 3, 1, 12, 0, 0, 0, loc),
		},
		{
			name:    "59 分 59 秒购买抬到下一个整点",
			start:   time.Date(2026, 3, 1, 10, 59, 59, 0, loc),
			unit:    SubscriptionDurationHour,
			value:   1,
			wantEnd: time.Date(2026, 3, 1, 12, 0, 0, 0, loc),
		},
		{
			name:    "23 点购买进位到次日整点",
			start:   time.Date(2026, 3, 1, 23, 30, 0, 0, loc),
			unit:    SubscriptionDurationDay,
			value:   1,
			wantEnd: time.Date(2026, 3, 3, 0, 0, 0, 0, loc),
		},
		{
			name:    "按天计费同样对齐整点",
			start:   time.Date(2026, 3, 1, 8, 5, 0, 0, loc),
			unit:    SubscriptionDurationDay,
			value:   7,
			wantEnd: time.Date(2026, 3, 8, 9, 0, 0, 0, loc),
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
				t.Fatalf("期望 %s，实际 %s", tc.wantEnd.Format(time.RFC3339), time.Unix(got, 0).In(loc).Format(time.RFC3339))
			}
			// 到期时间必须落在整点（分秒为 0）
			end := time.Unix(got, 0).In(loc)
			if end.Minute() != 0 || end.Second() != 0 {
				t.Fatalf("到期时间不是整点: %s", end.Format(time.RFC3339))
			}
		})
	}
}
