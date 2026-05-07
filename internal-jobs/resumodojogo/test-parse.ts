// Teste da função parsePtNumber
function parsePtNumber(raw: string): number | null {
  const s = (raw || "")
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ");

  // Primeiro tenta extrair apenas números do texto (ex: "Estalecas1450" -> "1450")
  const numOnly = s.replace(/[^\d.,+-]/g, ""); // remove tudo exceto números, pontos, vírgulas, sinais

  // Se não encontrou números, tenta o texto original
  const target = numOnly || s;

  console.log(`parsePtNumber("${s}") -> numOnly: "${numOnly}" -> target: "${target}"`);

  // aceita: -150, +150, 150, -1.500, 1.500
  // (se vier com vírgula, também funciona: -1.500,50 -> vira -1500.50)
  const m = target.match(/^[+-]?\d{1,3}(\.\d{3})*(,\d+)?$|^[+-]?\d+(,\d+)?$/);
  console.log(`  Regex match: ${m ? 'SIM' : 'NÃO'} (${m ? m[0] : 'null'})`);

  if (!m) return null;

  const normalized = target.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  console.log(`  Normalized: "${normalized}" -> Number: ${n} -> isFinite: ${Number.isFinite(n)}`);

  return Number.isFinite(n) ? n : null;
}

// Testes
console.log("=== TESTES ===");
console.log("Teste 1:", parsePtNumber("Estalecas1450"));
console.log("Teste 2:", parsePtNumber("1450"));
console.log("Teste 3:", parsePtNumber("850"));
console.log("Teste 4:", parsePtNumber("1.500"));
console.log("Teste 5:", parsePtNumber("-150"));
console.log("Teste 6:", parsePtNumber("0"));