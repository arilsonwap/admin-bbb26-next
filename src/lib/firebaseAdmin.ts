import * as admin from 'firebase-admin';

/** Projeto Firebase do app Android / FCM; deve coincidir com a service account em FIREBASE_SERVICE_ACCOUNT_JSON. */
export const EXPECTED_FIREBASE_PUSH_PROJECT_ID = 'central-bbb-29267';

let cachedApp: admin.app.App | null = null;

type ParseResult =
  | { success: true; credentials: Record<string, unknown> }
  | { success: false; error: string };

/**
 * Lê e interpreta FIREBASE_SERVICE_ACCOUNT_JSON (JSON em uma linha ou Base64 do JSON).
 * Não inicializa o SDK; não loga valores da env.
 */
export function parseServiceAccountFromEnv(): ParseResult {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw || !String(raw).trim()) {
    return {
      success: false,
      error:
        'FIREBASE_SERVICE_ACCOUNT_JSON não está definida. Defina no ambiente do servidor (ex.: .env.local) o JSON da service account ou o Base64 desse JSON. Veja .env.example.',
    };
  }
  const trimmed = String(raw).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    try {
      const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
      parsed = JSON.parse(decoded);
    } catch {
      return {
        success: false,
        error:
          'FIREBASE_SERVICE_ACCOUNT_JSON inválido: não é JSON válido nem Base64 de um JSON válido.',
      };
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { success: false, error: 'FIREBASE_SERVICE_ACCOUNT_JSON: conteúdo não é um objeto JSON.' };
  }

  const credentials = parsed as Record<string, unknown>;
  if (credentials.type !== 'service_account') {
    return {
      success: false,
      error:
        'FIREBASE_SERVICE_ACCOUNT_JSON: esperado type "service_account" (conta de serviço Firebase/Google).',
    };
  }
  if (typeof credentials.project_id !== 'string' || !credentials.project_id.trim()) {
    return { success: false, error: 'FIREBASE_SERVICE_ACCOUNT_JSON: campo project_id ausente ou inválido.' };
  }
  if (typeof credentials.client_email !== 'string' || !credentials.client_email.trim()) {
    return { success: false, error: 'FIREBASE_SERVICE_ACCOUNT_JSON: campo client_email ausente ou inválido.' };
  }
  if (typeof credentials.private_key !== 'string' || !credentials.private_key.includes('BEGIN PRIVATE KEY')) {
    return {
      success: false,
      error:
        'FIREBASE_SERVICE_ACCOUNT_JSON: private_key ausente ou inválido (necessário para Firebase Admin SDK).',
    };
  }

  return { success: true, credentials };
}

export type FirebasePushDiagnostics =
  | {
      configured: true;
      project_id: string;
      client_email: string;
      expected_project_id: typeof EXPECTED_FIREBASE_PUSH_PROJECT_ID;
      matches_expected_project: boolean;
    }
  | {
      configured: false;
      error: string;
      expected_project_id: typeof EXPECTED_FIREBASE_PUSH_PROJECT_ID;
    };

/** Metadados seguros para diagnóstico (sem private_key). Apenas servidor / rotas admin. */
export function getFirebasePushDiagnostics(): FirebasePushDiagnostics {
  const r = parseServiceAccountFromEnv();
  if (!r.success) {
    return {
      configured: false,
      error: r.error,
      expected_project_id: EXPECTED_FIREBASE_PUSH_PROJECT_ID,
    };
  }
  const project_id = String(r.credentials.project_id).trim();
  const client_email = String(r.credentials.client_email).trim();
  return {
    configured: true,
    project_id,
    client_email,
    expected_project_id: EXPECTED_FIREBASE_PUSH_PROJECT_ID,
    matches_expected_project: project_id === EXPECTED_FIREBASE_PUSH_PROJECT_ID,
  };
}

function loadServiceAccountForAdmin(): Record<string, unknown> {
  const r = parseServiceAccountFromEnv();
  if (!r.success) {
    throw new Error(r.error);
  }
  return r.credentials;
}

/**
 * App Firebase Admin singleton (apenas servidor). Usado para FCM (push editorial), não para Hosting.
 */
export function getFirebaseAdminApp(): admin.app.App {
  if (cachedApp) return cachedApp;
  if (!admin.apps.length) {
    const json = loadServiceAccountForAdmin();
    const credential = admin.credential.cert(json as admin.ServiceAccount);
    cachedApp = admin.initializeApp({ credential });
  } else {
    cachedApp = admin.app();
  }
  return cachedApp;
}
