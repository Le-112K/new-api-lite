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
    key: 'ops', label: '运营', minRole: 'admin',
    items: [
      { id: 'today', label: '今日', icon: 'dashboard' },
      { id: 'channels', label: '上游', icon: 'channels' },
      { id: 'models', label: '模型', icon: 'models' }
    ]
  },
  {
    key: 'mine', label: '我的',
    items: [
      { id: 'keys', label: '密钥', icon: 'key' },
      { id: 'logs', label: '用量', icon: 'logs' },
      { id: 'account', label: '账号', icon: 'profile' }
    ]
  },
  {
    key: 'admin', label: '管理', minRole: 'admin',
    items: [
      { id: 'users', label: '用户', icon: 'users' },
      { id: 'settings', label: '设置', icon: 'settings', minRole: 'root' }
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
  today: { sec: '运营', title: '今日', desc: '今天要你处理的事，外加三个数字', scroll: true },
  channels: { sec: '运营', title: '上游', desc: '接了谁、谁还活着、能用哪些模型' },
  models: { sec: '运营', title: '模型', desc: '开放哪些模型、给谁用、每百万 token 多少钱' },
  keys: { sec: '我的', title: '密钥', desc: '创建与吊销调用凭证，设置额度与过期时间' },
  logs: { sec: '我的', title: '用量', desc: '用了多少、还剩多少、每一笔花在哪' },
  account: { sec: '我的', title: '账号', desc: '资料、密码与登录设备' },
  users: { sec: '管理', title: '用户', desc: '账号、额度、分组与角色' },
  settings: { sec: '管理', title: '设置', desc: '站点、注册、计费、请求、安全、运维' }
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

/* ---------- 今日 ---------- */
PAGES.today = () => {
  const queue = [
    { t: 'bad', what: 'claude-sonnet 上游返回 401', note: '已自动下线 12 分钟 · 影响 4 个模型', act: '去处理', go: 'channels' },
    { t: 'warn', what: '7 个模型还没定价', note: '来自 siliconflow、火山方舟', act: '去定价', go: 'models' },
    { t: 'warn', what: '密钥「CI 流水线」今天用掉 92%', note: '额度 $50.00 · 已用 $46.00', act: '查看', go: 'users' },
    { t: 'info', what: '上游新增 12 个模型待启用', note: 'deepseek-v3 一带新增 3 个', act: '去启用', go: 'models' }
  ]
  return `
  ${pageHead('今日', PAGE_META.today.desc,
    `<div class="segmented" role="group" aria-label="数据范围">
       <button data-scope="mine" aria-pressed="${state.scope === 'mine'}">我的</button>
       <button data-scope="all" aria-pressed="${state.scope === 'all'}">全站</button>
     </div>`)}
  <div class="grid-cards">
    <div class="stat"><div class="k">在线上游</div><div class="v">5<small>/6</small></div>
      <div class="d" style="color:var(--bad-fg)">1 个已自动下线</div></div>
    <div class="stat"><div class="k">今日请求</div><div class="v">284 916</div><div class="d up">较昨日 +9.8%</div></div>
    <div class="stat"><div class="k">失败率</div><div class="v">0.42<small>%</small></div><div class="d down">较昨日 −0.11%</div></div>
    <div class="stat"><div class="k">待处理</div><div class="v">4</div><div class="d">2 项已超过 1 天</div></div>
  </div>

  <section class="panel panel-auto" style="margin-top:16px">
    <div class="dash-head"><h3>需要你处理</h3><span class="tail">按影响排序</span></div>
    <div class="tscroll">
      <table class="dense">
        <thead><tr><th style="width:88px">类型</th><th>事项</th><th>说明</th><th class="act">操作</th></tr></thead>
        <tbody>
          ${queue.map((q) => `<tr>
            <td>${badge(q.t, q.t === 'bad' ? '故障' : q.t === 'warn' ? '待办' : '提醒')}</td>
            <td><b style="font-weight:500">${q.what}</b></td>
            <td class="muted">${q.note}</td>
            <td class="act"><button class="link-btn" data-go="${q.go}">${q.act}</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </section>

  <section class="panel panel-auto" style="margin-top:16px">
    <div class="dash-head"><h3>最近调用</h3><span class="more" data-go="logs">查看全部 →</span></div>
    <div class="tscroll">
      <table class="dense">
        <thead><tr><th>时间</th><th>模型</th><th>密钥</th><th class="num">耗时</th><th class="num">消耗</th><th>状态</th></tr></thead>
        <tbody>
          ${D.recent.slice(0, 5).map((r) => `<tr>
            <td class="muted mono">${r.t}</td><td>${r.model}</td><td class="muted">${r.key}</td>
            <td class="num mono">${r.ms}ms</td><td class="num mono">${r.cost}</td>
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

/* ---------- 用量（调用记录 / 消费明细 / 兑换码 / 审计，四页合一） ---------- */
PAGES.logs = () => {
  const isAdmin = state.role !== 'user'
  return `
  ${pageHead('用量', PAGE_META.logs.desc, `<button class="btn btn-ghost">导出 CSV</button>`)}
  <div class="grid-cards" style="margin-bottom:16px">
    <div class="stat"><div class="k">当前余额</div><div class="v">$48.20</div><div class="d">有效期至 12-31</div></div>
    <div class="stat"><div class="k">今日消耗</div><div class="v">$1.84</div><div class="d up">较昨日 +6.1%</div></div>
    <div class="stat"><div class="k">今日请求</div><div class="v">1 284</div><div class="d down">成功率 99.6%</div></div>
    <div class="stat"><div class="k">今日额度</div><div class="v">不限</div><div class="d">按量扣减 · 次日 00:00 重置</div></div>
  </div>

  <section class="panel">
    <div class="toolbar" style="border-bottom:1px solid var(--border)">
      <div class="segmented" role="group">
        <button data-tab="logs:calls" aria-pressed="true">调用记录</button>
        <button data-tab="logs:spend" aria-pressed="false">消费明细</button>
        <button data-tab="logs:redeem" aria-pressed="false">兑换码</button>
        ${isAdmin ? '<button data-tab="logs:audit" aria-pressed="false">审计</button>' : ''}
      </div>
      <span class="spacer" style="flex:1"></span>
      <button class="icon-btn" title="刷新">⟳</button>
    </div>

    <div data-pane="logs:calls">
      ${toolbar(searchBox('搜索模型或请求 ID') +
        `<button class="pill">时间 <span class="caret">▾</span></button>
         <button class="pill">模型 <span class="caret">▾</span></button>
         <button class="pill">状态 <span class="caret">▾</span></button>`, '')}
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
    </div>

    <div data-pane="logs:spend" hidden>
      ${toolbar(searchBox('搜索模型'), `<button class="pill">近 7 天 <span class="caret">▾</span></button>`)}
      <div class="tscroll">
        <table>
          <thead><tr><th>模型</th><th class="num">请求</th><th class="num">输入 token</th><th class="num">输出 token</th><th class="num">消耗</th></tr></thead>
          <tbody>
            ${[
              ['deepseek-v3', '6 402', '4 812 300', '1 208 640', '$12.84'],
              ['gpt-4o', '1 284', '802 100', '146 900', '$9.32'],
              ['claude-sonnet-4', '312', '204 800', '88 200', '$8.76'],
              ['qwen-max', '2 048', '1 460 000', '402 800', '$3.12'],
              ['gpt-4o-mini', '9 214', '6 802 000', '1 902 400', '$2.28']
            ].map((r) => `<tr>
              <td><b style="font-weight:500">${r[0]}</b></td>
              <td class="num">${r[1]}</td><td class="num muted">${r[2]}</td>
              <td class="num muted">${r[3]}</td><td class="num">${r[4]}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${pager(1, 5, 42)}
    </div>

    <div data-pane="logs:redeem" hidden>
      <div class="toolbar" style="border-bottom:1px solid var(--border)">
        <div class="field" style="margin:0;flex:1;max-width:420px">
          <div class="input" style="height:36px">输入兑换码，例如 napi-7QK2-9FDM-3XT8</div>
        </div>
        <button class="btn btn-primary btn-sm" data-toast="兑换成功，+$10.00">兑换</button>
        <span class="spacer" style="flex:1"></span>
        <span class="meta-note">没有在线支付时，这是唯一的自助充值方式</span>
      </div>
      <div class="tscroll">
        <table>
          <thead><tr><th>兑换码</th><th class="num">面额</th><th>状态</th><th>使用者</th><th>时间</th></tr></thead>
          <tbody>
            ${D.redeem.map((r) => `<tr>
              <td class="mono">${r.code}</td>
              <td class="num">${r.quota}</td>
              <td>${r.st === 'used' ? badge('off', '已使用') : badge('ok', '未使用')}</td>
              <td class="muted">${r.by}</td><td class="muted">${r.at}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${pager(1, 5, 50)}
    </div>

    <div data-pane="logs:audit" hidden>
      ${toolbar(searchBox('搜索操作人或对象'),
        `<button class="pill">操作类型 <span class="caret">▾</span></button>`)}
      <div class="tscroll">
        <table>
          <thead><tr><th>时间</th><th>操作人</th><th>动作</th><th>对象</th><th>来源 IP</th><th>结果</th></tr></thead>
          <tbody>
            ${[
              ['10-17 22:04', 'alice', '修改上游', 'deepseek-v3 (#17)', '203.0.113.24', 'ok'],
              ['10-17 21:36', 'alice', '禁用用户', 'carol (#1004)', '203.0.113.24', 'ok'],
              ['10-17 20:12', 'Le', '修改设置', '注册控制 / 允许邮箱注册', '198.51.100.7', 'ok'],
              ['10-17 18:48', 'alice', '生成兑换码', '50 张 · $10', '203.0.113.24', 'ok'],
              ['10-17 17:02', 'alice', '删除上游', 'old-relay (#9)', '203.0.113.51', 'bad']
            ].map((r) => `<tr>
              <td class="muted mono">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td>
              <td class="muted">${r[3]}</td><td class="muted mono">${r[4]}</td>
              <td>${r[5] === 'ok' ? badge('ok', '成功') : badge('bad', '失败')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${pager(1, 5, 86)}
    </div>
  </section>`
}

/* ---------- 账号（资料 / 密码与设备，两页合一） ---------- */
PAGES.account = () => `
  ${pageHead('账号', PAGE_META.account.desc,
    `<span class="meta-note"><span class="dot"></span> 有未保存的更改</span>
     <button class="btn btn-ghost">重置</button><button class="btn btn-primary" data-toast="已保存">保存</button>`)}
  <section class="panel">
    <div class="toolbar" style="border-bottom:1px solid var(--border)">
      <div class="segmented" role="group">
        <button data-tab="acct:info" aria-pressed="true">基本资料</button>
        <button data-tab="acct:sec" aria-pressed="false">密码与设备</button>
      </div>
    </div>

    <div data-pane="acct:info">
      <div class="form" style="padding:20px 20px 24px;max-width:720px">
        <section class="form-sec">
          <h3 class="sec-title">基本资料</h3>
          <p class="sec-desc">昵称会显示在用量报表里，邮箱用于接收额度提醒。</p>
          <div class="row2">
            <div class="field"><label>昵称</label><div class="input">bob</div></div>
            <div class="field"><label>显示名</label><div class="input focus">Bob Li</div></div>
          </div>
          <div class="field"><label>邮箱</label><div class="input">bob@example.com</div>
            <div class="hint">修改邮箱需要验证当前密码</div></div>
        </section>
        <section class="form-sec">
          <h3 class="sec-title">调用偏好</h3>
          <p class="sec-desc">只影响你自己发起的请求。</p>
          <div class="row2">
            <div class="field"><label>默认模型</label>
              <div class="input" style="justify-content:space-between">deepseek-v3 <span class="caret">▾</span></div></div>
            <div class="field"><label>默认分组</label>
              <div class="input" style="justify-content:space-between">default <span class="caret">▾</span></div></div>
          </div>
          <div class="switch-row"><div><b>额度不足时提醒</b><small>余额低于 $5 时发邮件</small></div>
            <span class="switch on"></span></div>
        </section>
      </div>
    </div>

    <div data-pane="acct:sec" hidden>
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
          <h3 class="sec-title">登录设备</h3>
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
    </div>
  </section>`

/* ---------- 渠道 ---------- */
PAGES.channels = () => `
  ${pageHead('上游', PAGE_META.channels.desc,
    `<button class="btn btn-ghost">测试全部</button>
     <button class="btn btn-primary" data-drawer="channel">新建上游</button>`)}
  <section class="panel">
    ${toolbar(searchBox('搜索名称、ID 或模型') +
      `<button class="pill">协议 <span class="caret">▾</span></button>
       <button class="pill">状态 <span class="caret">▾</span></button>`,
      `<button class="icon-btn" title="选择">☑</button>
       <button class="icon-btn" title="列设置">▥</button>
       <button class="icon-btn" title="刷新">⟳</button>`)}
    <div class="tscroll">
      <table>
        <thead><tr>
          <th class="chk"><span class="cb mix"></span></th>
          <th>名称</th><th>协议</th><th>谁能用</th><th class="num">模型</th>
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
  ${pageHead('模型', PAGE_META.models.desc,
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
          <th class="num">今日调用</th><th class="act">操作</th>
        </tr></thead>
        <tbody>
          ${D.models.map((m, i) => `<tr class="${i === 0 ? 'sel' : ''}">
            <td class="chk"><span class="cb ${i === 0 ? 'on' : ''}"></span></td>
            <td><b style="font-weight:500">${m.name}</b>${m.tag ? ' ' + badge(m.tag === '未定价' ? 'warn sm' : 'info sm', m.tag) : ''}</td>
            <td class="muted">${m.mode}</td>
            <td class="num"><span class="price-edit">${m.in}</span></td><td class="num"><span class="price-edit">${m.out}</span></td>
            <td class="num muted">${['12 480', '3 214', '842', '—', '6 902', '4 118', '802', '21 406'][i]}</td>
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

/* ---------- 设置（6 页，不再是三层树） ---------- */
PAGES.settings = () => `
  ${pageHead('设置', PAGE_META.settings.desc,
    `<span class="meta-note"><span class="dot"></span> 有未保存的更改</span>
     <button class="btn btn-ghost">重置</button><button class="btn btn-primary" data-toast="已保存">保存</button>`)}
  <section class="panel">
    <div class="toolbar" style="border-bottom:1px solid var(--border)">
      <div class="segmented" role="group">
        <button data-tab="set:site" aria-pressed="true">站点</button>
        <button data-tab="set:signup" aria-pressed="false">注册与登录</button>
        <button data-tab="set:billing" aria-pressed="false">计费</button>
        <button data-tab="set:relay" aria-pressed="false">请求</button>
        <button data-tab="set:sec" aria-pressed="false">安全</button>
        <button data-tab="set:ops" aria-pressed="false">运维</button>
      </div>
    </div>

    <div data-pane="set:site">
      <div class="form" style="padding:20px 20px 24px;max-width:720px">
        <section class="form-sec">
          <h3 class="sec-title">站点</h3>
          <p class="sec-desc">装站时配一次，之后基本不再动。</p>
          <div class="field"><label>站点名称</label><div class="input focus">New API Lite</div></div>
          <div class="row2">
            <div class="field"><label>站点地址</label><div class="input">https://api.example.com</div>
              <div class="hint">用于回调与邮件里的链接</div></div>
            <div class="field"><label>联系邮箱</label><div class="input">hi@example.com</div></div>
          </div>
          <div class="field"><label>站点公告</label>
            <div class="input ta">本周六 02:00 维护，预计影响 10 分钟。</div>
            <div class="hint">留空则不展示公告条</div></div>
          <div class="field"><label>页脚</label><div class="input">© 2026 New API Lite</div></div>
        </section>
      </div>
    </div>

    <div data-pane="set:signup" hidden>
      <div class="form" style="padding:20px 20px 24px;max-width:720px">
        <section class="form-sec">
          <h3 class="sec-title">谁能进来</h3>
          <p class="sec-desc">公开可访问的站点务必开启人机验证。</p>
          <div class="switch-row"><div><b>允许邮箱注册</b><small>关闭后新用户只能由管理员创建</small></div>
            <span class="switch on"></span></div>
          <div class="switch-row"><div><b>人机验证</b><small>Turnstile，拦截脚本注册</small></div>
            <span class="switch on"></span></div>
          <div class="switch-row"><div><b>GitHub 登录</b><small>已配置 Client ID</small></div>
            <span class="switch on"></span></div>
        </section>
        <section class="form-sec">
          <h3 class="sec-title">新用户默认</h3>
          <div class="row2">
            <div class="field"><label>默认分组</label>
              <div class="input" style="justify-content:space-between">default <span class="caret">▾</span></div></div>
            <div class="field"><label>初始额度</label><div class="input">$1.00</div>
              <div class="hint">防止注册即刷空上游</div></div>
          </div>
        </section>
      </div>
    </div>

    <div data-pane="set:billing" hidden>
      <div class="form" style="padding:20px 20px 24px;max-width:720px">
        <section class="form-sec">
          <h3 class="sec-title">计费口径</h3>
          <p class="sec-desc">模型单价在「模型」页直接改，这里只管全局口径。</p>
          <div class="row2">
            <div class="field"><label>额度单位</label>
              <div class="input" style="justify-content:space-between">美元 ($) <span class="caret">▾</span></div></div>
            <div class="field"><label>显示精度</label>
              <div class="input" style="justify-content:space-between">2 位小数 <span class="caret">▾</span></div></div>
          </div>
          <div class="field"><label>分组倍率</label>
            <div class="input">default 1.0 · vip 1.2 · svip 1.5</div>
            <div class="hint">按模型单价乘以倍率扣费</div></div>
        </section>
        <section class="form-sec">
          <h3 class="sec-title">充值</h3>
          <div class="switch-row"><div><b>在线支付（易支付）</b><small>未开启时用户只能用兑换码</small></div>
            <span class="switch"></span></div>
          <div class="switch-row"><div><b>兑换码</b><small>允许管理员生成、用户自助兑换</small></div>
            <span class="switch on"></span></div>
        </section>
      </div>
    </div>

    <div data-pane="set:relay" hidden>
      <div class="form" style="padding:20px 20px 24px;max-width:720px">
        <section class="form-sec">
          <h3 class="sec-title">请求与重试</h3>
          <p class="sec-desc">默认值适用于绝大多数上游，改之前想清楚。</p>
          <div class="row2">
            <div class="field"><label>失败重试次数</label><div class="input">2</div></div>
            <div class="field"><label>单次超时（秒）</label><div class="input">300</div></div>
          </div>
          <div class="row2">
            <div class="field"><label>连续失败几次自动下线</label><div class="input">5</div>
              <div class="hint">下线后 60 秒自动探测恢复</div></div>
            <div class="field"><label>健康检查间隔（秒）</label><div class="input">60</div></div>
          </div>
        </section>
      </div>
    </div>

    <div data-pane="set:sec" hidden>
      <div class="form" style="padding:20px 20px 24px;max-width:720px">
        <section class="form-sec">
          <h3 class="sec-title">限流</h3>
          <p class="sec-desc">保护上游的免费配额，不是限制付费用户。</p>
          <div class="row2">
            <div class="field"><label>单密钥每分钟请求</label><div class="input">60</div></div>
            <div class="field"><label>单密钥每日 token</label><div class="input">2 000 000</div></div>
          </div>
        </section>
        <section class="form-sec">
          <h3 class="sec-title">出站安全</h3>
          <div class="switch-row"><div><b>禁止访问内网地址</b><small>固定开启，不提供关闭开关</small></div>
            <span class="switch on" style="opacity:.5;pointer-events:none"></span></div>
        </section>
      </div>
    </div>

    <div data-pane="set:ops" hidden>
      <div class="form" style="padding:20px 20px 24px;max-width:720px">
        <section class="form-sec">
          <h3 class="sec-title">日志与告警</h3>
          <div class="row2">
            <div class="field"><label>日志保留天数</label><div class="input">30</div></div>
            <div class="field"><label>告警邮箱</label><div class="input">ops@example.com</div></div>
          </div>
          <div class="switch-row"><div><b>上游下线时邮件通知</b><small>只在连续失败时发一次，不刷屏</small></div>
            <span class="switch on"></span></div>
        </section>
        <section class="form-sec">
          <h3 class="sec-title">后台任务</h3>
          <p class="sec-desc">失败会影响模型列表与定价，失败时会在「今日」页提示。</p>
          <table>
            <thead><tr><th>任务</th><th>上次运行</th><th>结果</th><th class="act">操作</th></tr></thead>
            <tbody>
              <tr><td>同步上游模型</td><td class="muted">今天 15:02</td><td>${badge('ok', '成功')}</td>
                <td class="act"><button class="link-btn">立即运行</button></td></tr>
              <tr><td>测试全部上游</td><td class="muted">今天 14:00</td><td>${badge('warn', '1 个失败')}</td>
                <td class="act"><button class="link-btn">立即运行</button></td></tr>
              <tr><td>清理旧日志</td><td class="muted">昨天 03:00</td><td>${badge('ok', '成功')}</td>
                <td class="act"><button class="link-btn">立即运行</button></td></tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  </section>`

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
          <div class="field"><label>协议</label>
            <div class="input" style="justify-content:space-between">OpenAI 兼容 <span class="caret">▾</span></div>
            <div class="hint">决定 Base URL 的拼接规则</div></div>
          <div class="field"><label>上游名称 <span style="color:var(--bad-fg)">*</span></label>
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
          <div class="field"><label>谁能用</label><div class="input">默认, vip</div></div>
          <div class="field"><label>备用顺序</label>
            <div style="display:flex;gap:8px"><div class="input" style="flex:1;text-align:right">10</div>
              <div class="input" style="flex:1;text-align:right">5</div></div></div>
        </div>
      </div>
    </section>

    <section class="dsec">
      <div class="dsec-head"><span class="no">03</span><b>高级（一般不用改）</b><span class="tail">已配置 3 项</span></div>
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
  const meta = PAGE_META[state.page] || PAGE_META.today
  $('#crumbSec').textContent = meta.sec
  $('#crumbCur').textContent = meta.title
  document.title = meta.title + ' · new-api 控制台设计稿'

  const allowed = state.page === 'today' ||
    NAV.some((s) => (!s.minRole || ROLE_RANK[state.role] >= ROLE_RANK[s.minRole]) &&
      s.items.some((i) => i.id === state.page && canSee(i)))

  const content = $('#content')
  if (!allowed) {
    content.innerHTML = `<div class="forbidden">
      <h2>当前角色无权访问</h2>
      <p>「${meta.title}」仅对${state.page === 'settings' ? '超级管理员' : '管理员及以上'}开放。
         这是设计稿在演示角色权限：切回有权限的角色即可看到该页面。</p>
      <button class="btn btn-primary" data-go="today">回到今日</button>
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
    ? '普通用户只能看到自己的三页'
    : state.role === 'admin' ? '管理员看不到设置' : '日常只需前 3 项'
}

function go(page) {
  state.page = page
  if (location.hash !== '#/' + page) history.replaceState(null, '', '#/' + page)
  render()
}

function setRole(role) {
  state.role = role
  state.scope = 'mine'
  if (!canSee({ id: state.page, minRole: PAGE_META[state.page] && PAGE_META[state.page].sec === '运营' ? 'admin'
              : state.page === 'settings' ? 'root' : undefined })) {
    state.page = role === 'user' ? 'keys' : 'today'
  }
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
function applyTab(key) {
  const group = key.split(':')[0]
  document.querySelectorAll('[data-tab]').forEach((b) => {
    if (b.getAttribute('data-tab').split(':')[0] === group) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-tab') === key))
    }
  })
  document.querySelectorAll('[data-pane]').forEach((p) => {
    if (p.getAttribute('data-pane').split(':')[0] === group) {
      p.hidden = p.getAttribute('data-pane') !== key
    }
  })
}

document.addEventListener('click', (e) => {
  const tb = e.target.closest('[data-tab]')
  if (tb) {
    applyTab(tb.getAttribute('data-tab'))
    return
  }
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

/* 深链接：?tab=logs:redeem 直接打开某一栏 */
const tabParam = new URLSearchParams(location.search).get('tab')
if (tabParam) applyTab(tabParam)
