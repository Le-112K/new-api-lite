package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
)

func Cache() func(c *gin.Context) {
	return func(c *gin.Context) {
		uri := c.Request.RequestURI
		switch {
		case uri == "/":
			// The shell has to revalidate: it is what points at the hashed
			// asset names, so caching it would pin clients to an old build.
			c.Header("Cache-Control", "no-cache")
		case strings.HasPrefix(uri, "/static/"):
			// Everything under /static carries a content hash in its name, so a
			// rebuild produces a new URL. Making it immutable removes the
			// conditional revalidation that used to run once a week per file.
			c.Header("Cache-Control", "public, max-age=31536000, immutable")
		default:
			c.Header("Cache-Control", "max-age=604800") // one week
		}
		c.Header("Cache-Version", "b688f2fb5be447c25e5aa3bd063087a83db32a288bf6a4f35f2d8db310e40b14")
		c.Next()
	}
}
