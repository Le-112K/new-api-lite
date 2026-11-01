-- 分组改名：default → free
--
-- 目的：免费档在数据库里也使用 free 这个标识，与产品表述、订阅档位序列
-- （free < vip < svip）完全一致，不再依赖代码里的 default 别名。
--
-- 涉及三处：
--   abilities.group  —— 模型挂在哪个分组（决定调用鉴权与渠道匹配）
--   channels.group   —— 渠道服务哪些分组，逗号分隔多值，必须按 token 精确替换
--   users.group      —— 账号当前档位
--
-- 幂等：重复执行不产生变化。
-- 执行前备份：abilities / channels / users 三张表。

BEGIN;

-- 1) 模型归属
UPDATE abilities
SET "group" = 'free'
WHERE "group" = 'default';

-- 2) 渠道：按逗号拆分逐段替换，避免 LIKE 误伤（例如 mydefault 之类的自定义名）
UPDATE channels
SET "group" = (
    SELECT string_agg(
               CASE WHEN trim(seg) = 'default' THEN 'free' ELSE trim(seg) END,
               ',' ORDER BY ord
           )
    FROM unnest(string_to_array("group", ',')) WITH ORDINALITY AS t(seg, ord)
)
WHERE 'default' = ANY (string_to_array("group", ','));

-- 3) 账号档位
UPDATE users
SET "group" = 'free'
WHERE "group" = 'default';

-- 4) 回退分组可见性配置：模型列表两处都全量展示，调用时才鉴权，
--    这套「低档看不到高档分组」的规则已无使用场景。
DELETE FROM options WHERE key = 'GroupSpecialUsableGroup';

COMMIT;

-- 回读：三处分组分布，期望只剩 free / vip（以及可能的历史自定义分组）
SELECT 'abilities' AS table_name, "group", COUNT(*) AS cnt FROM abilities GROUP BY 2
UNION ALL
SELECT 'channels', "group", COUNT(*) FROM channels GROUP BY 2
UNION ALL
SELECT 'users', "group", COUNT(*) FROM users WHERE deleted_at IS NULL GROUP BY 2
ORDER BY 1, 2;
