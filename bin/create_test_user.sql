-- 创建一个用于订阅档位测试的普通用户。
-- 幂等：已存在则跳过，不会覆盖既有账号。
--
-- 分组固定为 free：新账号即免费档，与注册流程一致。
INSERT INTO users (username, password, display_name, role, status, email, quota, "group")
SELECT
    'testuser',
    '$argon2id$v=19$m=19456,t=2,p=1$xDfGmXRVhA84ZQy92rMqFQ$kLc8HLPib5CKpZeKF73V7ivMhI64BL9t7EElDYj1BZE',
    '测试用户',
    1,
    1,
    '',
    500000,
    'free'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'testuser');

-- 回读确认：密码哈希与分组
SELECT id, username, display_name, role, status, quota, "group",
       left(password, 20) || '...' AS password_prefix
FROM users WHERE username = 'testuser';
