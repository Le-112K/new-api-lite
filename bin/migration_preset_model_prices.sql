-- 站点改为按次计费后不再预置任何模型价格：
-- 接入上游渠道后的模型几乎都处于未定价状态，内置默认价既不会被用到，
-- 又会让「未设置价格的模型」列表凭空多出一批与本站无关的条目。
--
-- 这里清掉历史上随上游默认值写进 options 的 ModelPrice 条目，
-- 只保留管理员在设置页显式配置过的单次价格。
-- 幂等：重复执行不会影响管理员已配置的价格（这些键不在预置名单里）。
--
-- 名单刻意排除 deepseek-flash / deepseek-v4-pro：它们是渠道 7「魔搭」在售的
-- 模型，默认价虽然也是上游带来的，但站点真的在用。按次计费不读倍率，
-- 删掉它们的价格会让这两个模型变成「未配置价格」而直接调用失败。
--
-- 必须用 jsonb_each 而不是 jsonb_each_text：后者会把所有值转成字符串，
-- 存回去就变成 {"model":"0.01"}，后端解析 map[string]float64 会直接报错
-- （cannot unmarshal string into Go value of type float64），
-- 结果是整张价格表加载失败、所有模型都变成「未配置价格」。

UPDATE options
SET value = (
    SELECT COALESCE(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)::text
    FROM jsonb_each(value::jsonb) AS entry
    WHERE entry.key <> ALL (ARRAY[
        'black-forest-labs/flux-1.1-pro',
        'dall-e-3',
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
)::text
WHERE key = 'ModelPrice';

-- 修复早期版本用 jsonb_each_text 造成的值类型退化为字符串。
-- 幂等：已经是数字的值原样转回数字，不变。
-- jsonb 的字符串要先用 #>> '{}' 取出裸文本再转 numeric（直接 ::numeric 会失败）。
UPDATE options
SET value = (
    SELECT COALESCE(
        jsonb_object_agg(
            entry.key,
            CASE
                WHEN jsonb_typeof(entry.value) = 'string'
                    THEN to_jsonb((entry.value #>> '{}')::numeric)
                ELSE entry.value
            END
        ),
        '{}'::jsonb
    )::text
    FROM jsonb_each(value::jsonb) AS entry
)::text
WHERE key = 'ModelPrice'
  AND EXISTS (
      SELECT 1
      FROM jsonb_each(value::jsonb) AS probe
      WHERE jsonb_typeof(probe.value) = 'string'
  );
