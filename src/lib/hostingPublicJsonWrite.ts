import { writeFileSync, renameSync } from 'fs';
import { join } from 'path';
import { sha256HexUtf8 } from '@/lib/publishExportDiagnostics';

/** Ex.: `statusbbb.json` → `statusbbb-latest.json` (mesmo padrão do resumo do jogo / queridômetro). */
export function hostingMainJsonToLatestBasename(mainBasename: string): string {
  if (!mainBasename.toLowerCase().endsWith('.json')) {
    throw new Error(`Arquivo principal deve terminar em .json: ${mainBasename}`);
  }
  return mainBasename.replace(/\.json$/i, '-latest.json');
}

/**
 * Grava JSON principal em `tools/bbb-hosting/public/` com escrita atômica (.tmp + rename)
 * e atualiza o par `-latest.json` com metadata (bytes, sha256, version, datas).
 */
export function writeHostingPublicMainAndLatest(
  publicDir: string,
  mainBasename: string,
  data: unknown
): { bytes: number; sha256: string; version: string } {
  const content = JSON.stringify(data, null, 2);
  const mainPath = join(publicDir, mainBasename);
  const tmpMain = `${mainPath}.tmp`;
  writeFileSync(tmpMain, content, 'utf8');
  renameSync(tmpMain, mainPath);

  const sha256 = sha256HexUtf8(content);
  const version = `sha256:${sha256.slice(0, 16)}`;
  const latestBasename = hostingMainJsonToLatestBasename(mainBasename);
  const latestPath = join(publicDir, latestBasename);
  const latestData = {
    file: mainBasename,
    lastModified: new Date().toISOString(),
    localDate: new Date().toISOString().split('T')[0],
    bytes: Buffer.byteLength(content, 'utf8'),
    sha256,
    version,
  };
  const tmpLatest = `${latestPath}.tmp`;
  writeFileSync(tmpLatest, JSON.stringify(latestData, null, 2), 'utf8');
  renameSync(tmpLatest, latestPath);

  return { bytes: Buffer.byteLength(content, 'utf8'), sha256, version };
}
