-- flatkey.ai 上游接入配置
--
-- 用法：在生产库执行，然后重启服务（abilities 重启时加载；option 也会被加载，
-- 且 SyncOptions 周期同步，不重启最终也会生效，但建议重启一次让两者同时就位）。
--
--    ssh vps 'docker exec -i postgres psql -U root -d new-api' < docs/flatkey-channel.sql
--
-- 为什么渠道类型是 OpenAI(1) 而不是新适配器：
--   flatkey 是 OpenAI 兼容网关（/v1/models 正常，返回 300+ 模型）。
--   OpenAI 类型的请求 URL 是「base_url + 客户端路径」，客户端路径带 /v1，
--   所以 base_url 填不带尾 /v1 的 https://router.flatkey.ai，
--   chat 面拼出 /v1/chat/completions、responses 面拼出 /v1/responses。
--
-- 为什么 gpt-6-luna 要开 chat→responses 转换（本脚本的核心）：
--   gpt-6-luna 的 chat 面上 tools 与 reasoning 不可兼得——带 tools 时必须
--   reasoning_effort=none，传 high 直接 400（Zcode 复现）；且 chat 面不认
--   reasoning 对象参数（Deepseek 桌面端复现 400 unknown_parameter）。
--   而 /v1/responses 面上 tools + reasoning 可共存（实测 200），
--   new-api 的 ChatCompletionsToResponsesPolicy 正好把该渠道的 gpt-6-luna
--   请求转成 responses 面发出，两个客户端的报错同时解决。
--   deepseek-v4-1-flash 在 chat 面完全宽松（tools/reasoning 都收），
--   不匹配模型正则，走原路径，不受影响。
--
-- 为什么要配 param_override 删 temperature/top_p：
--   gpt-6-luna 两个面都只在「显式 reasoning effort=none」时接受采样参数，
--   其余情况（effort=high、或不带 reasoning 字段）一律 400
--   unsupported_parameter。new-api 的能力剥离逻辑只作用于 chat 面路径，
--   转换路径不剥，故用渠道参数覆盖补齐：仅当请求最终不会带上
--   reasoning.effort=none 时删除 temperature/top_p（条件取反涵义：
--   三个 reasoning 字段均缺失或均不为 none 时才删）。

DO $$
DECLARE
    new_channel_id int;
BEGIN
    INSERT INTO channels (type, key, name, base_url, models, "group", status, priority, created_time, auto_ban, param_override)
    VALUES (
        1,                                          -- OpenAI
        'sk-7QFU2vIqbiNU5oE4iRXfzyPc6CMNUb0nyt2BUYG8zxrkQSBK',
        'flatkey',
        'https://router.flatkey.ai',                -- 不带尾 /v1
        'gpt-6-luna,deepseek-v4-1-flash',
        'default',
        1,                                          -- 启用
        0,
        EXTRACT(EPOCH FROM NOW())::bigint,
        1,
        -- 采样参数剥离：仅对 gpt-6-luna，且仅在请求未显式关闭推理时生效
        '{"operations":[
          {"path":"temperature","mode":"delete","logic":"AND","conditions":[
            {"path":"model","mode":"full","value":"gpt-6-luna"},
            {"path":"reasoning_effort","mode":"full","value":"none","invert":true},
            {"path":"reasoning.effort","mode":"full","value":"none","invert":true},
            {"path":"reasoning.enabled","mode":"full","value":false,"invert":true}
          ]},
          {"path":"top_p","mode":"delete","logic":"AND","conditions":[
            {"path":"model","mode":"full","value":"gpt-6-luna"},
            {"path":"reasoning_effort","mode":"full","value":"none","invert":true},
            {"path":"reasoning.effort","mode":"full","value":"none","invert":true},
            {"path":"reasoning.enabled","mode":"full","value":false,"invert":true}
          ]}
        ]}'
    )
    RETURNING id INTO new_channel_id;

    -- abilities 建立「分组 × 模型 × 渠道」映射，每个模型一条；
    -- 缺了它请求会报「分组 default 下模型 X 无可用渠道」。
    INSERT INTO abilities ("group", model, channel_id, enabled, priority, weight)
    VALUES ('default', 'gpt-6-luna',        new_channel_id, true, 0, 0),
           ('default', 'deepseek-v4-1-flash', new_channel_id, true, 0, 0);

    -- chat→responses 转换策略：仅对该渠道的 gpt-6-luna 生效。
    -- 键为「配置模块名.json 字段名」，由 handleConfigUpdate 载入
    -- model_setting.GlobalSettings.ChatCompletionsToResponsesPolicy。
    -- channel_types 留空——类型 1 是所有 OpenAI 渠道共用的，按类型开会误伤其他渠道。
    INSERT INTO options (key, value)
    VALUES (
        'global.chat_completions_to_responses_policy',
        json_build_object(
            'enabled',        true,
            'all_channels',   false,
            'channel_ids',    json_build_array(new_channel_id),
            'model_patterns', json_build_array('^gpt-6-luna$')
        )::text
    )
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

    RAISE NOTICE 'flatkey channel id: %', new_channel_id;
END $$;

-- ── 注意事项 ────────────────────────────────────────────────
-- 1) 模型价格 / 倍率 / 分组 Ratio 不随本脚本设置，属于运营日常配置，
--    在管理界面「模型价格」里按需补（两模型默认按 default 组计费）。
--
-- 2) 该策略按渠道 ID 绑定。若日后删除并重建 flatkey 渠道，channel_ids 会失效，
--    gpt-6-luna 将回落 chat 面（tools 场景 400）。重建渠道后需同步更新：
--      UPDATE options SET value = json_build_object(...) WHERE key = 'global.chat_completions_to_responses_policy';
--
-- 3) gpt-6-luna 的思考内容对客户端不可见：responses 面只返回加密的
--    encrypted_content（无法解密），chat 面连这个都没有。usage 中正常计
--    reasoning_tokens。deepseek-v4-1-flash 正常返回 reasoning_content。
--
-- 4) chat→responses 转换的既有缺口（所有渠道通用，非 flatkey 特有）：
--    stop / seed / logprobs 不被映射（静默丢弃）；n>1 直接报错。
--
-- 5) flatkey 网关偶发瞬时 400（new_api_error: invalid JSON request body，
--    重试即成功），new-api 默认不重试 4xx，客户端会看到偶发失败。
--
-- 6) 「从上游获取模型」对本渠道有效（OpenAI 类型在 MODEL_FETCHABLE_TYPES 内），
--    上游 /v1/models 返回 300+ 模型，可按需添加到渠道模型列表。
--
-- 7) 回滚：删除渠道 → DELETE FROM channels WHERE name = 'flatkey';
--          删除 abilities → DELETE FROM abilities WHERE channel_id = <上一步的 id>;
--          恢复策略 → DELETE FROM options WHERE key = 'global.chat_completions_to_responses_policy';
--          然后重启。
