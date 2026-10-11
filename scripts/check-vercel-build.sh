#!/usr/bin/env bash
# Compila la funzione Go come fa Vercel: il pacchetto api/ diventa "handler/api", in un modulo
# esterno a roomdate-backend. Così un import di internal/ da api/, che Vercel rifiuterebbe, si vede
# prima del deploy. Lo usano la CI e chi sviluppa: ./scripts/check-vercel-build.sh
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

mkdir -p "$work/api" "$work/backend"
tar -C "$root" -cf - go.mod go.sum api server internal shared | tar -C "$work/backend" -xf -
cp "$root/api/index.go" "$work/api/index.go"
go_version="$(sed -n 's/^go //p' "$root/go.mod")"
cat > "$work/go.mod" <<MOD
module handler

go $go_version

require roomdate-backend v0.0.0

replace roomdate-backend => ./backend
MOD
cp "$root/go.sum" "$work/go.sum"
cat > "$work/main.go" <<'MAIN'
package main

import (
	"net/http"

	handler "handler/api"
)

func main() {
	http.HandleFunc("/", handler.Handler)
}
MAIN

cd "$work"
GOFLAGS=-mod=mod go build -o /dev/null .
echo "Build della funzione Vercel riuscita"
