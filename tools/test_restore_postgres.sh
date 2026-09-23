#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${CONTAINER:-sistema-laudemir-db-1}"
DB_NAME="${DB_NAME:-gestao_modular}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/sistema-laudemir-backups}"
BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
  BACKUP_FILE="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "${DB_NAME}_*.sql.gz" -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-)"
fi

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "[restore-test] nenhum backup valido encontrado" >&2
  exit 1
fi

TEMP_DB="restore_check_$(date +%Y%m%d_%H%M%S)_$$"
case "$TEMP_DB" in
  restore_check_*) ;;
  *) echo "[restore-test] nome temporario inseguro" >&2; exit 1 ;;
esac

cleanup() {
  docker exec "$CONTAINER" dropdb -U "$DB_USER" --if-exists "$TEMP_DB" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[restore-test] criando banco temporario $TEMP_DB"
docker exec "$CONTAINER" createdb -U "$DB_USER" "$TEMP_DB"

echo "[restore-test] restaurando $(basename "$BACKUP_FILE")"
gzip -dc "$BACKUP_FILE" | docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$TEMP_DB" >/dev/null

TABLE_COUNT="$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$TEMP_DB" -tAc "select count(*) from information_schema.tables where table_schema = 'public';")"
if ! [[ "$TABLE_COUNT" =~ ^[0-9]+$ ]] || [ "$TABLE_COUNT" -lt 10 ]; then
  echo "[restore-test] restauracao incompleta: apenas $TABLE_COUNT tabelas" >&2
  exit 1
fi

echo "[restore-test] OK: $TABLE_COUNT tabelas restauradas e consultaveis"
echo "[restore-test] o banco temporario sera removido automaticamente"
