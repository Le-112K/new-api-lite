/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Activity, Coins, ShieldCheck, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  CardStaggerContainer,
  CardStaggerItem,
} from '@/components/page-transition'

import type { OverviewData } from '../../hooks/use-overview-data'
import { StatCard } from '../ui/stat-card'

export type OverviewMetricsData = Pick<
  OverviewData,
  | 'loading'
  | 'balanceDisplay'
  | 'spendDisplay'
  | 'requestsDisplay'
  | 'successRateDisplay'
  | 'spendDelta'
  | 'requestsDelta'
  | 'balanceTrend'
  | 'spendTrend'
  | 'requestsTrend'
  | 'successRateTrend'
>

export interface OverviewMetricsProps {
  data: OverviewMetricsData
}

export function OverviewMetrics(props: OverviewMetricsProps) {
  const { t } = useTranslation()
  const data = props.data

  return (
    <CardStaggerContainer className='grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4'>
      <CardStaggerItem className='bg-card h-full rounded-2xl border p-4 shadow-xs'>
        <StatCard
          title={t('Account balance')}
          value={data.balanceDisplay}
          description={t('Available credit')}
          icon={Wallet}
          iconTone='neutral'
          sparkline={data.balanceTrend}
          sparklineVariant='line'
          loading={data.loading}
        />
      </CardStaggerItem>

      <CardStaggerItem className='bg-card h-full rounded-2xl border p-4 shadow-xs'>
        <StatCard
          title={t("This month's spend")}
          value={data.spendDisplay}
          description={t('vs last period')}
          icon={Coins}
          iconTone='neutral'
          trend={data.spendDelta.value ? data.spendDelta : undefined}
          sparkline={data.spendTrend}
          sparklineVariant='line'
          loading={data.loading}
        />
      </CardStaggerItem>

      <CardStaggerItem className='bg-card h-full rounded-2xl border p-4 shadow-xs'>
        <StatCard
          title={t("This month's requests")}
          value={data.requestsDisplay}
          description={t('vs last period')}
          icon={Activity}
          iconTone='neutral'
          trend={data.requestsDelta.value ? data.requestsDelta : undefined}
          sparkline={data.requestsTrend}
          sparklineVariant='line'
          loading={data.loading}
        />
      </CardStaggerItem>

      <CardStaggerItem className='bg-card h-full rounded-2xl border p-4 shadow-xs'>
        <StatCard
          title={t('Request success rate')}
          value={data.successRateDisplay}
          description=''
          icon={ShieldCheck}
          iconTone='neutral'
          trend={{ value: t('Success rate'), direction: 'flat' }}
          sparkline={data.successRateTrend}
          sparklineVariant='line'
          loading={data.loading}
        />
      </CardStaggerItem>
    </CardStaggerContainer>
  )
}
