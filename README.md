# Nexus · AI Agent Console

面向 AI Agent 场景的前端工作台：深色科技风格的对话界面，支持**流式输出、可折叠推理过程、工具调用轨迹**，并预留了接入真实 Agent 网关的完整扩展点。

## 技术栈

| 分类     | 选型                                                                |
| -------- | ------------------------------------------------------------------- |
| 框架     | React 19 + TypeScript 6（`strict` 全开）                            |
| 构建     | Vite 8（路径别名 `@/`、代理、SourceMap、按需分包）                  |
| UI       | Ant Design 6（`darkAlgorithm` + Design Token 统一收口）             |
| 状态     | Zustand 5（持久化到 localStorage）                                  |
| 路由     | React Router 7（Data Router）                                       |
| 内容渲染 | react-markdown + remark-gfm + rehype-highlight                      |
| 质量     | ESLint 10（flat config）+ Prettier 3 + Vitest 5 + Testing Library |

## 快速开始

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 类型检查 + 生产构建
npm run test     # 单元测试
npm run lint     # 代码检查
npm run format   # 格式化
```

默认使用**内置 mock 传输层**，无需后端即可看到完整的「推理 → 工具调用 → 正文」流式效果。
接入真实后端时，在 `.env.local` 中设置：

```bash
VITE_API_BASE=http://127.0.0.1:8000   # 前端将请求 POST {VITE_API_BASE}/agent/chat
```

## 目录结构

```text
src/
├─ app/                     应用装配层（只做组合，不含业务逻辑）
│  ├─ providers/            全局 Provider：主题、i18n、消息上下文
│  ├─ theme/                Ant Design Design Token
│  └─ router.tsx            路由表
├─ core/                    领域层（与 UI 无关，可单独测试/复用）
│  └─ agent/
│     ├─ types.ts           消息模型、会话模型、AgentEvent 协议
│     ├─ eventReducer.ts    纯函数：事件 → 消息状态
│     └─ transport/         传输层实现（mock / SSE）与工厂
├─ features/                业务功能层
│  └─ chat/
│     ├─ components/        界面组件（消息、推理面板、工具卡片、输入区…）
│     ├─ hooks/             useAgentRun：对话运行编排
│     ├─ pages/             ChatPage
│     ├─ store/             Zustand 会话状态
│     └─ constants.ts       模型列表、建议提示词、工具文案
├─ shared/                  通用层（hooks / utils / 无业务组件）
├─ styles/                  全局样式与设计令牌
└─ test/                    测试环境初始化
```

依赖方向固定为 `app → features → core/shared`，`core` 不反向依赖 `features`，便于后续把 Agent 内核抽成独立包。

## Agent 架构要点

1. **消息采用分片（part）结构**：`text` / `reasoning` / `tool-call` 可以任意交错，天然适配 Agent 的多轮工具调用轨迹。
2. **传输层只产出事件流**：`ChatTransport.stream()` 返回 `AsyncIterable<AgentEvent>`，mock、SSE、WebSocket 可互换，UI 与 store 零改动。
3. **事件折叠是纯函数**：`applyAgentEvent(message, event)` 无副作用，已被单元测试覆盖，后续换状态库（Redux / XState）可平移。
4. **运行编排集中在 `useAgentRun`**：负责占位消息、流式订阅、中断（AbortController）、重新生成。
5. **主题 Token 收口**：颜色、圆角、字体只在 `app/theme/antdTheme.ts` 与 `styles/global.css` 中定义，便于换肤。

## 后端事件协议

`POST {VITE_API_BASE}/agent/chat`，请求体：

```json
{
  "conversationId": "conv_xxx",
  "messageId": "msg_xxx",
  "messages": [{ "role": "user", "content": "你好" }],
  "settings": { "model": "nexus-1.5-pro", "deepThink": true, "webSearch": false }
}
```

响应为 `text/event-stream`，每帧 `data:` 后跟一个事件 JSON：

| 事件                      | 说明                                            |
| ------------------------- | ----------------------------------------------- |
| `run.start`               | 开始一次运行                                    |
| `reasoning.delta`         | 推理内容增量（深度思考面板）                    |
| `tool.start` / `tool.end` | 工具调用开始与结束（含入参、结果）              |
| `text.delta`              | 正文增量                                        |
| `run.end`                 | 结束（`finishReason`: stop / length / aborted） |
| `run.error`               | 运行失败                                        |

`messageId` 由前端生成，后端需在每个事件中原样回传，前端据此定位消息。

## 后续规划

- [ ] **工具视图注册表**：按工具名渲染专用卡片（搜索结果为卡片列表、代码执行为终端输出等）。
- [ ] **运行可观测性**：Trace 面板展示每一步的耗时、Token 消耗与重试。
- [ ] **多模态**：图片 / 文件上传与解析结果展示（`Composer` 的附件位已预留）。
- [ ] **会话服务端化**：把本地持久化切换为远端分页 + 增量同步。
- [ ] **Agent 编排视图**：可视化 DAG、人工审批（human-in-the-loop）与断点续跑。
