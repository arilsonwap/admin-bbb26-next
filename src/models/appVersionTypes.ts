/** Documento publicado em `tools/bbb-hosting/public/app-version.json`. */
export type AppVersionDocument = {
  enabled: boolean;
  latestVersion: string;
  minSupportedVersion: string;
  forceUpdate: boolean;
  message: string;
  requiredMessage: string;
  storeUrlAndroid: string;
  storeUrlIos: string;
  showOncePerSession: boolean;
  updatedAt: string;
};
