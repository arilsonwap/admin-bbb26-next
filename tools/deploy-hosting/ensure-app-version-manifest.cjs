/**
 * Garante app-version.json + app-version-latest.json em tools/bbb-hosting/public/
 * antes do firebase deploy. Mantenha defaults alinhados a defaultDocument() em
 * src/app/api/admin/app-version/route.ts
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function defaultDocument() {
  return {
    enabled: false,
    latestVersion: '1.0.0',
    minSupportedVersion: '1.0.0',
    forceUpdate: false,
    message: '',
    requiredMessage: '',
    storeUrlAndroid: 'market://details?id=com.arilson.centralbbb',
    storeUrlIos: '',
    showOncePerSession: true,
    updatedAt: new Date().toISOString(),
  };
}

function sha256HexUtf8(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function writeAtomic(filePath, content) {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

function writeLatestForMainContent(publicDir, mainBasename, content) {
  const sha256 = sha256HexUtf8(content);
  const version = `sha256:${sha256.slice(0, 16)}`;
  const latestBasename = mainBasename.replace(/\.json$/i, '-latest.json');
  const latestPath = path.join(publicDir, latestBasename);
  const latestData = {
    file: mainBasename,
    lastModified: new Date().toISOString(),
    localDate: new Date().toISOString().split('T')[0],
    bytes: Buffer.byteLength(content, 'utf8'),
    sha256,
    version,
  };
  writeAtomic(latestPath, JSON.stringify(latestData, null, 2));
}

function main() {
  const repoRoot = path.resolve(process.argv[2] || '.');
  const publicDir = path.join(repoRoot, 'tools', 'bbb-hosting', 'public');
  const mainBasename = 'app-version.json';
  const mainPath = path.join(publicDir, mainBasename);
  const latestPath = path.join(publicDir, 'app-version-latest.json');

  fs.mkdirSync(publicDir, { recursive: true });

  if (!fs.existsSync(mainPath)) {
    const doc = defaultDocument();
    const content = JSON.stringify(doc, null, 2);
    writeAtomic(mainPath, content);
    writeLatestForMainContent(publicDir, mainBasename, content);
    console.log('[ensure-app-version-manifest] Criados manifestos default (main ausente).');
    return;
  }

  if (!fs.existsSync(latestPath)) {
    const content = fs.readFileSync(mainPath, 'utf8');
    try {
      JSON.parse(content);
    } catch {
      console.error('[ensure-app-version-manifest] app-version.json existe mas não é JSON válido.');
      process.exit(1);
    }
    writeLatestForMainContent(publicDir, mainBasename, content);
    console.log('[ensure-app-version-manifest] Recriado app-version-latest.json (estava ausente).');
    return;
  }

  console.log('[ensure-app-version-manifest] OK (main + latest presentes).');
}

main();
