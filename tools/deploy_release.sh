#!/usr/bin/env bash
set -euo pipefail

# Compila em um worktree limpo e troca apenas o artefato pronto. O processo
# atual continua atendendo durante npm ci, testes e build. Nao aplica schema:
# qualquer prisma db push continua exigindo backup, restore testado e revisao.
DEPLOY_REPO_ROOT="${DEPLOY_REPO_ROOT:-$(git rev-parse --show-toplevel)}"
DEPLOY_APP_ROOT="${DEPLOY_APP_ROOT:-$DEPLOY_REPO_ROOT}"
DEPLOY_RELEASES_ROOT="${DEPLOY_RELEASES_ROOT:-$HOME/sistema-laudemir-releases}"
DEPLOY_PM2_APP="${DEPLOY_PM2_APP:-sistema-laudemir}"
DEPLOY_HEALTH_URL="${DEPLOY_HEALTH_URL:-http://127.0.0.1:3001/api/health}"
DEPLOY_COMMIT="$(git -C "$DEPLOY_REPO_ROOT" rev-parse HEAD)"
DEPLOY_SHORT_COMMIT="$(git -C "$DEPLOY_REPO_ROOT" rev-parse --short HEAD)"
DEPLOY_STAMP="$(date +%Y%m%d_%H%M%S)"
DEPLOY_RELEASE_DIR="$DEPLOY_RELEASES_ROOT/$DEPLOY_SHORT_COMMIT-$DEPLOY_STAMP"
DEPLOY_NEXT_STAGE="$DEPLOY_APP_ROOT/.next.release-$DEPLOY_SHORT_COMMIT-$DEPLOY_STAMP"
DEPLOY_NEXT_PREVIOUS="$DEPLOY_APP_ROOT/.next.previous-$DEPLOY_STAMP"
DEPLOY_SW_PREVIOUS="$DEPLOY_RELEASE_DIR/sw.previous.js"

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck source=/dev/null
  source "$HOME/.nvm/nvm.sh"
  nvm use 22 >/dev/null
fi

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "[deploy] Node 20+ obrigatorio; encontrado $(node --version)" >&2
  exit 1
fi

mkdir -p "$DEPLOY_RELEASES_ROOT"
test ! -e "$DEPLOY_RELEASE_DIR"
test ! -e "$DEPLOY_NEXT_STAGE"
test ! -e "$DEPLOY_NEXT_PREVIOUS"

echo "[deploy] preparando revisao $DEPLOY_SHORT_COMMIT em $DEPLOY_RELEASE_DIR"
git -C "$DEPLOY_REPO_ROOT" worktree add --detach "$DEPLOY_RELEASE_DIR" "$DEPLOY_COMMIT"
if [ -f "$DEPLOY_APP_ROOT/.env" ]; then
  cp "$DEPLOY_APP_ROOT/.env" "$DEPLOY_RELEASE_DIR/.env"
fi

cd "$DEPLOY_RELEASE_DIR"
npm ci
npx prisma generate
npm test
npm run build
test -f "$DEPLOY_RELEASE_DIR/.next/BUILD_ID"

# O Next iniciado pelo PM2 resolve dependencias a partir da raiz ativa. Mantem
# o node_modules dessa raiz exatamente igual ao usado no build validado.
cd "$DEPLOY_APP_ROOT"
npm ci
npx prisma generate

cp -a "$DEPLOY_RELEASE_DIR/.next" "$DEPLOY_NEXT_STAGE"
test -f "$DEPLOY_NEXT_STAGE/BUILD_ID"
cp "$DEPLOY_APP_ROOT/public/sw.js" "$DEPLOY_SW_PREVIOUS"
mv "$DEPLOY_APP_ROOT/.next" "$DEPLOY_NEXT_PREVIOUS"
mv "$DEPLOY_NEXT_STAGE" "$DEPLOY_APP_ROOT/.next"
cp "$DEPLOY_RELEASE_DIR/public/sw.js" "$DEPLOY_APP_ROOT/public/sw.js"

rollback_release() {
  echo "[deploy] verificacao falhou; restaurando build anterior" >&2
  if [ -d "$DEPLOY_APP_ROOT/.next" ] && [ -d "$DEPLOY_NEXT_PREVIOUS" ]; then
    mv "$DEPLOY_APP_ROOT/.next" "$DEPLOY_APP_ROOT/.next.failed-$DEPLOY_STAMP"
    mv "$DEPLOY_NEXT_PREVIOUS" "$DEPLOY_APP_ROOT/.next"
  fi
  cp "$DEPLOY_SW_PREVIOUS" "$DEPLOY_APP_ROOT/public/sw.js"
  pm2 restart "$DEPLOY_PM2_APP" --update-env
}

if ! pm2 restart "$DEPLOY_PM2_APP" --update-env; then
  rollback_release
  exit 1
fi

DEPLOY_HEALTHY=0
for _attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "$DEPLOY_HEALTH_URL" >/dev/null; then
    DEPLOY_HEALTHY=1
    break
  fi
  sleep 2
done

if [ "$DEPLOY_HEALTHY" -ne 1 ]; then
  rollback_release
  exit 1
fi

echo "[deploy] revisao $DEPLOY_SHORT_COMMIT publicada e saudavel"
echo "[deploy] rollback preservado em $DEPLOY_NEXT_PREVIOUS"
