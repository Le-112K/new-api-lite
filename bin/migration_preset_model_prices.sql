-- 站点改为按次计费后不再预置任何模型价格：
-- 接入上游渠道后的模型几乎都处于未定价状态，内置默认价既不会被用到，
-- 又会让「未设置价格的模型」列表凭空多出一批与本站无关的条目。
--
-- 这里清掉历史上随上游默认值写进 options 的 ModelPrice 条目，
-- 只保留管理员在设置页显式配置过的单次价格。
-- 幂等：重复执行不会影响管理员已配置的价格（这些键不在预置名单里）。

UPDATE options
SET value = (
    SELECT COALESCE(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)::text
    FROM jsonb_each_text(value::jsonb) AS entry
    WHERE entry.key <> ALL (ARRAY[
        'black-forest-labs/flux-1.1-pro',
        'dall-e-3',
        'deepseek-flash',
        'deepseek-v4-pro',
        'gpt-4-gizmo-*',
        'gpt-4o-mini-tts',
        'imagen-3.0-generate-002',
        'sora-2',
        'sora-2-pro',
        'suno_lyrics',
        'suno_music',
        'veo-3.0-fast-generate-001',
        'veo-3.0-generate-001',
        'veo-3.1-fast-generate-preview',
        'veo-3.1-generate-preview'
    ])
)
WHERE key = 'ModelPrice';
