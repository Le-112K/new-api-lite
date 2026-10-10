package common

import (
	"fmt"
	"strconv"
	"strings"
)

// ValidateNumericCode validates the shape of a six-digit verification code and
// returns it without whitespace. Shared by email binding and other code flows
// that deliver a numeric code out of band.
func ValidateNumericCode(code string) (string, error) {
	code = strings.ReplaceAll(code, " ", "")
	if len(code) != 6 {
		return "", fmt.Errorf("验证码必须是6位数字")
	}
	if _, err := strconv.Atoi(code); err != nil {
		return "", fmt.Errorf("验证码只能包含数字")
	}
	return code, nil
}
