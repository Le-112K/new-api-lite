-- 火山方舟（Volcano Ark）渠道配置
--
-- 用法：把 <ARK_API_KEY> 换成你的 API Key 后执行，然后重启服务并在管理界面点"测试"验证。
--
-- 为什么渠道类型是 Custom(8) 而不是 OpenAI：
--   火山方舟的 OpenAI 兼容端点是 /api/v3/chat/completions，不是 /v1/chat/completions。
--   OpenAI 类型的请求 URL 是「base_url + 客户端路径」，客户端路径带 /v1，
--   拼出来是 /api/v3/v1/chat/completions，上游返回 404。
--   Custom 类型的 GetRequestURL 直接返回 base_url、不做拼接，
--   所以 base_url 要填完整的接口地址。

WITH new_channel AS (
    INSERT INTO channels (type, key, name, base_url, models, "group", status, priority, created_time, auto_ban)
    VALUES (
        8,                                              -- Custom
        '<ARK_API_KEY>',                                -- 火山方舟 API Key
        '火山方舟',
        'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        'deepseek-v4-flash-ga-260731,deepseek-v4-pro-ga-260813,deepseek-v4-1-flash-260910,glm-5-3-flash-260828',
        'default',
        1,                                              -- 启用
        0,
        EXTRACT(EPOCH FROM NOW())::bigint,
        1
    )
    RETURNING id
)
INSERT INTO abilities ("group", model, channel_id, enabled, priority, weight)
SELECT 'default', m.model, c.id, true, 0, 0
FROM new_channel c,
     (VALUES ('deepseek-v4-flash-ga-260731'),
             ('deepseek-v4-pro-ga-260813'),
             ('deepseek-v4-1-flash-260910'),
             ('glm-5-3-flash-260828')) AS m(model);

-- ── 注意事项 ────────────────────────────────────────────────
-- 1) abilities 表建立「分组 × 模型 × 渠道」映射。缺了它，请求会报
--    "分组 default 下模型 X 无可用渠道"，即使 channels 里有记录也没用。
--    通过管理界面添加渠道时 new-api 会自动维护（AddAbilities / UpdateAbilities）；
--    用 SQL 手动插入则必须自己补，且每个模型一条记录。
--
-- 2) abilities 在容器重启时加载。用 SQL 插入后需要重启服务才生效；
--    通过界面添加则会自动 InitChannelCache()，立即生效。
--
-- 3) 管理界面的「从上游同步模型」按钮对本渠道无效：该功能在代码里强制走
--    advancedcustom 适配器（controller/channel_upstream_update.go），
--    而 Custom 渠道没有配置 advanced_routes。模型请手动填写。
--
-- 4) 豆包系列（doubao-seed-* 等）不支持直接用模型名调用，需要在火山方舟
--    控制台创建「接入点」，然后把接入点 ID（ep-xxx）当作模型名填入，
--    否则返回 404。
--
-- 5) deepseek 模型默认输出思考过程（reasoning_content），会占用 max_tokens。
--    若客户端设置的输出上限偏小，可能只收到思考而没有正文，这不是故障。
--
-- 6) 可用模型以上游 /api/v3/models 为准（共 135 个，其中 35 个状态可用）。
--    下面这条可列出当前可用（未下线）的模型：
--      curl -s -H "Authorization: Bearer <ARK_API_KEY>" \
--        https://ark.cn-beijing.volces.com/api/v3/models
