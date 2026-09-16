// Package logx collega un logger strutturato (slog) al contesto di una richiesta,
// così ogni riga di log porta con sé l'ID della richiesta.
package logx

import (
	"context"
	"log/slog"
)

type ctxKey struct{}

// With restituisce un contesto che contiene il logger indicato.
func With(ctx context.Context, logger *slog.Logger) context.Context {
	return context.WithValue(ctx, ctxKey{}, logger)
}

// From restituisce il logger del contesto, o quello predefinito se manca.
func From(ctx context.Context) *slog.Logger {
	if logger, ok := ctx.Value(ctxKey{}).(*slog.Logger); ok {
		return logger
	}
	return slog.Default()
}
