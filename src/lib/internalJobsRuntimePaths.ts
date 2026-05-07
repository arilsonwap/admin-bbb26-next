import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Caminhos dos jobs internos e da pasta pública de hosting, relativos à raiz do repositório admin.
 * Usa process.cwd() (deve ser a raiz do projeto ao subir Next/npm start).
 */

function cwdLabel(): string {
  return process.cwd();
}

export function resolveQueridometroJobDir(): string {
  const root = cwdLabel();
  const dir = join(root, 'internal-jobs', 'queridometro');
  if (!existsSync(dir)) {
    throw new Error(
      `[queridômetro] Pasta do job não encontrada: ${dir}. O processo precisa rodar com cwd = raiz do repositório admin (cwd atual: ${root}).`
    );
  }
  return dir;
}

export function resolveResumodojogoJobDir(): string {
  const root = cwdLabel();
  const dir = join(root, 'internal-jobs', 'resumodojogo');
  if (!existsSync(dir)) {
    throw new Error(
      `[resumo do jogo] Pasta do job não encontrada: ${dir}. O processo precisa rodar com cwd = raiz do repositório admin (cwd atual: ${root}).`
    );
  }
  return dir;
}

export function resolveBbbHostingPublicDir(): string {
  const root = cwdLabel();
  const dir = join(root, 'tools', 'bbb-hosting', 'public');
  if (!existsSync(dir)) {
    throw new Error(
      `[deploy público] Pasta não encontrada: ${dir}. Crie tools/bbb-hosting/public ou ajuste o cwd (atual: ${root}).`
    );
  }
  return dir;
}

export function assertQueridometroRunnable(jobDir: string): void {
  const sh = join(jobDir, 'run-queridometro.sh');
  const entry = join(jobDir, 'queridometro.js');
  if (!existsSync(sh)) {
    throw new Error(`[queridômetro] Script ausente: ${sh}`);
  }
  if (!existsSync(entry)) {
    throw new Error(`[queridômetro] Entrypoint ausente: ${entry}`);
  }
  const nm = join(jobDir, 'node_modules');
  if (!existsSync(nm)) {
    throw new Error(
      `[queridômetro] Dependências não instaladas (node_modules ausente em ${jobDir}). Execute: cd internal-jobs/queridometro && npm ci`
    );
  }
}

export function assertResumodojogoRunnable(jobDir: string): void {
  const pkg = join(jobDir, 'package.json');
  const script = join(jobDir, 'scrape-all.sh');
  if (!existsSync(pkg)) {
    throw new Error(`[resumo do jogo] package.json ausente: ${pkg}`);
  }
  if (!existsSync(script)) {
    throw new Error(`[resumo do jogo] scrape-all.sh ausente: ${script}`);
  }
  const nm = join(jobDir, 'node_modules');
  if (!existsSync(nm)) {
    throw new Error(
      `[resumo do jogo] Dependências não instaladas (node_modules ausente em ${jobDir}). Execute: cd internal-jobs/resumodojogo && npm ci`
    );
  }
}
