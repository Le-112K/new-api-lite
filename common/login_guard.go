package common

import (
	"context"
	"sync"
	"time"
)

// Root username sign-in is the one path that can be attacked by guessing a
// username, so failures are counted per identifier. The window is short and the
// cap is low; a successful sign-in clears the counter.
const (
	LoginFailureThreshold = 5
	LoginFailureWindow    = 15 * time.Minute
)

const loginFailureKeyPrefix = "loginFail:v1:"

var (
	loginFailureMu    sync.Mutex
	loginFailureCache = map[string]loginFailureEntry{}
)

type loginFailureEntry struct {
	count     int64
	expiresAt time.Time
}

func loginFailureRedisKey(key string) string {
	return loginFailureKeyPrefix + key
}

// IsLoginLockedOut reports whether this identifier has reached the failure cap.
// Redis is used when available so the cap holds across instances; otherwise an
// in-process window keeps single-instance deployments protected.
func IsLoginLockedOut(key string) bool {
	if key == "" {
		return false
	}
	if RedisEnabled && RDB != nil {
		value, err := RDB.Get(context.Background(), loginFailureRedisKey(key)).Int64()
		if err != nil {
			return false
		}
		return value >= LoginFailureThreshold
	}

	loginFailureMu.Lock()
	defer loginFailureMu.Unlock()
	entry, ok := loginFailureCache[key]
	if !ok {
		return false
	}
	if time.Now().After(entry.expiresAt) {
		delete(loginFailureCache, key)
		return false
	}
	return entry.count >= LoginFailureThreshold
}

// NoteLoginFailure records one failed attempt for this identifier.
func NoteLoginFailure(key string) {
	if key == "" {
		return
	}
	if RedisEnabled && RDB != nil {
		ctx := context.Background()
		redisKey := loginFailureRedisKey(key)
		count, err := RDB.Incr(ctx, redisKey).Result()
		if err != nil {
			return
		}
		if count == 1 {
			RDB.Expire(ctx, redisKey, LoginFailureWindow)
		}
		return
	}

	now := time.Now()
	loginFailureMu.Lock()
	defer loginFailureMu.Unlock()
	entry, ok := loginFailureCache[key]
	if !ok || now.After(entry.expiresAt) {
		entry = loginFailureEntry{expiresAt: now.Add(LoginFailureWindow)}
	}
	entry.count++
	loginFailureCache[key] = entry
}

// ClearLoginFailures resets the counter after a successful sign-in.
func ClearLoginFailures(key string) {
	if key == "" {
		return
	}
	if RedisEnabled && RDB != nil {
		RDB.Del(context.Background(), loginFailureRedisKey(key))
		return
	}
	loginFailureMu.Lock()
	delete(loginFailureCache, key)
	loginFailureMu.Unlock()
}
