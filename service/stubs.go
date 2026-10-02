package service

import (
	"context"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// resolveTokenKey returns the API key string for a token ID.
// Originally part of the task plugin system, now simplified to use cache directly.
func resolveTokenKey(_ context.Context, tokenId int, _ string) string {
	token, err := model.GetCacheToken(tokenId)
	if err != nil || token == nil {
		return ""
	}
	return token.Key
}

// AppendTaskPluginContextAuditInfo is a no-op stub.
// Task plugin system was removed in 二开精简.
func AppendTaskPluginContextAuditInfo(_ *gin.Context, _ *model.LogOther) {
	// no-op
}
