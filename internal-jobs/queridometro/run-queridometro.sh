#!/usr/bin/env bash
# Espera cwd = diretório deste projeto (definido pelo painel ao spawnar o script).

if ! command -v node >/dev/null 2>&1; then
  echo "Erro: executável node não encontrado no PATH (instale Node.js ou ajuste o PATH)." >&2
  exit 127
fi

node queridometro.js

echo "$(date): Queridômetro executado" >> queridometro.log
