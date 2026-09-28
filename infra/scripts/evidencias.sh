#!/usr/bin/env bash
# Genera las evidencias 200 / 401 / 429 en docs/evidencias/ (texto, con fecha).
# Uso: GATEWAY=http://localhost:8080 KEY=demo-key bash infra/scripts/evidencias.sh
# Ejecutar con el gateway recién levantado: el 429 consume el cupo de 30/min.
set -u
GATEWAY="${GATEWAY:-http://localhost:8080}"
KEY="${KEY:-demo-key}"
OUT="$(dirname "$0")/../../docs/evidencias"
mkdir -p "$OUT"

{ echo "# $(date -Is)  GET $GATEWAY/cat/health (con clave)"; curl -s -i -H "Ocp-Apim-Subscription-Key: $KEY" "$GATEWAY/cat/health"; echo; } > "$OUT/200-con-clave.txt"
{ echo "# $(date -Is)  GET $GATEWAY/cat/grupos (sin clave)"; curl -s -i "$GATEWAY/cat/grupos"; echo; } > "$OUT/401-sin-clave.txt"
{
  echo "# $(date -Is)  rafaga de 40 GET $GATEWAY/cat/grupos"
  for i in $(seq 1 40); do
    printf '%02d -> ' "$i"; curl -s -o /dev/null -w '%{http_code}\n' -H "Ocp-Apim-Subscription-Key: $KEY" "$GATEWAY/cat/grupos"
  done
} > "$OUT/429-rafaga.txt"
echo "Resumen ráfaga: $(grep -c ' 429$' "$OUT/429-rafaga.txt") respuestas 429 de 40"
