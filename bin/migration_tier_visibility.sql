-- 订阅档位的分组可见性：低档账户不得看到/选择更高档分组。
--
-- 为什么是扁平 key：updateOptionMap 只识别无点号的扁平键与下划线命名，
-- group_ratio_setting 这种整体键不会被处理（SplitN 拿不到点号直接返回），
-- 所以可见性必须单独用一个键，由 option.go 的 case 分支落到
-- ratio_setting.UpdateGroupSpecialUsableGroupByJSONString。
--
-- 作用点有两处（同一份配置）：
--   1. GET /api/user/groups —— 决定令牌创建页能看到哪些分组
--   2. middleware/auth.go 校验令牌分组时调用的 GetUserUsableGroups
-- 因此配好之后，Free 账户即使直接调 API 传 group=vip 也会被 403 拒绝。
--
-- 语义：`-:<group>` 表示从该用户分组的可选列表里移除；`+:<group>` 表示追加。
-- 幂等：重复执行结果相同。
INSERT INTO options (key, value)
VALUES (
    'GroupSpecialUsableGroup',
    '{"default":{"-:vip":"","-:svip":""},"vip":{"-:svip":""}}'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 清掉早期误写的整体键（该键不会被读取，留着只会误导排查）。
DELETE FROM options WHERE key = 'group_ratio_setting';

SELECT key, value FROM options WHERE key = 'GroupSpecialUsableGroup';
