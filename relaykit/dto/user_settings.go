package dto

type UserSetting struct {
	RecordIpLog       bool   `json:"record_ip_log,omitempty"`      // 是否记录请求和错误日志IP
	SidebarModules    string `json:"sidebar_modules,omitempty"`    // SidebarModules 左侧边栏模块配置
	BillingPreference string `json:"billing_preference,omitempty"` // BillingPreference 扣费策略（订阅/钱包）
	Language          string `json:"language,omitempty"`           // Language 用户语言偏好 (zh, en)
}
