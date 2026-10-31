-- auto 分组顺序机制已移除：不再支持 token.group = 'auto'。
--
-- 移除后，group='auto' 的令牌会在鉴权阶段被拒绝：
-- 先撞「auto 不在用户可用分组列表」→ 403「无权访问 auto 分组」；
-- 即便管理员把 auto 加进 UserUsableGroups，也会撞
-- 「auto 不在定价分组表」→ 403「分组 auto 已被弃用」。
--
-- 正确语义是「跟随账户分组」= token.group 留空。这与 auto 在只有单一分组时
-- 的等价行为一致，且会在订阅升降级时自动跟随。
--
-- 生产环境当前 0 条 group='auto'，本脚本用于其他环境或历史备份恢复后的兜底。
-- 幂等：重复执行不产生变化。

UPDATE tokens
SET "group" = ''
WHERE "group" = 'auto';

-- 两个字段已无业务读写，统一复位，避免审计/导出里出现误导性的历史值。
-- 数据库列本身保留：token_cache.go 用位置索引写 Redis，删列会让缓存错位。
UPDATE tokens
SET cross_group_retry = false
WHERE cross_group_retry = true;

UPDATE tokens
SET auto_groups = ''
WHERE auto_groups IS NOT NULL
  AND auto_groups <> '';
