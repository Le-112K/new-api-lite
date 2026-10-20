package controller

import (
	"errors"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func GetVerificationMethods(c *gin.Context) {
	identity, ok := middleware.GetStepUpIdentity(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "当前认证方式不支持安全验证"})
		return
	}
	requirements, err := service.GetVerificationRequirements(identity, c.Query("scope"))
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	common.ApiSuccess(c, requirements)
}

// writeSecurityOperationError only exposes known, fixed business messages.
// Unexpected errors retain their cause for the existing server-side auth logger.
func writeSecurityOperationError(c *gin.Context, err error) {
	status := http.StatusOK
	var code, message string
	switch {
	case errors.Is(err, service.ErrAccountEmailInvalid), errors.Is(err, service.ErrAccountEmailRestricted):
		code, message = "EMAIL_ADDRESS_REJECTED", err.Error()
	case errors.Is(err, model.ErrEmailAlreadyTaken):
		code, message = "EMAIL_ALREADY_TAKEN", "This email address is already in use."
	case errors.Is(err, service.ErrEmailBindingDelivery):
		code, message = "EMAIL_BINDING_DELIVERY_FAILED", err.Error()
	case errors.Is(err, model.ErrEmailBindingCodeInvalid):
		code, message = "EMAIL_BINDING_CODE_INVALID", err.Error()
	case errors.Is(err, model.ErrEmailBindingLocked):
		code, message = "EMAIL_BINDING_LOCKED", err.Error()
	case errors.Is(err, model.ErrEmailBindingResendWait):
		status = http.StatusTooManyRequests
		code, message = "EMAIL_BINDING_RESEND_WAIT", err.Error()
	case errors.Is(err, common.ErrAccountPasswordLength), errors.Is(err, common.ErrAccountPasswordSame), errors.Is(err, common.ErrPasswordLegacyLimit):
		code, message = "PASSWORD_POLICY_REJECTED", err.Error()
	case errors.Is(err, model.ErrCurrentPasswordInvalid):
		code, message = "CURRENT_PASSWORD_INVALID", err.Error()
	case errors.Is(err, model.ErrAccountPasswordState), errors.Is(err, model.ErrAccountBindingChanged):
		status = http.StatusConflict
		code, message = "ACCOUNT_SECURITY_STATE_CHANGED", err.Error()
	case errors.Is(err, service.ErrVerificationContextInvalid):
		status = http.StatusBadRequest
		code, message = "SECURITY_CONTEXT_INVALID", service.ErrVerificationContextInvalid.Error()
	case errors.Is(err, service.ErrVerificationForbidden):
		status = http.StatusForbidden
		code, message = "SECURITY_ACTION_FORBIDDEN", service.ErrVerificationForbidden.Error()
	case errors.Is(err, service.ErrVerificationFailed):
		code, message = "SECURITY_VERIFICATION_FAILED", service.ErrVerificationFailed.Error()
	case errors.Is(err, service.ErrVerificationUnavailable):
		code, message = "SECURITY_METHOD_UNAVAILABLE", service.ErrVerificationUnavailable.Error()
	case errors.Is(err, service.ErrProofMethod):
		code, message = "SECURITY_PROOF_METHOD_MISMATCH", "This verification method is not allowed for this action."
	case errors.Is(err, service.ErrProofScope):
		code, message = "SECURITY_PROOF_SCOPE_MISMATCH", "Verification does not match this action."
	case errors.Is(err, model.ErrAuthFlowInvalid), errors.Is(err, model.ErrAuthFlowExpired), errors.Is(err, model.ErrAuthFlowConsumed):
		code, message = "AUTH_FLOW_INVALID", "Verification flow expired"
	case errors.Is(err, model.ErrUserSessionInvalid), errors.Is(err, model.ErrUserSessionInactive):
		writeAuthSessionError(c, service.ErrAuthTokenInvalid)
		return
	default:
		c.Set("security_error_code", "AUTH_INTERNAL_ERROR")
		writeAuthSessionError(c, err)
		return
	}
	c.Set("security_error_code", code)
	c.JSON(status, gin.H{"success": false, "code": code, "message": message})
}

// requireAdminUserProof consumes the step-up proof for an administrative user
// operation after the caller has already authorized the operator against the
// managed user. context is one of the service.AdminUser*Context structs.
func requireAdminUserProof(c *gin.Context, scope string, context any) *model.AuthFlowAuthorization {
	payload, err := common.Marshal(context)
	if err != nil {
		_ = c.Error(err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"success": false, "code": "AUTH_INTERNAL_ERROR", "message": "Please try again later."})
		return nil
	}
	return middleware.RequireSecurityProof(c, service.VerificationOperation{Scope: scope, Context: payload})
}

func UniversalVerify(c *gin.Context) {
	identity, ok := middleware.GetStepUpIdentity(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "当前认证方式不支持安全验证"})
		return
	}
	var request service.VerificationInput
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	proof, err := service.VerifySecurityInput(identity, request)
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	recordUserSecurityAudit(c, identity.UserID, "user.security_verify", map[string]any{"method": proof.Method, "scope": proof.Scope})
	common.ApiSuccess(c, proof)
}
