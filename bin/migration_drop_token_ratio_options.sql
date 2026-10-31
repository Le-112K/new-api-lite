-- 清理 token 计费时代遗留的倍率配置行。
--
-- 站点已改为「只按调用次数计费」，这 6 个键对应的配置项在后端
-- (setting/ratio_setting、model/option.go) 与前端 (BillingSettings) 里都已删除，
-- 属于无人读取的僵尸数据。
--
-- 安全性：生产 options 里这 6 行不包含任何在售模型（deepseek-v4-* /
-- glm-5-3-flash-* / zai-org/GLM-5.2 / deepseek-flash / deepseek-v4-pro），
-- 上游默认倍率表里同样没有这些模型，因此删除前后这些模型的倍率都取同一个
-- 兜底值 —— 旧镜像重启也不会改变计费行为。

DELETE FROM options
WHERE key IN (
    'CompletionRatio',
    'CacheRatio',
    'CreateCacheRatio',
    'ImageRatio',
    'AudioRatio',
    'AudioCompletionRatio'
);
