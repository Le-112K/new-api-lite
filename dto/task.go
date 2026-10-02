package dto

// TaskError is the error envelope used by the relay task infrastructure.
// After the task plugin system was removed, only the Midjourney proxy and
// relay-common utilities still reference this type.
type TaskError struct {
	Code       string `json:"code"`
	Message    string `json:"message"`
	StatusCode int    `json:"-"`
	LocalError bool   `json:"-"`
	NoRetry    bool   `json:"-"`
	Error      error  `json:"-"`
}
