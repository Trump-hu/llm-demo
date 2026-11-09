/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Agent 网关地址，为空时使用内置 mock 传输层 */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
