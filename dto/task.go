package dto

// TaskError is the error envelope used by the relay task infrastructure. It is
// shared by the relay-common utilities that still handle task-style endpoints.
type TaskError struct {
	Code       string `json:"code"`
	Message    string `json:"message"`
	StatusCode int    `json:"-"`
	LocalError bool   `json:"-"`
	NoRetry    bool   `json:"-"`
	Error      error  `json:"-"`
}
