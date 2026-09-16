// Package db contiene le migrazioni SQL del database, incluse nel binario.
package db

import "embed"

// Migrations contiene i file SQL in formato goose, applicati in ordine di versione (00001, 00002, ...).
//
//go:embed migrations/*.sql
var Migrations embed.FS
