# 架构说明

## 1. 分层与依赖方向

```text
        ┌───────────────┐
        │      app      │  装配：路由 / Provider / 主题
        └───────┬───────┘
                │
        ┌───────▼───────┐
        │   features    │  业务：chat 页面、组件、store、运行编排
        └───┬───────┬───┘
            │       │
   ┌────────▼──┐ ┌──▼────────┐
   │   core    │ │  shared   │  领域内核 / 通用能力（均不依赖 features）
   └───────────┘ └───────────┘
```

约束：`core` 与 `shared` 不得 import `features` 或 `app`。这样在需要时可以把 `core/agent` 直接发布为独立 SDK。

## 2. 数据流

```text
用户输入
  └─› useAgentRun.send
        ├─› store.appendUserMessage()           写入用户消息
        ├─› store.appendAssistantMessage()      插入空的助手消息（占位）
        ├─› transport.stream(request)           产生 AgentEvent 流
        └─› store.applyEvent(event)
              └─› applyAgentEvent(message, event)   纯函数折叠
                    └─› 组件按 parts 渲染（推理 / 工具 / 正文）
```

关键点：

- **单一数据源**：会话数据只在 `chatStore` 中保存，组件通过选择器订阅。
- **增量更新**：每帧事件仅替换目标消息对象，避免整棵树 diff。
- **可中断**：`AbortController` 贯穿传输层，`stop()` 会以 `finishReason: 'aborted'` 收尾，保证消息不会卡在 `streaming`。

## 3. 领域模型

```ts
ChatMessage = {
  id, role, status, createdAt, model?, finishReason?, error?,
  parts: Array<TextPart | ReasoningPart | ToolCallPart>
}
```

选择分片的理由：

| 场景       | 分片结构的收益                                                |
| ---------- | ------------------------------------------------------------- |
| 推理可见   | `reasoning` 独立渲染为可折叠面板，不混入正文                  |
| 工具轨迹   | 每次调用是一张卡片，天然支持并行调用与重试                    |
| 交错输出   | 正文可出现在工具调用前后，顺序即渲染顺序                      |
| 多模态扩展 | 新增 `image` / `file` / `artifact` 分片即可，无需改动消息结构 |

## 4. 传输层契约

```ts
interface ChatTransport {
  readonly id: string;
  stream(request: ChatRequest): AsyncIterable<AgentEvent>;
}
```

现有实现：

| 实现            | 用途                         | 入口                        |
| --------------- | ---------------------------- | --------------------------- |
| `MockTransport` | 无后端演示，固定剧本流式输出 | 默认启用                    |
| `SseTransport`  | HTTP SSE 对接真实网关        | 设置 `VITE_API_BASE` 后启用 |

新增传输层（如 WebSocket、本地 WASM 推理）只需实现该接口并在 `transport/index.ts` 的工厂中注册。

## 5. 状态管理约定

| 字段            | 说明                              | 是否持久化 |
| --------------- | --------------------------------- | ---------- |
| `conversations` | 会话字典（id → 会话）             | ✅         |
| `order`         | 会话排序，最近更新优先            | ✅         |
| `activeId`      | 当前会话 id，与路由同步           | ✅         |
| `settings`      | 模型、深度思考、联网开关          | ✅         |
| `feedback`      | 消息点赞/点踩                     | ✅         |
| `streaming`     | 当前流式消息（会话 id + 消息 id） | ❌         |

`streaming` 不持久化；应用恢复时会把残留的 `streaming` 消息标记为 `done`，避免刷新后卡住。

## 6. 可扩展点速查

| 需求             | 改动位置                                                       |
| ---------------- | -------------------------------------------------------------- |
| 新增模型         | `features/chat/constants.ts` → `MODEL_OPTIONS`                 |
| 新增工具卡片样式 | `ToolCallCard.tsx`（后续抽成注册表）                           |
| 新增事件类型     | `core/agent/types.ts` + `eventReducer.ts` 增加分支             |
| 换肤             | `app/theme/antdTheme.ts` + `styles/global.css` 的 `:root` 令牌 |
| 接入真实后端     | `.env.local` 配置 `VITE_API_BASE`                              |
| 新增页面         | `app/router.tsx`，页面放 `features/<name>/pages`               |
