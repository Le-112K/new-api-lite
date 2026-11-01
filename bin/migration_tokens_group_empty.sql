-- 令牌分组统一清空：分组改由账户订阅决定，令牌不再携带。
--
-- 背景：此前令牌可以单独指定分组，导致两个问题
--   1. 升级后旧令牌仍停在旧分组，用户必须重建令牌才能用到新档位
--   2. 低档账户把令牌指向高档分组即可越权（已由鉴权侧堵住，但数据侧也该收敛）
--
-- 清空后令牌分组为空 = 请求时按 users.group 实时解析，升级/续费/到期都自动跟随。
-- 幂等：重复执行不产生变化。
--
-- 执行前请确认已备份 tokens 表：
--   pg_dump -t tokens > tokens-before-group-cleanup.sql

UPDATE tokens
SET "group" = ''
WHERE "group" IS NOT NULL
  AND "group" <> '';

-- 回读：按分组统计剩余情况，期望只剩空分组一行
SELECT COALESCE(NULLIF("group", ''), '<empty>') AS token_group, COUNT(*) AS cnt
FROM tokens
WHERE deleted_at IS NULL
GROUP BY 1
ORDER BY 2 DESC;
