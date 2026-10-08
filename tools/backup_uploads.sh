#!/usr/bin/env bash
set -euo pipefail

# Copia anexos para a nuvem sem remover nada do servidor nem do destino.
# Pode ser executado pelo cron: o flock impede duas sincronizacoes simultaneas.
UPLOAD_DIR="${UPLOAD_DIR:-$HOME/sistema-laudemir-uploads}"
RCLONE_BIN="${RCLONE_BIN:-$HOME/bin/rclone}"
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive:fotos-laudemir/}"
LOCK_FILE="${LOCK_FILE:-$HOME/sistema-laudemir-cron/backup_uploads.lock}"

if [ ! -d "$UPLOAD_DIR" ]; then
  echo "[uploads] diretorio nao encontrado: $UPLOAD_DIR" >&2
  exit 1
fi

if [ ! -x "$RCLONE_BIN" ]; then
  echo "[uploads] rclone nao encontrado: $RCLONE_BIN" >&2
  exit 1
fi

mkdir -p "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[uploads] outra sincronizacao ainda esta em andamento"
  exit 0
fi

echo "[uploads] $(date -Is) iniciando copia para $RCLONE_REMOTE"
"$RCLONE_BIN" copy "$UPLOAD_DIR" "$RCLONE_REMOTE" \
  --create-empty-src-dirs \
  --checkers 8 \
  --transfers 4 \
  --retries 3 \
  --low-level-retries 10

# Confirma que todos os arquivos locais existem no destino. --one-way evita
# considerar como erro arquivos antigos que existam apenas no backup remoto.
"$RCLONE_BIN" check "$UPLOAD_DIR" "$RCLONE_REMOTE" --one-way --size-only
echo "[uploads] $(date -Is) copia e verificacao concluidas"
