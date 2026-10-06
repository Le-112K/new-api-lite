package service

import (
	"context"

	"github.com/QuantumNous/new-api/model"
)

// resolveTokenKey returns the API key string for a token ID.
func resolveTokenKey(_ context.Context, tokenId int, _ string) string {
	token, err := model.GetTokenById(tokenId)
	if err != nil || token == nil {
		return ""
	}
	return token.Key
}
