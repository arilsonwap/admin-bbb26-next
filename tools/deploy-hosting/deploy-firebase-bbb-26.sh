#!/usr/bin/env bash
set -e

echo "🚀 Deploy Firebase Hosting (bbb-26)"
echo "Início: $(date)"
echo "--------------------------------"

cd "$(dirname "$0")/../bbb-hosting"

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