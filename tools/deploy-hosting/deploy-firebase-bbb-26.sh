#!/usr/bin/env bash
set -e

# Fluxo oficial do Hosting: monorepo admin-bbb26-next → tools/bbb-hosting/public
# (não usar outro clone só com pasta public desatualizada.)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🚀 Deploy Firebase Hosting (bbb-26)"
echo "📂 Repo: $REPO_ROOT"
echo "Início: $(date)"
echo "--------------------------------"

node "$SCRIPT_DIR/ensure-app-version-manifest.cjs" "$REPO_ROOT"

cd "$REPO_ROOT/tools/bbb-hosting"

if [ ! -d "public" ]; then
  echo "❌ Pasta public não encontrada"
  exit 1
fi

echo "📝 Versionando dados..."
DEPLOY_AT=$(TZ=America/Sao_Paulo date -Iseconds)
VERSION=$(TZ=America/Sao_Paulo date +"%Y%m%d-%H%M%S")
echo "{\"deployAt\": \"$DEPLOY_AT\", \"version\": \"$VERSION\"}" > public/_deploy.json

echo "📦 Versão: $VERSION"

npx firebase-tools deploy --only hosting --project bbb-26

echo "--------------------------------"
echo "✅ Fim: $(date)"