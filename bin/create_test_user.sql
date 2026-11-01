-- 创建一个用于订阅档位测试的普通用户。
-- 幂等：已存在则跳过，不会覆盖既有账号。
--
-- 分组用 default 而不是 free：当前生产只有 default 一个定价分组，
-- 而全局分组名是分组与渠道挂载的主键。新代码已把 default 作为 free 档的
-- 历史别名（service/subscription_tier.go），因此该用户的档位判定等价于免费用户。
-- 等正式建立 free 分组并把渠道迁过去后，再把这里改成 free。
INSERT INTO users (username, password, display_name, role, status, email, quota, "group")
SELECT
    'testuser',
    '$argon2id$v=19$m=19456,t=2,p=1$xDfGmXRVhA84ZQy92rMqFQ$kLc8HLPib5CKpZeKF73V7ivMhI64BL9t7EElDYj1BZE',
    '测试用户',
    1,
    1,
    '',
    500000,
    'default'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'testuser');

-- 回读确认：密码哈希与分组
SELECT id, username, display_name, role, status, quota, "group",
       left(password, 20) || '...' AS password_prefix
FROM users WHERE username = 'testuser';
