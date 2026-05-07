#!/bin/bash

# Lista de todos os participantes do BBB 26
PARTICIPANTES=(
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/alberto-cowboy/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/aline-campos/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/ana-paula-renault/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/babu-santana/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/breno/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/brigido/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/chaiany/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/edilson/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/gabriela/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/henri-castelli/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/jonas-sulzbach/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/jordana/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/juliano-floss/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/leandro/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/marcelo/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/marciele/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/matheus/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/maxiane/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/milena/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/samira/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/sarah-andrade/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/sol-vega/"
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/solange-couto/"
)

echo "Iniciando scraping de ${#PARTICIPANTES[@]} participantes..."
echo "Participantes: ${PARTICIPANTES[*]}"

npx ts-node scrape-gshow-bbb26.ts "${PARTICIPANTES[@]}"