// 订阅档位的对外展示名。
// 内部存储沿用的是分组名（default / vip / svip），其中 default 是 free 档的
// 历史别名；对用户一律展示为 Free / VIP / SVIP，不暴露内部标识。
export function subscriptionTierLabel(group?: string | null): string {
  const normalized = (group ?? '').trim().toLowerCase()
  if (normalized === 'free' || normalized === 'default') return 'Free'
  if (normalized === 'vip') return 'VIP'
  if (normalized === 'svip') return 'SVIP'
  return group ?? ''
}
