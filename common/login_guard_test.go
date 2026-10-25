package common

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestLoginGuardLocksAtThresholdAndClears(t *testing.T) {
	previousRedis := RedisEnabled
	RedisEnabled = false
	t.Cleanup(func() {
		RedisEnabled = previousRedis
		ClearLoginFailures("guard-test")
	})

	for i := 0; i < LoginFailureThreshold-1; i++ {
		NoteLoginFailure("guard-test")
	}
	assert.False(t, IsLoginLockedOut("guard-test"))

	NoteLoginFailure("guard-test")
	assert.True(t, IsLoginLockedOut("guard-test"))

	ClearLoginFailures("guard-test")
	assert.False(t, IsLoginLockedOut("guard-test"))
}

func TestLoginGuardExpiresWindow(t *testing.T) {
	previousRedis := RedisEnabled
	RedisEnabled = false
	t.Cleanup(func() {
		RedisEnabled = previousRedis
		loginFailureMu.Lock()
		delete(loginFailureCache, "guard-expired")
		loginFailureMu.Unlock()
	})

	for i := 0; i < LoginFailureThreshold; i++ {
		NoteLoginFailure("guard-expired")
	}
	assert.True(t, IsLoginLockedOut("guard-expired"))

	loginFailureMu.Lock()
	entry := loginFailureCache["guard-expired"]
	entry.expiresAt = time.Now().Add(-time.Second)
	loginFailureCache["guard-expired"] = entry
	loginFailureMu.Unlock()

	assert.False(t, IsLoginLockedOut("guard-expired"))
}
