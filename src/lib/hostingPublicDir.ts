import { join } from 'path';

/** Diretório publicado no Firebase Hosting (`tools/deploy-hosting/deploy-firebase-bbb-26.sh`). */
export function getHostingPublicDir(): string {
  return join(process.cwd(), 'tools', 'bbb-hosting', 'public');
}
