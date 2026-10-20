package model

import (
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestAuthFlowIsBoundAndConsumedOnce(t *testing.T) {
	truncateTables(t)

	token, created, err := CreateAuthFlow(AuthFlowCreate{
		Purpose:   AuthFlowPurposeSecurityProof,
		Provider:  "github",
		Intent:    AuthFlowIntentBind,
		UserId:    42,
		SessionId: "session-a",
		Payload:   `{"affiliate_code":"invite"}`,
		ExpiresAt: time.Now().Add(time.Minute),
	})
	require.NoError(t, err)
	require.NotEmpty(t, token)
	assert.NotEqual(t, token, created.TokenHash)

	_, err = ConsumeAuthFlow(token, AuthFlowMatch{
		Purpose:   AuthFlowPurposeSecurityProof,
		Provider:  "github",
		Intent:    AuthFlowIntentBind,
		UserId:    99,
		SessionId: "session-a",
	})
	assert.ErrorIs(t, err, ErrAuthFlowInvalid)

	peeked, err := GetAuthFlow(token, AuthFlowMatch{Purpose: AuthFlowPurposeSecurityProof, Provider: "github"})
	require.NoError(t, err)
	assert.Nil(t, peeked.ConsumedAt)

	consumed, err := ConsumeAuthFlow(token, AuthFlowMatch{
		Purpose:   AuthFlowPurposeSecurityProof,
		Provider:  "github",
		Intent:    AuthFlowIntentBind,
		UserId:    42,
		SessionId: "session-a",
	})
	require.NoError(t, err)
	require.NotNil(t, consumed.ConsumedAt)

	_, err = ConsumeAuthFlow(token, AuthFlowMatch{Purpose: AuthFlowPurposeSecurityProof})
	assert.ErrorIs(t, err, ErrAuthFlowConsumed)
}

func TestAuthFlowExpiryIsEnforced(t *testing.T) {
	truncateTables(t)

	token, flow, err := CreateAuthFlow(AuthFlowCreate{
		Purpose:   AuthFlowPurposeEmailBinding,
		UserId:    7,
		ExpiresAt: time.Now().Add(time.Minute),
	})
	require.NoError(t, err)
	require.NoError(t, DB.Model(&AuthFlow{}).Where("id = ?", flow.Id).Update("expires_at", time.Now().Add(-time.Second)).Error)

	_, err = GetAuthFlow(token, AuthFlowMatch{Purpose: AuthFlowPurposeEmailBinding})
	assert.True(t, errors.Is(err, ErrAuthFlowExpired))
	_, err = ConsumeAuthFlow(token, AuthFlowMatch{Purpose: AuthFlowPurposeEmailBinding})
	assert.True(t, errors.Is(err, ErrAuthFlowExpired))
}

func TestConsumeAuthFlowWithActionRollsBackTogether(t *testing.T) {
	truncateTables(t)
	token, _, err := CreateAuthFlow(AuthFlowCreate{
		Purpose:   AuthFlowPurposeEmailBinding,
		UserId:    42,
		SessionId: "session-a",
		ExpiresAt: time.Now().Add(time.Minute),
	})
	require.NoError(t, err)
	actionErr := errors.New("binding failed")

	_, err = ConsumeAuthFlowWithAction(token, AuthFlowMatch{
		Purpose: AuthFlowPurposeEmailBinding, UserId: 42, SessionId: "session-a",
	}, func(tx *gorm.DB, _ *AuthFlow) error {
		return actionErr
	})
	assert.ErrorIs(t, err, actionErr)

	flow, err := GetAuthFlow(token, AuthFlowMatch{Purpose: AuthFlowPurposeEmailBinding})
	require.NoError(t, err)
	assert.Nil(t, flow.ConsumedAt)
}
