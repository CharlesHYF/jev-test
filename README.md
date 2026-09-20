# Jev × OpenAI · 电商客服深度测试

一个面向真实业务的 Jev / OpenAI Benchmark。界面采用 **AI 对话 + 执行观测台**：左侧选择电商客服测试场景，中间像聊天工具一样输入客户消息并查看两种模型的决策结果，右侧观察 Jev Question 映射、OpenAI SSE、原始请求与性能数据。

## 主要变化

- 2.2.0：历史区改为真正的“会话”模型。每次首次发送消息才创建一个 Session；点击历史会话可恢复中间对话和右侧 Inspector；“新对话”只清空当前工作区，不删除历史。
- 2.2.0：切换测试场景会保存当前 Session，并清空中间工作区，避免不同场景结果串在一起。
- 2.2.0：历史列表强制 `overflow-x: hidden`，标题单行省略，不再出现横向滚动条。
- 2.2.0：桌面端按照已选 Option 1 的 `1536 × 1024` 参考图重新对齐三栏比例、结果卡、右侧观测台与底部输入区。
- 2.2.0：OpenAI 默认模型改为 `gpt-5.6-luna`；`terra` / `sol` 仅保留在设置中作为手动切换项。
- 2.1.0：修复 `.env` 依赖启动目录的问题；服务会从项目根目录读取 `.env` / `.env.local`，即使从其他目录执行 Node 也能识别 API Key。

- 不再要求测试人员手动选择 `Noul / Choice / Score`
- 由场景配置把业务判断映射成 Jev Question Type
- 同一条客户消息同时调用 Jev 与 OpenAI
- Jev 返回结构化概率决策；OpenAI 使用严格 JSON Schema + SSE
- UI 以聊天为主，调试信息放在右侧 Inspector
- 无 Mock / Demo 模式，交付代码只调用真实 API


## 会话行为

- **新对话**：保存当前会话（如果已经发送过消息），然后清空中间工作区；历史会话继续保留。
- **切换场景**：保存当前会话并清空中间工作区；不会删除之前的历史会话。
- **点击历史会话**：恢复该会话使用的场景、中间结果、性能数据与右侧 Inspector 状态。
- **浏览器刷新**：历史会话通过 `localStorage` 恢复；默认最多保留 24 个会话。
- 历史标题来自该会话第一条客户消息，并做单行省略；历史区域只允许纵向滚动。

## 测试场景

### 1. 电商客服 · 综合判断

一次请求同时评估：

- `Noul`：是否需要优先处理
- `Choice`：问题分类
- `Score`：客户不满程度

### 2. 售后路由

- 是否需要人工升级
- 应进入哪个处理队列
- 工单优先级

### 3. 退款风险

- 是否明确要求退款
- 自动退款风险等级
- 下一步建议动作

### 4. 物流异常

- 是否疑似丢件
- 物流异常类型
- 物流处理优先级

### 5. 客户情绪

- 是否明显负面
- 负面情绪强度
- 主要语气

### 6. 批量压力测试

复用“综合判断”场景，对同一输入连续执行 5 轮，累计统计：

- P50 总耗时
- P95 总耗时
- 最快 / 最慢
- OpenAI 首文本延迟

## 右侧执行观测台

提供 5 个 Tab：

1. **执行步骤**
   - 请求构建
   - Jev 请求
   - OpenAI SSE
   - 结果比对
   - 当前问题映射 JSON
2. **问题映射**
   - 展示业务问题如何映射为 Noul / Choice / Score
3. **SSE 事件**
   - `response.created`
   - `response.output_text.delta`
   - `response.completed`
4. **原始数据**
   - Jev Request / Response
   - OpenAI Request / Output
5. **性能数据**
   - Jev 首字节 / 总耗时
   - OpenAI 首事件 / 首文本 / 总耗时
   - P50 / P95 / 最快 / 最慢

## 技术栈

- 前端：TypeScript + 原生 DOM API
- 后端：Node.js 原生 HTTP + TypeScript
- 运行时第三方依赖：0
- Node.js：>= 20
- 开发依赖：TypeScript

## API

### Jev

后端代理：

```text
POST /api/jev
  -> https://api.typesafe.ai/v1/systemone
```

支持：

- `state: string | object | array`
- `noul / choice / score`
- `429 / 529` 指数退避
- `Retry-After`
- upstream latency
- retry count

### OpenAI

默认模型：`gpt-5.6-luna`。

后端代理：

```text
POST /api/openai/stream
  -> https://api.openai.com/v1/responses
```

特性：

- `stream: true`
- SSE 原样透传
- `X-Accel-Buffering: no`
- JSON Schema Structured Output
- 不在 Node 端缓冲完整响应

## 启动

### 1. 配置环境变量

```bash
cp .env.example .env
```

填写：

```env
TYPESAFE_API_KEY=你的_TypeSafe_Key
OPENAI_API_KEY=你的_OpenAI_Key
```

可选：

```env
PORT=3000
TYPESAFE_MAX_ATTEMPTS=3
TYPESAFE_RETRY_BASE_MS=250
```


### API 一直显示“配置异常”怎么办

服务启动时会打印当前读取到的配置来源：

```text
Environment: .env
TypeSafe API: ready
OpenAI API: ready
```

如果仍提示 Key 缺失：

1. 确认文件名是 `.env` 或 `.env.local`，不是只修改了 `.env.example`。
2. `.env` 放在项目根目录，也就是与 `package.json` 同级。
3. 重新启动 Node 进程。
4. 打开 `http://localhost:3000/api/health`，应看到：

```json
{
  "providers": { "jev": true, "openai": true },
  "environment": { "loadedFiles": [".env"] }
}
```

`.env` 同时兼容普通写法、引号以及 `export KEY=value` 写法。

### 2. 直接运行已编译版本

ZIP 已包含 `dist`：

```bash
node dist/server/index.js
```

访问：

```text
http://localhost:3000
```

### 3. 修改源码后重新构建

```bash
npm install
npm run build
npm start
```

## 项目结构

```text
jev-openai-chat-inspector/
├── apps/
│   ├── server/src/
│   │   ├── index.ts
│   │   └── node-shims.d.ts
│   └── web/
│       ├── src/app.ts
│       ├── index.html
│       └── styles.css
├── design/
│   └── reference-option-1.png
├── dist/
├── scripts/
├── .env.example
├── package.json
└── README.md
```

## 指标口径

Jev：

```text
Browser request
  -> response headers
  -> first response body byte
  -> typed decisions complete
```

OpenAI：

```text
Browser request
  -> response headers
  -> first SSE event
  -> first response.output_text.delta
  -> response.completed
```

Jev 本身不逐 Token 生成文本，因此页面不会为 Jev 伪造 TTFT / SSE 指标。
