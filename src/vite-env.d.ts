/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Agent 网关地址，为空时使用内置 mock 传输层 */
  readonly VITE_API_BASE?: string;
  /** DeepSeek API 根地址；直连填 https://api.deepseek.com，走开发代理填 /deepseek */
  readonly VITE_DEEPSEEK_BASE_URL?: string;
  /** 浏览器直连 DeepSeek 时使用；走代理时应留空，由 Vite 代理注入 */
  readonly VITE_DEEPSEEK_API_KEY?: string;
  /** 非 deepseek-* 模型的兜底模型，默认 deepseek-chat */
  readonly VITE_DEEPSEEK_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
