#!/usr/bin/env bash
#
# Uso LOCAL apenas: baixa .json do diretório público do admin no VPS
# para a cópia do repositório nesta máquina (rsync).
# Não execute em servidores de produção; o painel Next só dispara isso em dev.
#
set -euo pipefail

USUARIO="root"
HOST="137.184.194.31"

ORIGEM="/var/www/bbb26/admin-bbb26-next/tools/bbb-hosting/public/"
DESTINO="${HOME}/PROJETOS/admin-bbb26-next/tools/bbb-hosting/public/"

echo "Criando pasta local, se necessário..."
mkdir -p "$DESTINO"

echo "Baixando todos os JSONs do VPS..."
rsync -avz --progress \
  --include '*/' \
  --include '*.json' \
  --exclude '*' \
  "${USUARIO}@${HOST}:${ORIGEM}" \
  "$DESTINO"

echo
echo "Concluído."
echo "Origem:  ${USUARIO}@${HOST}:${ORIGEM}"
echo "Destino: $DESTINO"
