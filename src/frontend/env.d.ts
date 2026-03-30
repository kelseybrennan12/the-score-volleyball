/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ENABLE_ADMIN_TAB?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
