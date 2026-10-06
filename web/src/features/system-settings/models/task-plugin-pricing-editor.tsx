// Stub: 任务插件系统在二开精简中移除，插件计费编辑器不再渲染。
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { PricingCurrency } from '@/features/model-pricing/currency'
import type { ModelPricingPluginVariant } from '@/features/model-pricing/api'

export function TaskPluginPricingEditor(_props: {
  key?: string
  variants: ModelPricingPluginVariant[]
  expressions: Record<string, string>
  onChange: Dispatch<SetStateAction<Record<string, string>>>
  modelExpression: string
  modelBillingMode: string
  currency: PricingCurrency
  children?: ReactNode
}) {
  return null
}
