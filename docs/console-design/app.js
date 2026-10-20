/* 控制台设计稿：角色化导航 + 页面渲染。数据为演示用假数据。 */

/* ============================================================
   1. 导航（与后端 generateDefaultSidebarConfig 的三档角色对齐）
   ============================================================ */
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/>',
  key: '<circle cx="7.5" cy="16.5" r="3.8"/><path d="M10.4 13.6 20 4"/><path d="M17.3 6.7 19 8.4"/>',
  logs: '<path d="M8.5 6h12M8.5 12h12M8.5 18h12"/><path d="M3.8 6h.01M3.8 12h.01M3.8 18h.01"/>',
  audit: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9.2 12.6l2 2 3.8-3.8"/>',
  wallet: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H17a2 2 0 0 1 2 2"/><path d="M3 7.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/><path d="M17 12.5h4v4h-4a2 2 0 0 1 0-4Z"/>',
  profile: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20.5c0-3.5 3.1-5.8 7-5.8s7 2.3 7 5.8"/>',
  security: '<path d="M12 3.2l7 2.9v5.3c0 4.2-2.9 7.7-7 9.4-4.1-1.7-7-5.2-7-9.4V6.1l7-2.9Z"/><path d="M9.4 12l1.9 1.9 3.4-3.5"/>',
  channels: '<rect x="3" y="4" width="18" height="6.5" rx="2"/><rect x="3" y="13.5" width="18" height="6.5" rx="2"/><path d="M7 7.2h.01M7 16.8h.01"/>',
  models: '<path d="M20.4 13.3 13.3 20.4a2 2 0 0 1-2.8 0L3.6 13.5A2 2 0 0 1 3 12.1V5a2 2 0 0 1 2-2h7.1c.5 0 1 .2 1.4.6l7 7a2 2 0 0 1 0 2.7Z"/><circle cx="7.9" cy="7.9" r="1.3"/>',
  redeem: '<path d="M3 9.2V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.2a2.8 2.8 0 0 0 0 5.6V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.2a2.8 2.8 0 0 0 0-5.6Z"/><path d="M12 8.2v7.6" stroke-dasharray="2.4 2.2"/>',
  users: '<circle cx="9.2" cy="8.2" r="3.2"/><path d="M3 20c0-3.1 2.8-5.2 6.2-5.2S15.4 16.9 15.4 20"/><path d="M16.2 5.4a3.2 3.2 0 0 1 0 5.6"/><path d="M17.6 15.3c1.9.6 3.4 2.2 3.4 4.7"/>',
  subscription: '<path d="M4 12a8 8 0 0 1 13.7-5.6"/><path d="M18 3.2v3.4h-3.4"/><path d="M20 12a8 8 0 0 1-13.7 5.6"/><path d="M6 20.8v-3.4h3.4"/>',
  settings: '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.6v2.3M12 19.1v2.3M4.5 7.3l2 1.1M17.5 15.6l2 1.1M4.5 16.7l2-1.1M17.5 8.4l2-1.1"/>'
}
function ico(name) {
  const p = ICONS[name]
  return p
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`
    : ''
}

const NAV = [
  {
    key: 'console', label: '控制台',
    items: [
      { id: 'dashboard', label: '数据看板', icon: 'dashboard' },
      { id: 'keys', label: 'API 密钥', icon: 'key' },
      { id: 'logs', label: '用量日志', icon: 'logs' },
      { id: 'audit', label: '审计日志', icon: 'audit', minRole: 'admin' }
    ]
  },
  {
    key: 'personal', label: '个人',
    items: [
      { id: 'wallet', label: '钱包充值', icon: 'wallet' },
      { id: 'profile', label: '个人设置', icon: 'profile' },
      { id: 'security', label: '安全设置', icon: 'security' }
    ]
  },
  {
    key: 'admin', label: '管理', minRole: 'admin',
    items: [
      { id: 'channels', label: '渠道', icon: 'channels' },
      { id: 'models', label: '模型价格', icon: 'models' },
      { id: 'redeem', label: '兑换码', icon: 'redeem' },
      { id: 'users', label: '用户', icon: 'users' },
      { id: 'subscription', label: '订阅', icon: 'subscription' },
      { id: 'settings', label: '系统设置', icon: 'settings', minRole: 'root' }
    ]
  }
]

const ROLE_RANK = { user: 0, admin: 1, root: 2 }
const ROLES = {
  user: { name: 'bob', label: '普通用户', avatar: 'B' },
  admin: { name: 'alice', label: '管理员', avatar: 'A' },
  root: { name: 'Le', label: '超级管理员', avatar: 'L' }
}

const PAGE_META = {
  dashboard: { sec: '控制台', title: '数据看板', desc: '今日消耗、请求趋势与模型用量', scroll: true },
  keys: { sec: '控制台', title: 'API 密钥', desc: '创建与吊销调用凭证，设置额度与过期时间' },
  logs: { sec: '控制台', title: '用量日志', desc: '逐条请求记录，可按时间、模型、密钥与状态筛选' },
  audit: { sec: '控制台', title: '审计日志', desc: '管理员操作留痕：渠道变更、用户封禁、配置修改' },
  wallet: { sec: '个人', title: '钱包充值', desc: '余额、兑换码与消费明细', scroll: true },
  profile: { sec: '个人', title: '个人设置', desc: '昵称、邮箱与调用偏好' },
  security: { sec: '个人', title: '安全设置', desc: '登录会话、密码与账号注销' },
  channels: { sec: '管理', title: '渠道', desc: '接入上游厂商，维护模型映射与可用分组' },
  models: { sec: '管理', title: '模型价格', desc: '单条改价、批量复制定价、未定价清理' },
  redeem: { sec: '管理', title: '兑换码', desc: '生成与导出额度兑换码' },
  users: { sec: '管理', title: '用户', desc: '账号、额度、分组与角色' },
  subscription: { sec: '管理', title: '订阅', desc: '套餐计划与用户订阅' },
  settings: { sec: '管理', title: '系统设置', desc: '站点、认证、计费、请求策略、安全、内容、运维' }
}

/* ============================================================
   2. 假数据
   ============================================================ */
const D = {
  stats: [
    { k: '可用余额', v: '$48.20', d: '较上周 −$6.10', trend: 'down' },
    { k: '今日消耗', v: '$2.36', d: '较昨日 +18.4%', trend: 'up' },
    { k: '今日请求', v: '1 284', d: '较昨日 +6.2%', trend: 'up' },
    { k: '平均耗时', v: '1.42', unit: 's', d: '较昨日 −0.08s', trend: 'down' }
  ],
  series7: [120, 168, 142, 210, 176, 248, 232],
  recent: [
    { t: '22:18:04', user: 'bob', model: 'deepseek-v3', key: '生产环境', ms: 920, cost: '$0.0042', st: 'ok' },
    { t: '22:16:41', user: 'alice', model: 'claude-sonnet-4', key: '生产环境', ms: 2400, cost: '$0.0620', st: 'ok' },
    { t: '22:15:12', user: 'bob', model: 'gpt-4o', key: '本地调试', ms: 1180, cost: '$0.0021', st: 'ok' },
    { t: '22:13:58', user: 'dave', model: 'gemini-2.5-pro', key: '生产环境', ms: 3600, cost: '$0.0098', st: 'warn' },
    { t: '22:11:07', user: 'carol', model: 'gpt-4o', key: '本地调试', ms: 12000, cost: '$0.0000', st: 'bad' }
  ],
  series30: [90, 110, 98, 130, 118, 160, 148, 172, 150, 190, 178, 210, 196, 240, 222, 260, 238, 272, 250, 288, 266, 300, 282, 318, 296, 330, 310, 352, 334, 372],
  topModels: [
    { n: 'deepseek-v3', p: 38 }, { n: 'claude-sonnet-4', p: 24 },
    { n: 'gpt-4o', p: 18 }, { n: 'gemini-2.5-pro', p: 12 }, { n: 'qwen-max', p: 8 }
  ],
  keys: [
    { id: 1, name: '生产环境', key: 'sk-8fQ2...c91A', status: 'ok', quota: '不限', used: '$1 284.20', expire: '永不过期', last: '2 分钟前' },
    { id: 2, name: '本地调试', key: 'sk-3dLm...7vP0', status: 'ok', quota: '$20.00', used: '$12.46', expire: '30 天后', last: '3 小时前' },
    { id: 3, name: 'CI 流水线', key: 'sk-9xRt...2wQ8', status: 'off', quota: '$50.00', used: '$50.00', expire: '已过期', last: '12 天前' }
  ],
  logs: [
    { t: '10-17 22:18:04', model: 'deepseek-v3', key: '生产环境', p: 1240, c: 860, ms: 920, cost: '$0.0042', st: 'ok' },
    { t: '10-17 22:16:41', model: 'claude-sonnet-4', key: '生产环境', p: 8200, c: 3120, ms: 2400, cost: '$0.0620', st: 'ok' },
    { t: '10-17 22:15:12', model: 'gpt-4o', key: '本地调试', p: 480, c: 210, ms: 1180, cost: '$0.0021', st: 'ok' },
    { t: '10-17 22:11:58', model: 'deepseek-v3', key: '生产环境', p: 156, c: 0, ms: 340, cost: '$0.0003', st: 'ok' },
    { t: '10-17 22:09:33', model: 'gemini-2.5-pro', key: '生产环境', p: 2100, c: 940, ms: 3600, cost: '$0.0098', st: 'warn', note: '触达上游限流，已重试成功' },
    { t: '10-17 22:04:07', model: 'gpt-4o', key: '本地调试', p: 620, c: 0, ms: 12000, cost: '$0.0000', st: 'bad', note: '上游超时 504' },
    { t: '10-17 21:58:45', model: 'qwen-max', key: '生产环境', p: 980, c: 420, ms: 860, cost: '$0.0016', st: 'ok' },
    { t: '10-17 21:52:19', model: 'deepseek-v3', key: '生产环境', p: 3300, c: 1120, ms: 1520, cost: '$0.0088', st: 'ok' }
  ],
  channels: [
    { id: 17, name: 'deepseek-v3', type: 'OpenAI 兼容', groups: '默认 · vip', models: 12, st: 'ok', rt: '820ms', used: '$1 284.20', left: '$715.80', pri: 10, weight: 5 },
    { id: 23, name: '火山方舟 doubao', type: '火山方舟', groups: '默认', models: 8, st: 'ok', rt: '640ms', used: '$842.10', left: '$1 157.90', pri: 10, weight: 8 },
    { id: 31, name: 'claude-sonnet', type: 'Anthropic', groups: '默认', models: 5, st: 'warn', rt: '—', used: '$0.00', left: '$500.00', pri: 20, weight: 3, note: '上游 401，自动禁用' },
    { id: 42, name: 'gemini-2.5-pro', type: 'Gemini', groups: 'svip', models: 4, st: 'off', rt: '—', used: '$310.00', left: '$190.00', pri: 30, weight: 1 },
    { id: 58, name: 'siliconflow', type: 'SiliconFlow', groups: '默认', models: 21, st: 'ok', rt: '1 120ms', used: '$2 010.40', left: '$489.60', pri: 15, weight: 6 },
    { id: 61, name: 'newapi 级联', type: 'New API', groups: '默认', models: 3, st: 'ok', rt: '2 340ms', used: '$96.20', left: '$403.80', pri: 40, weight: 2 }
  ],
  users: [
    { id: 1002, name: 'alice', display: 'Alice Wong', group: 'default · vip', role: '管理员', quota: 1240, used: 380, st: 'ok', last: '2026-10-17 21:40' },
    { id: 1003, name: 'bob', display: 'Bob Li', group: 'default', role: '普通用户', quota: 100, used: 51.8, st: 'ok', last: '2026-10-17 22:18' },
    { id: 1004, name: 'carol', display: 'Carol Zhang', group: 'default', role: '普通用户', quota: 0, used: 12.4, st: 'off', last: '2026-10-02 09:11' },
    { id: 1005, name: 'dave', display: 'Dave Chen', group: 'svip', role: '普通用户', quota: 5000, used: 412, st: 'ok', last: '2026-10-17 19:02' },
    { id: 1006, name: 'erin', display: 'Erin Xu', group: 'default', role: '普通用户', quota: 300, used: 296.3, st: 'ok', last: '2026-10-16 23:47' }
  ],
  models: [
    { name: 'gpt-4o', mode: '按倍率', in: '$1.25', out: '$5.00', ratio: '0.5', tag: '' },
    { name: 'claude-sonnet-4', mode: '按倍率', in: '$3.00', out: '$15.00', ratio: '1.0', tag: '' },
    { name: 'gemini-2.5-pro', mode: '按次', in: '—', out: '—', ratio: '0.0025/次', tag: '阶梯' },
    { name: 'deepseek-v3', mode: '—', in: '—', out: '—', ratio: '—', tag: '未定价' },
    { name: 'qwen-max', mode: '按倍率', in: '$0.40', out: '$1.20', ratio: '0.8', tag: '' },
    { name: 'doubao-pro-32k', mode: '按倍率', in: '$0.11', out: '$0.28', ratio: '0.3', tag: '' },
    { name: 'text-embedding-3-large', mode: '按倍率', in: '$0.13', out: '—', ratio: '0.2', tag: '' },
    { name: 'gpt-4o-mini', mode: '按倍率', in: '$0.15', out: '$0.60', ratio: '0.15', tag: '' }
  ],
  redeem: [
    { code: 'napi-7QK2-9FDM-3XT8', quota: '$10.00', st: 'used', by: 'bob', at: '2026-10-15 11:02' },
    { code: 'napi-4RTP-8WJA-6HC5', quota: '$10.00', st: 'ok', by: '—', at: '—' },
    { code: 'napi-1MZN-5KVE-2QB7', quota: '$50.00', st: 'ok', by: '—', at: '—' },
    { code: 'napi-6YUH-3PLD-9RA4', quota: '$50.00', st: 'exp', by: '—', at: '2026-09-30 过期' }
  ],
  plans: [
    { name: '基础版', price: '$9.9', period: '/ 月', quota: '每月 $10 额度', users: 128, st: 'ok' },
    { name: '专业版', price: '$49.9', period: '/ 月', quota: '每月 $60 额度 · 优先队列', users: 34, st: 'ok' },
    { name: '团队版', price: '$199', period: '/ 月', quota: '每月 $260 额度 · 5 席位', users: 6, st: 'ok' },
    { name: '体验版', price: '$0', period: '/ 一次', quota: '$1 试用额度', users: 512, st: 'off' }
  ],
  sessions: [
    { dev: 'Chrome · macOS', ip: '203.0.113.24', loc: '中国 上海', at: '当前会话' },
    { dev: 'Safari · iPhone', ip: '203.0.113.51', loc: '中国 上海', at: '2 小时前' },
    { dev: 'curl/8.4.0', ip: '198.51.100.7', loc: '美国 洛杉矶', at: '3 天前' }
  ]
}

/* ============================================================
   3. 小工具
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s)
const state = { role: 'root', page: 'dashboard', scope: 'mine' }

function badge(st, text) {
  return `<span class="badge ${st}">${text}</span>`
}

function trendTag(t) {
  return t === 'up'
    ? '<span class="badge bad sm">↑ 上升</span>'
    : '<span class="badge ok sm">↓ 下降</span>'
}

function areaChart(values, dense) {
  const w = 620, h = 176, pad = { t: 12, r: 8, b: 24, l: 8 }
  const max = Math.max(...values) * 1.18 || 1
  const step = (w - pad.l - pad.r) / (values.length - 1)
  const pts = values.map((v, i) => [pad.l + i * step, h - pad.b - (v / max) * (h - pad.t - pad.b)])
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const area = `${line} L ${pts[pts.length - 1][0].toFixed(1)} ${h - pad.b} L ${pad.l} ${h - pad.b} Z`
  const grid = [0.25, 0.55, 0.85].map((f) => {
    const y = pad.t + f * (h - pad.t - pad.b)
    return `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="var(--grid-line)" stroke-width="1"/>`
  }).join('')
  const labels = dense ? '' : values.map((_, i) => {
    const d = ['一', '二', '三', '四', '五', '六', '日'][i]
    return `<text x="${pts[i][0].toFixed(1)}" y="${h - 6}" font-size="10" fill="var(--muted-fg)" text-anchor="middle">周${d}</text>`
  }).join('')
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--emph)" stop-opacity=".10"/>
      <stop offset="100%" stop-color="var(--emph)" stop-opacity="0"/>
    </linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#g1)"/>
    <path d="${line}" fill="none" stroke="var(--emph)" stroke-width="1.6" stroke-linejoin="round"/>
    ${pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.4" fill="var(--card)" stroke="var(--emph)" stroke-width="1.4"/>`).join('')}
    ${labels}
  </svg>`
}

function pageHead(title, desc, actions) {
  return `<div class="page-head">
    <div><h1>${title}</h1><p>${desc}</p></div>
    <div class="head-actions">${actions || ''}</div>
  </div>`
}

function toolbar(left, right) {
  return `<div class="toolbar">${left || ''}<div class="toolbar-right">${right || ''}</div></div>`
}

function searchBox(ph) {
  return `<label class="search"><span>⌕</span><input placeholder="${ph}"/></label>`
}

function pager(from, to, total, extra) {
  const pages = Math.max(1, Math.ceil(total / 20))
  const nums = pages <= 3 ? Array.from({ length: pages }, (_, i) => i + 1) : [1, 2, 3]
  const btns = nums.map((n, i) => `<button class="page-btn ${i === 0 ? 'on' : ''}">${n}</button>`).join('')
  return `<div class="pager">
    <span><b>${from}–${to}</b> / 共 ${total} 条${extra ? ' · ' + extra : ''}</span>
    <span class="spacer"></span>
    <button class="pill" style="height:28px;font-size:12px">每页 20 <span class="caret">▾</span></button>
    <div style="display:flex;gap:2px">
      <button class="page-btn">‹</button>
      ${btns}
      ${pages > 3 ? '<button class="page-btn">…</button>' : ''}
      <button class="page-btn">›</button>
    </div>
  </div>`
}

/* ============================================================
   4. 页面
   ============================================================ */
const PAGES = {}

/* ---------- 数据看板 ---------- */
PAGES.dashboard = () => {
  const isAdmin = state.role !== 'user'
  const scopeSwitch = isAdmin
    ? `<div class="segmented" role="group" aria-label="数据范围">
         <button data-scope="mine" aria-pressed="${state.scope === 'mine'}">我的</button>
         <button data-scope="all" aria-pressed="${state.scope === 'all'}">全站</button>
       </div>`
    : ''
  const stats = state.scope === 'all'
    ? [
        { k: '今日消耗', v: '$1 284.60', d: '较昨日 +12.1%', trend: 'up' },
        { k: '今日请求', v: '284 916', d: '较昨日 +9.8%', trend: 'up' },
        { k: '活跃用户', v: '412', d: '较昨日 +3', trend: 'up' },
        { k: '失败率', v: '0.42', unit: '%', d: '较昨日 −0.11%', trend: 'down' }
      ]
    : D.stats

  return `
  ${pageHead('数据看板', PAGE_META.dashboard.desc, scopeSwitch)}
  <div class="grid-cards">
    ${stats.map((s) => `<div class="stat">
      <div class="k">${s.k}</div>
      <div class="v">${s.v}${s.unit ? `<small>${s.unit}</small>` : ''}</div>
      <div class="d ${s.trend}">${s.d}</div>
    </div>`).join('')}
  </div>
  <div class="two-col">
    <div class="card">
      <div class="card-head"><h3>消耗趋势</h3><span class="tail">近 7 天 · 美元</span></div>
      <div class="card-body">${areaChart(D.series7)}</div>
    </div>
    <div class="card">
      <div class="card-head"><h3>模型用量</h3><span class="tail">按请求数</span></div>
      <div class="card-body">
        <div class="rank">
          ${D.topModels.map((m, i) => `<div class="rank-row">
            <span class="idx">${i + 1}</span>
            <span class="nm">${m.n}</span>
            <span class="bar"><i style="width:${m.p * 2.2}%"></i></span>
            <span class="pct">${m.p}%</span>
          </div>`).join('')}
        </div>
        <div style="margin-top:18px">
          <div class="quick">
            <a data-go="keys"><i>${ico('key')}</i><span>新建密钥<small>30 秒接入</small></span></a>
            <a data-go="wallet"><i>${ico('wallet')}</i><span>充值<small>当前 $48.20</small></span></a>
            <a data-go="logs"><i>${ico('logs')}</i><span>查日志<small>按模型筛</small></span></a>
            <a data-go="profile"><i>${ico('profile')}</i><span>个人设置<small>默认模型</small></span></a>
          </div>
        </div>
      </div>
    </div>
  </div>
  <section class="panel panel-auto" style="margin-top:16px">
    <div class="dash-head">
      <h3>最近调用</h3>
      <span class="tail">${state.scope === 'all' ? '全站 · 最近 5 分钟' : '最近 5 分钟'}</span>
      <span class="more" data-go="logs">查看全部 →</span>
    </div>
    <div class="tscroll">
      <table class="dense">
        <thead><tr>
          <th>时间</th>
          ${isAdmin && state.scope === 'all' ? '<th>用户</th>' : ''}
          <th>模型</th><th>密钥</th><th class="num">耗时</th><th class="num">消耗</th><th>状态</th>
        </tr></thead>
        <tbody>
          ${D.recent.map((r) => `<tr>
            <td class="muted mono">${r.t}</td>
            ${isAdmin && state.scope === 'all' ? `<td>${r.user}</td>` : ''}
            <td>${r.model}</td>
            <td class="muted">${r.key}</td>
            <td class="num mono">${r.ms}ms</td>
            <td class="num mono">${r.cost}</td>
            <td>${r.st === 'ok' ? badge('ok', '成功') : r.st === 'warn' ? badge('warn', '重试') : badge('bad', '失败')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </section>`
}

/* ---------- API 密钥 ---------- */
PAGES.keys = () => `
  ${pageHead('API 密钥', PAGE_META.keys.desc,
    `<button class="btn btn-ghost">导入</button><button class="btn btn-primary" data-toast="已创建密钥 sk-••••7vP0">新建密钥</button>`)}
  <section class="panel">
    ${toolbar(searchBox('搜索名称或密钥前缀') +
      `<button class="pill">状态 <span class="caret">▾</span></button>
       <button class="pill">分组 <span class="caret">▾</span></button>`,
      `<button class="icon-btn" title="列设置">▥</button><button class="icon-btn" title="刷新">⟳</button>`)}
    <div class="tscroll">
      <table>
        <thead><tr>
          <th>名称</th><th>密钥</th><th>状态</th><th class="num">额度</th>
          <th class="num">已用</th><th>过期</th><th>最近使用</th><th class="act">操作</th>
        </tr></thead>
        <tbody>
          ${D.keys.map((k) => `<tr>
            <td><span class="cell-name"><b>${k.name}</b><small>#${k.id}</small></span></td>
            <td class="mono">${k.key}</td>
            <td>${k.status === 'ok' ? badge('ok', '启用') : badge('off', '已停用')}</td>
            <td class="num">${k.quota}</td>
            <td class="num">${k.used}</td>
            <td class="muted">${k.expire}</td>
            <td class="muted">${k.last}</td>
            <td class="act"><button class="icon-btn" data-toast="已复制到剪贴板">⧉</button><button class="icon-btn">⋯</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${pager(1, 3, 3)}
  </section>`

/* ---------- 用量日志 ---------- */
PAGES.logs = () => `
  ${pageHead('用量日志', PAGE_META.logs.desc, `<button class="btn btn-ghost">导出 CSV</button>`)}
  <section class="panel">
    ${toolbar(searchBox('搜索模型或请求 ID') +
      `<button class="pill">时间 <span class="caret">▾</span></button>
       <button class="pill">模型 <span class="caret">▾</span></button>
       <button class="pill">状态 <span class="caret">▾</span></button>`,
      `<button class="icon-btn" title="刷新">⟳</button>`)}
    <div class="tscroll">
      <table>
        <thead><tr>
          <th>时间</th><th>模型</th><th>密钥</th><th class="num">提示</th><th class="num">补全</th>
          <th class="num">耗时</th><th class="num">消耗</th><th>状态</th>
        </tr></thead>
        <tbody>
          ${D.logs.map((l) => `<tr>
            <td class="muted mono">${l.t}</td>
            <td>${l.model}</td>
            <td class="muted">${l.key}</td>
            <td class="num">${l.p.toLocaleString()}</td>
            <td class="num">${l.c ? l.c.toLocaleString() : '—'}</td>
            <td class="num">${l.ms.toLocaleString()}ms</td>
            <td class="num">${l.cost}</td>
            <td>${l.st === 'ok' ? '<span class="muted">成功</span>'
                  : l.st === 'warn' ? badge('warn', '已限流')
                  : badge('bad', '失败 504')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${pager(1, 8, 1284)}
  </section>`

/* ---------- 审计日志（管理员） ---------- */
PAGES.audit = () => `
  ${pageHead('审计日志', PAGE_META.audit.desc, `<button class="btn btn-ghost">导出</button>`)}
  <section class="panel">
    ${toolbar(searchBox('搜索操作人或对象') +
      `<button class="pill">操作类型 <span class="caret">▾</span></button>
       <button class="pill">时间 <span class="caret">▾</span></button>`)}
    <div class="tscroll">
      <table>
        <thead><tr><th>时间</th><th>操作人</th><th>动作</th><th>对象</th><th>来源 IP</th><th>结果</th></tr></thead>
        <tbody>
          ${[
            ['10-17 22:04', 'alice', '修改渠道', 'deepseek-v3 (#17)', '203.0.113.24', 'ok'],
            ['10-17 21:36', 'alice', '禁用用户', 'carol (#1004)', '203.0.113.24', 'ok'],
            ['10-17 20:12', 'Le', '修改系统设置', '注册控制 / 允许邮箱注册', '198.51.100.7', 'ok'],
            ['10-17 18:48', 'alice', '生成兑换码', '50 张 · $10', '203.0.113.24', 'ok'],
            ['10-17 17:02', 'alice', '删除渠道', 'old-relay (#9)', '203.0.113.51', 'bad']
          ].map((r) => `<tr>
            <td class="muted mono">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td>
            <td class="muted">${r[3]}</td><td class="muted mono">${r[4]}</td>
            <td>${r[5] === 'ok' ? badge('ok', '成功') : badge('bad', '失败')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${pager(1, 5, 86)}
  </section>`

/* ---------- 钱包 ---------- */
PAGES.wallet = () => `
  ${pageHead('钱包充值', PAGE_META.wallet.desc, `<button class="btn btn-ghost" data-toast="已生成账单 CSV">导出账单</button>`)}
  <div class="wallet-grid">
    <div class="card">
      <div class="card-head"><h3>当前余额</h3><span class="tail">USD</span></div>
      <div class="card-body">
        <div class="balance">$48.20<small>可用</small></div>
        <div style="font-size:12px;color:var(--muted-fg);margin-top:6px">
          另有 $3.75 冻结中（订阅待扣款）· 最近充值 10-12
        </div>
        <div class="amounts">
          ${['$10', '$20', '$50', '$100'].map((a, i) =>
            `<button class="amount ${i === 1 ? 'on' : ''}">${a}</button>`).join('')}
        </div>
        <div class="field">
          <label>自定义金额</label>
          <div class="input">20.00</div>
          <div class="hint">最低 $1，到账后不可提现</div>
        </div>
        <button class="btn btn-primary" style="width:100%" data-toast="已跳转支付（演示）">去支付 $20.00</button>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3>兑换码</h3></div>
      <div class="card-body">
        <div class="field">
          <label>输入兑换码</label>
          <div class="input mono">napi-____-____-____</div>
          <div class="hint">不区分大小写，兑换后额度立即到账</div>
        </div>
        <button class="btn btn-ghost" data-toast="兑换码无效">立即兑换</button>
        <div style="height:20px"></div>
        <h3 style="font-size:14px;font-weight:600;margin:0 0 8px">最近充值记录</h3>
        <table>
          <thead><tr><th>时间</th><th>方式</th><th class="num">金额</th><th>状态</th></tr></thead>
          <tbody>
            ${[
              ['10-12 14:20', '支付宝', '+$50.00', 'ok'],
              ['09-28 09:04', '兑换码', '+$10.00', 'ok'],
              ['09-15 20:11', '微信支付', '+$20.00', 'ok']
            ].map((r) => `<tr>
              <td class="muted mono">${r[0]}</td><td>${r[1]}</td>
              <td class="num">${r[2]}</td>
              <td>${badge('ok', '已到账')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <section class="panel panel-auto" style="margin-top:16px">
    <div class="dash-head">
      <h3>消费明细</h3>
      <span class="tail">近 30 天 · 按时间倒序</span>
      <span class="more" data-go="logs">在用量日志中查看 →</span>
    </div>
    <div class="tscroll">
      <table class="dense">
        <thead><tr>
          <th>时间</th><th>类型</th><th>模型</th><th class="num">消耗</th><th class="num">余额</th>
        </tr></thead>
        <tbody>
          ${[
            ['10-17 22:18', '调用扣费', 'deepseek-v3', '−$0.0042', '$48.20'],
            ['10-17 21:52', '调用扣费', 'deepseek-v3', '−$0.0088', '$48.20'],
            ['10-17 18:30', '订阅扣费', '高级版 · 月付', '−$3.75', '$48.21'],
            ['10-12 14:20', '充值', '支付宝', '+$50.00', '$51.96'],
            ['10-08 09:11', '调用扣费', 'claude-sonnet-4', '−$0.0620', '$1.96'],
            ['09-28 09:04', '兑换码', 'napi-4F2C', '+$10.00', '$2.02']
          ].map((r) => `<tr>
            <td class="muted mono">${r[0]}</td>
            <td>${r[1]}</td>
            <td class="muted">${r[2]}</td>
            <td class="num mono" style="color:${r[3].startsWith('+') ? 'var(--ok-fg)' : 'inherit'}">${r[3]}</td>
            <td class="num mono">${r[4]}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </section>`

/* ---------- 个人设置 ---------- */
PAGES.profile = () => `
  ${pageHead('个人设置', PAGE_META.profile.desc,
    `<span class="meta-note"><span class="dot"></span> 有未保存的更改</span>
     <button class="btn btn-ghost">重置</button><button class="btn btn-primary" data-toast="已保存">保存</button>`)}
  <section class="panel">
    <div class="form" style="padding:20px 20px 24px;max-width:720px">
      <section class="form-sec">
        <h3 class="sec-title">基本资料</h3>
        <p class="sec-desc">昵称会显示在用量报表与协作记录里，邮箱用于接收额度提醒。</p>
        <div class="row2">
          <div class="field"><label>昵称</label><div class="input">bob</div></div>
          <div class="field"><label>显示名</label><div class="input focus">Bob Li</div></div>
        </div>
        <div class="field"><label>邮箱</label><div class="input">bob@example.com</div>
          <div class="hint">修改邮箱需要验证当前密码</div></div>
      </section>
      <section class="form-sec">
        <h3 class="sec-title">调用偏好</h3>
        <p class="sec-desc">只影响你自己发起的请求，不影响其他成员。</p>
        <div class="row2">
          <div class="field"><label>默认模型</label>
            <div class="input" style="justify-content:space-between">deepseek-v3 <span class="caret">▾</span></div></div>
          <div class="field"><label>默认分组</label>
            <div class="input" style="justify-content:space-between">default <span class="caret">▾</span></div></div>
        </div>
        <div class="switch-row"><div><b>流式响应</b><small>关闭后客户端强制走非流式</small></div>
          <span class="switch on"></span></div>
        <div class="switch-row"><div><b>额度不足时提醒</b><small>余额低于 $5 时发邮件</small></div>
          <span class="switch on"></span></div>
      </section>
    </div>
  </section>`

/* ---------- 安全设置 ---------- */
PAGES.security = () => `
  ${pageHead('安全设置', PAGE_META.security.desc, '')}
  <section class="panel">
    <div class="form" style="padding:20px 20px 24px;max-width:820px">
      <section class="form-sec">
        <h3 class="sec-title">修改密码</h3>
        <p class="sec-desc">修改后其它设备需要重新登录。</p>
        <div class="row2">
          <div class="field"><label>当前密码</label><div class="input">••••••••</div></div>
          <div class="field"><label>新密码</label><div class="input">至少 8 位</div></div>
        </div>
        <button class="btn btn-ghost" data-toast="密码已更新">更新密码</button>
      </section>

      <section class="form-sec">
        <h3 class="sec-title">登录会话</h3>
        <p class="sec-desc">发现不认识的设备立即吊销。</p>
        <table>
          <thead><tr><th>设备</th><th>IP</th><th>位置</th><th>最近活动</th><th class="act">操作</th></tr></thead>
          <tbody>
            ${D.sessions.map((s, i) => `<tr>
              <td>${s.dev}</td><td class="mono muted">${s.ip}</td><td class="muted">${s.loc}</td>
              <td class="muted">${s.at}</td>
              <td class="act">${i === 0 ? badge('ok', '当前') : '<button class="link-btn danger">吊销</button>'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </section>

      <section class="form-sec">
        <h3 class="sec-title" style="color:var(--bad-fg)">注销账号</h3>
        <p class="sec-desc">账号下所有密钥会立即失效，余额不退。此操作不可恢复。</p>
        <button class="btn btn-ghost" style="color:var(--bad-fg);border-color:var(--bad-fg)">注销账号</button>
      </section>
    </div>
  </section>`

/* ---------- 渠道 ---------- */
PAGES.channels = () => `
  ${pageHead('渠道', PAGE_META.channels.desc,
    `<button class="btn btn-ghost">测试全部</button>
     <button class="btn btn-primary" data-drawer="channel">新建渠道</button>`)}
  <section class="panel">
    ${toolbar(searchBox('搜索名称、ID 或模型') +
      `<button class="pill">类型 <span class="caret">▾</span></button>
       <button class="pill">状态 <span class="caret">▾</span></button>
       <button class="pill">分组 <span class="caret">▾</span></button>`,
      `<button class="icon-btn" title="选择">☑</button>
       <button class="icon-btn" title="列设置">▥</button>
       <button class="icon-btn" title="刷新">⟳</button>`)}
    <div class="tscroll">
      <table>
        <thead><tr>
          <th class="chk"><span class="cb mix"></span></th>
          <th>名称</th><th>类型</th><th>分组</th><th class="num">模型</th>
          <th>状态</th><th class="num">已用 / 剩余</th><th class="num">响应</th><th class="act">操作</th>
        </tr></thead>
        <tbody>
          ${D.channels.map((c, i) => `<tr class="${i < 2 ? 'sel' : ''}">
            <td class="chk"><span class="cb ${i < 2 ? 'on' : ''}"></span></td>
            <td><span class="cell-name"><b>${c.name}</b><small>#${c.id}</small></span></td>
            <td class="muted">${c.type}</td>
            <td class="muted">${c.groups}</td>
            <td class="num">${c.models}</td>
            <td>${c.st === 'ok' ? badge('ok', '启用') : c.st === 'warn' ? badge('warn', '自动禁用') : badge('off', '已禁用')}</td>
            <td class="num muted">${c.used} <span style="opacity:.5">/</span> ${c.left}</td>
            <td class="num muted">${c.rt}</td>
            <td class="act"><button class="icon-btn" data-drawer="channel">⋯</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="selection">
      <span>已选 <b>2</b> 项</span><span class="spacer"></span>
      <button class="link-btn">批量启用</button><button class="link-btn">批量禁用</button>
      <button class="link-btn">测试</button><button class="link-btn danger">删除</button>
    </div>
    ${pager(1, 6, 23)}
  </section>`

/* ---------- 模型价格 ---------- */
PAGES.models = () => `
  ${pageHead('模型价格', PAGE_META.models.desc,
    `<button class="btn btn-ghost">批量改价</button><button class="btn btn-primary">添加模型</button>`)}
  <section class="panel">
    ${toolbar(searchBox('搜索模型名') +
      `<button class="pill">计费模式 <span class="caret">▾</span></button>
       <button class="pill">状态 <span class="caret">▾</span></button>`,
      `<button class="icon-btn" title="紧凑密度">⇕</button><button class="icon-btn" title="列设置">▥</button>`)}
    <div class="tscroll">
      <table class="dense">
        <thead><tr>
          <th class="chk"><span class="cb"></span></th>
          <th>模型</th><th>计费模式</th><th class="num">输入</th><th class="num">输出</th>
          <th class="num">倍率</th><th class="act">操作</th>
        </tr></thead>
        <tbody>
          ${D.models.map((m, i) => `<tr class="${i === 0 ? 'sel' : ''}">
            <td class="chk"><span class="cb ${i === 0 ? 'on' : ''}"></span></td>
            <td><b style="font-weight:500">${m.name}</b>${m.tag ? ' ' + badge(m.tag === '未定价' ? 'warn sm' : 'info sm', m.tag) : ''}</td>
            <td class="muted">${m.mode}</td>
            <td class="num">${m.in}</td><td class="num">${m.out}</td>
            <td class="num">${m.ratio}</td>
            <td class="act">${m.tag === '未定价'
              ? '<button class="link-btn">去定价</button>'
              : '<button class="icon-btn">⋯</button>'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="selection"><span>已选 <b>1</b> 项</span><span class="spacer"></span>
      <button class="link-btn">批量改价</button><button class="link-btn">复制定价</button>
      <button class="link-btn danger">删除</button></div>
    ${pager(1, 8, 42, '3 个未定价')}
  </section>`

/* ---------- 兑换码 ---------- */
PAGES.redeem = () => `
  ${pageHead('兑换码', PAGE_META.redeem.desc,
    `<button class="btn btn-ghost">导出 CSV</button><button class="btn btn-primary" data-toast="已生成 50 张 $10 兑换码">生成兑换码</button>`)}
  <section class="panel">
    ${toolbar(searchBox('搜索兑换码') +
      `<button class="pill">面额 <span class="caret">▾</span></button>
       <button class="pill">状态 <span class="caret">▾</span></button>`,
      `<button class="icon-btn" title="刷新">⟳</button>`)}
    <div class="tscroll">
      <table>
        <thead><tr><th>兑换码</th><th class="num">面额</th><th>状态</th><th>使用者</th><th>时间</th><th class="act">操作</th></tr></thead>
        <tbody>
          ${D.redeem.map((r) => `<tr>
            <td class="mono">${r.code}</td>
            <td class="num">${r.quota}</td>
            <td>${r.st === 'ok' ? badge('ok', '未使用') : r.st === 'used' ? badge('off', '已使用') : badge('warn', '已过期')}</td>
            <td class="muted">${r.by}</td><td class="muted mono">${r.at}</td>
            <td class="act"><button class="icon-btn" data-toast="已复制">⧉</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${pager(1, 4, 350, '247 张未使用')}
  </section>`

/* ---------- 用户 ---------- */
PAGES.users = () => `
  ${pageHead('用户', PAGE_META.users.desc,
    `<button class="btn btn-ghost">导出</button><button class="btn btn-primary" data-toast="已打开新建用户（演示）">新建用户</button>`)}
  <section class="panel">
    ${toolbar(searchBox('搜索用户名、邮箱或 ID') +
      `<button class="pill">状态 <span class="caret">▾</span></button>
       <button class="pill">分组 <span class="caret">▾</span></button>
       <button class="pill">角色 <span class="caret">▾</span></button>`,
      `<button class="icon-btn" title="列设置">▥</button><button class="icon-btn" title="刷新">⟳</button>`)}
    <div class="tscroll">
      <table>
        <thead><tr>
          <th class="chk"><span class="cb"></span></th>
          <th>用户名</th><th>状态</th><th class="num">额度</th><th style="width:150px">已用</th>
          <th>分组</th><th>角色</th><th>最近活跃</th><th class="act">操作</th>
        </tr></thead>
        <tbody>
          ${D.users.map((u) => {
            const unlimited = !u.quota
            const pct = unlimited ? null : Math.min(100, Math.round((u.used / u.quota) * 100))
            const barW = pct === null ? 0 : pct
            const barC = pct !== null && pct > 90 ? 'var(--warn-fg)' : 'var(--emph)'
            return `<tr>
              <td class="chk"><span class="cb"></span></td>
              <td><span class="cell-name"><b>${u.name}</b><small>${u.display} · #${u.id}</small></span></td>
              <td>${u.st === 'ok' ? badge('ok', '正常') : badge('off', '已停用')}</td>
              <td class="num">${unlimited ? '不限' : '$' + u.quota.toFixed(2)}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <span class="bar" style="flex:1;height:5px;border-radius:999px;background:var(--muted);overflow:hidden">
                    <i style="display:block;height:100%;width:${barW}%;background:${barC}"></i>
                  </span>
                  <span class="muted" style="font-size:11.5px;width:38px;text-align:right">${pct === null ? '—' : pct + '%'}</span>
                </div>
              </td>
              <td class="muted">${u.group}</td>
              <td class="muted">${u.role}</td>
              <td class="muted mono">${u.last}</td>
              <td class="act"><button class="icon-btn">⋯</button></td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>
    ${pager(1, 5, 1204)}
  </section>`

/* ---------- 订阅 ---------- */
PAGES.subscription = () => `
  ${pageHead('订阅', PAGE_META.subscription.desc,
    `<button class="btn btn-ghost">订阅记录</button><button class="btn btn-primary">新建计划</button>`)}
  <section class="panel">
    ${toolbar('<div style="display:flex;gap:2px;padding:2px;background:var(--muted);border-radius:10px">' +
      '<button class="btn btn-sm btn-primary">计划</button><button class="btn btn-sm">订阅者</button></div>',
      `<button class="icon-btn" title="刷新">⟳</button>`)}
    <div class="tscroll">
      <table>
        <thead><tr><th>计划</th><th class="num">价格</th><th>周期</th><th>包含</th>
          <th class="num">订阅人数</th><th>状态</th><th class="act">操作</th></tr></thead>
        <tbody>
          ${D.plans.map((p) => `<tr>
            <td><b style="font-weight:500">${p.name}</b></td>
            <td class="num">${p.price}</td><td class="muted">${p.period}</td>
            <td class="muted">${p.quota}</td>
            <td class="num">${p.users}</td>
            <td>${p.st === 'ok' ? badge('ok', '在售') : badge('off', '已下架')}</td>
            <td class="act"><button class="icon-btn">⋯</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${pager(1, 4, 4)}
  </section>`

/* ---------- 系统设置 ---------- */
PAGES.settings = () => {
  const boards = ['站点', '认证与注册', '计费与额度', '内容审核', '运维', '请求策略', '安全', '模型']
  return `
  ${pageHead('系统设置', PAGE_META.settings.desc,
    `<span class="meta-note"><span class="dot"></span> 有未保存的更改</span>
     <button class="btn btn-ghost">重置</button><button class="btn btn-primary" data-toast="已保存">保存</button>`)}
  <div class="settings">
    <div class="board-nav">
      ${boards.map((b, i) => `<div class="board ${i === 0 ? 'on' : ''}">${b}</div>
        ${i === 0 ? `<div class="board-sub">
          <a class="on">基础信息</a><a>外观</a><a>公告</a><a>页脚</a></div>` : ''}`).join('')}
    </div>
    <div class="form">
      <section class="form-sec">
        <h3 class="sec-title">基础信息</h3>
        <p class="sec-desc">这些信息会出现在浏览器标题、登录页与页脚。</p>
        <div class="field"><label>站点名称 <span style="color:var(--bad-fg)">*</span></label>
          <div class="input focus">New API Lite</div></div>
        <div class="row2">
          <div class="field"><label>站点地址</label><div class="input">https://api.example.com</div>
            <div class="hint">用于生成回调与邮件中的链接</div></div>
          <div class="field"><label>联系邮箱</label><div class="input">hi@example.com</div></div>
        </div>
        <div class="field"><label>站点公告</label>
          <div class="input ta">本周六 02:00 进行数据库维护，预计影响 10 分钟。</div>
          <div class="hint">支持 Markdown，留空则不展示公告条</div></div>
      </section>
      <section class="form-sec">
        <h3 class="sec-title">注册控制</h3>
        <p class="sec-desc">关闭后新用户只能由管理员创建。</p>
        <div class="switch-row"><div><b>允许邮箱注册</b><small>关闭后注册页仍可访问，但提交会被拒绝</small></div>
          <span class="switch on"></span></div>
        <div class="switch-row"><div><b>开启人机验证</b><small>建议在公开可访问的站点上开启</small></div>
          <span class="switch"></span></div>
        <div class="switch-row"><div><b>新用户默认分组</b><small>影响首次调用时的计费倍率</small></div>
          <div style="width:200px"><div class="input" style="height:32px">default</div></div></div>
      </section>
    </div>
  </div>`
}

/* ============================================================
   5. 渠道编辑抽屉
   ============================================================ */
function channelDrawer() {
  return `
  <div class="drawer-head">
    <div><h2>编辑渠道</h2><small>deepseek-v3 · #17</small></div>
    <div style="margin-left:auto"><button class="icon-btn" data-close="1">✕</button></div>
  </div>
  <div class="drawer-body">
    <section class="dsec">
      <div class="dsec-head"><span class="no">01</span><b>基础与接入</b></div>
      <div class="dsec-body">
        <div class="row2">
          <div class="field"><label>供应商</label>
            <div class="input" style="justify-content:space-between">OpenAI 兼容 <span class="caret">▾</span></div>
            <div class="hint">决定 Base URL 的拼接规则</div></div>
          <div class="field"><label>渠道名称 <span style="color:var(--bad-fg)">*</span></label>
            <div class="input">deepseek-v3</div></div>
        </div>
        <div class="field"><label>Base URL</label>
          <div class="input mono">https://api.deepseek.com</div>
          <div class="hint">不要带结尾 /v1，路径由网关拼接</div></div>
        <div class="row2">
          <div class="field"><label>API 密钥 <span style="color:var(--bad-fg)">*</span></label>
            <div class="input" style="justify-content:space-between"><span class="mono">sk-••••••••4f2a</span>
              <span style="font-size:12px;color:var(--muted-fg);cursor:pointer">显示</span></div></div>
          <div class="field"><label>测试</label>
            <div style="display:flex;gap:8px"><button class="btn btn-ghost btn-sm" data-toast="连通正常 · 820ms">测试连通</button></div></div>
        </div>
      </div>
    </section>

    <section class="dsec">
      <div class="dsec-head"><span class="no">02</span><b>模型映射</b><span class="tail">12 个模型</span></div>
      <div class="dsec-body">
        <div class="block">
          <div class="block-head"><span class="dot"></span><b>映射规则</b>
            <span class="tail" style="margin-left:auto;font-size:11px;color:var(--muted-fg)">已配置</span></div>
          <div class="map-row"><div class="mini">deepseek-chat</div><div class="map-arrow">→</div>
            <div class="mini">deepseek-v3</div><div style="text-align:center;color:var(--muted-fg)">✕</div></div>
          <div class="map-row"><div class="mini">deepseek-reasoner</div><div class="map-arrow">→</div>
            <div class="mini">deepseek-r1</div><div style="text-align:center;color:var(--muted-fg)">✕</div></div>
          <div style="display:flex;gap:8px;margin-top:4px">
            <button class="btn btn-ghost btn-sm">添加映射</button>
            <button class="btn btn-ghost btn-sm">批量导入</button>
            <span style="margin-left:auto;align-self:center;font-size:11px;color:var(--muted-fg)">共 12 条，另有 10 条折叠</span>
          </div>
        </div>
        <div class="row2">
          <div class="field"><label>分组</label><div class="input">默认, vip</div></div>
          <div class="field"><label>优先级 / 权重</label>
            <div style="display:flex;gap:8px"><div class="input" style="flex:1;text-align:right">10</div>
              <div class="input" style="flex:1;text-align:right">5</div></div></div>
        </div>
      </div>
    </section>

    <section class="dsec">
      <div class="dsec-head"><span class="no">03</span><b>高级</b><span class="tail">已配置 3 项</span></div>
      <div class="dsec-body">
        <div class="field"><label>系统提示词</label>
          <div class="input ta">You are a helpful assistant.</div></div>
        <div class="field"><label>代理地址</label>
          <div class="input mono">http://127.0.0.1:7890</div></div>
        <div class="switch-row"><div><b>透传请求参数</b><small>把客户端原始参数原样转发上游</small></div>
          <span class="switch on"></span></div>
      </div>
    </section>
  </div>
  <div class="drawer-foot">
    <span style="font-size:12px;color:var(--muted-fg);display:flex;align-items:center;gap:6px">
      <span class="dot"></span>有未保存的更改</span>
    <span class="spacer"></span>
    <button class="btn btn-ghost" data-close="1">取消</button>
    <button class="btn btn-primary" data-toast="已保存（演示）">保存</button>
  </div>`
}

/* ============================================================
   6. 渲染与路由
   ============================================================ */
function canSee(item) {
  if (!item.minRole) return true
  return ROLE_RANK[state.role] >= ROLE_RANK[item.minRole]
}

function renderNav() {
  const nav = $('#nav')
  nav.innerHTML = NAV.map((sec) => {
    if (sec.minRole && ROLE_RANK[state.role] < ROLE_RANK[sec.minRole]) return ''
    const items = sec.items.filter(canSee)
    if (!items.length) return ''
    return `<div class="nav-group"><div class="nav-label">${sec.label}</div>
      ${items.map((it) => `<a class="nav-item ${state.page === it.id ? 'active' : ''}" data-go="${it.id}">
        <i>${ico(it.icon)}</i>${it.label}</a>`).join('')}
    </div>`
  }).join('')

  const r = ROLES[state.role]
  $('#userName').textContent = r.name
  $('#userRole').textContent = r.label
  $('#avatar').textContent = r.avatar
}

function render() {
  const meta = PAGE_META[state.page] || PAGE_META.dashboard
  $('#crumbSec').textContent = meta.sec
  $('#crumbCur').textContent = meta.title
  document.title = meta.title + ' · new-api 控制台设计稿'

  const allowed = state.page === 'dashboard' ||
    NAV.some((s) => (!s.minRole || ROLE_RANK[state.role] >= ROLE_RANK[s.minRole]) &&
      s.items.some((i) => i.id === state.page && canSee(i)))

  const content = $('#content')
  if (!allowed) {
    content.innerHTML = `<div class="forbidden">
      <h2>当前角色无权访问</h2>
      <p>「${meta.title}」仅对${state.page === 'settings' ? '超级管理员' : '管理员及以上'}开放。
         这是设计稿在演示角色权限：切回有权限的角色即可看到该页面。</p>
      <button class="btn btn-primary" data-go="dashboard">回到数据看板</button>
    </div>`
  } else {
    const view = document.createElement('div')
    view.className = 'page' + (meta.scroll ? ' page-scroll' : '')
    view.innerHTML = (PAGES[state.page] || PAGES.dashboard)()
    content.replaceChildren(view)
  }
  renderNav()
  const hint = $('#hint')
  if (hint) hint.textContent = state.role === 'user'
    ? '普通用户看不到管理区'
    : state.role === 'admin' ? '管理员没有系统设置' : '超级管理员可见全部'
}

function go(page) {
  state.page = page
  if (location.hash !== '#/' + page) history.replaceState(null, '', '#/' + page)
  render()
}

function setRole(role) {
  state.role = role
  state.scope = 'mine'
  document.querySelectorAll('[data-role]').forEach((b) =>
    b.classList.toggle('on', b.getAttribute('data-role') === role))
  // 不自动退回看板：无权限时渲染说明页，正好用来演示角色差异
  render()
}

let toastTimer
function toast(msg) {
  const t = $('#toast')
  t.textContent = msg
  t.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => t.classList.remove('show'), 1900)
}

/* ---------- 事件 ---------- */
document.addEventListener('click', (e) => {
  const roleBtn = e.target.closest('[data-role]')
  if (roleBtn) return setRole(roleBtn.getAttribute('data-role'))

  const goEl = e.target.closest('[data-go]')
  if (goEl) { setNav(false); return go(goEl.getAttribute('data-go')) }

  const scopeEl = e.target.closest('[data-scope]')
  if (scopeEl) { state.scope = scopeEl.getAttribute('data-scope'); return render() }

  const drawerEl = e.target.closest('[data-drawer]')
  if (drawerEl) {
    $('#drawer').innerHTML = channelDrawer()
    $('#scrim').classList.add('open')
    return
  }
  if (e.target.closest('[data-close]') || e.target.id === 'scrim') {
    $('#scrim').classList.remove('open')
    return
  }
  const t = e.target.closest('[data-toast]')
  if (t) toast(t.getAttribute('data-toast'))
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    $('#scrim').classList.remove('open')
    setNav(false)
  }
})

/* 移动端导航抽屉 */
function setNav(open) {
  document.querySelector('.sidebar').classList.toggle('open', open)
  $('#navVeil').classList.toggle('open', open)
}
$('#navBtn').addEventListener('click', () => setNav(true))
$('#navVeil').addEventListener('click', () => setNav(false))
window.addEventListener('resize', () => { if (innerWidth > 900) setNav(false) })

$('#themeBtn').addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  $('#themeBtn').textContent = next === 'dark' ? '浅色' : '深色'
  render()
})

window.addEventListener('hashchange', () => {
  const h = (location.hash || '').replace('#/', '').replace('#', '')
  if (h && PAGE_META[h] && h !== state.page) { state.page = h; render() }
})

/* ---------- 启动 ---------- */
const hash = (location.hash || '').replace('#/', '').replace('#', '')
const roleParam = new URLSearchParams(location.search).get('role')
if (hash && PAGE_META[hash]) state.page = hash
if (roleParam && ROLES[roleParam]) state.role = roleParam
if (location.search.includes('dark')) {
  document.documentElement.setAttribute('data-theme', 'dark')
  $('#themeBtn').textContent = '浅色'
}
setRole(state.role)
