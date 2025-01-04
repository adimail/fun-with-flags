package internals

import (
	"log"
	"net/http"
)

// Logging middleware
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// capture the status code
		ww := &statusCodeResponseWriter{ResponseWriter: w}
		next.ServeHTTP(ww, r)
		log.Printf("Status: %d, Route: %s, Method: %s\n", ww.statusCode, r.URL.Path, r.Method)
	})
}

// Custom ResponseWriter to capture the status code
type statusCodeResponseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (w *statusCodeResponseWriter) WriteHeader(statusCode int) {
	w.statusCode = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}
