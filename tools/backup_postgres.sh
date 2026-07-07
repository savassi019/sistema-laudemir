#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${CONTAINER:-sistema-laudemir-db-1}"
DB_NAME="${DB_NAME:-gestao_modular}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/sistema-laudemir-backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="$BACKUP_DIR/${DB_NAME}_${STAMP}.sql.gz"

echo "[backup] $(date -Is) iniciando dump de $DB_NAME..."
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$OUT_FILE"
echo "[backup] $(date -Is) salvo em $OUT_FILE"

find "$BACKUP_DIR" -type f -name "${DB_NAME}_*.sql.gz" -mtime +"$KEEP_DAYS" -delete
echo "[backup] $(date -Is) concluido."
