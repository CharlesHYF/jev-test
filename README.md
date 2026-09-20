<h1 align="center">Jev × OpenAI · 电商客服深度测试</h1>
<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-5.8%2B-3178C6?logo=typescript&logoColor=white) ![Build](https://img.shields.io/badge/build-npm%20run%20build-brightgreen) ![Version](https://img.shields.io/badge/version-2.2.0-blue) ![License](https://img.shields.io/badge/license--not%20specified-lightgrey)

</div>

## 项目介绍
这是一个面向真实业务的 Jev / OpenAI Benchmark，用于测试电商客服场景下的结构化决策和文本生成能力。界面由左侧测试场景、中间对话区和右侧执行观测台组成，支持同时查看 Jev 与 OpenAI 的请求、响应、事件和性能数据。

项目不提供 Mock 或 Demo 模式，所有测试请求都会调用真实 API。

## 技术栈
- 前端：TypeScript、原生 DOM API
- 后端：Node.js 原生 HTTP、TypeScript
- 构建：TypeScript Compiler
- 运行时依赖：无
- Node.js：20 或更高版本
- 项目版本：2.2.0

## 系统架构
\`\`\`text
浏览器
  └── Node.js HTTP 服务
      ├── 静态资源服务
      ├── GET /api/health
      ├── POST /api/jev
      │   └── TypeSafe API
      └── POST /api/openai/stream
          └── OpenAI Responses API
\`\`\`

## 核心能力
- 根据测试场景自动生成 Jev Question 映射，不要求测试人员手动选择 Noul、Choice 或 Score
- 同一条客户消息同时调用 Jev 与 OpenAI
- Jev 返回结构化概率决策，支持失败重试、Retry-After 和上游耗时记录
- OpenAI 使用 JSON Schema Structured Output，并通过 SSE 原样返回事件
- 右侧观测台展示请求构建、问题映射、SSE 事件、原始数据和性能数据
- 历史会话通过浏览器 localStorage 保存，刷新页面后可以恢复

## 会话行为
- 新对话：保存已经发送过消息的当前会话，然后清空工作区，不删除历史
- 切换场景：保存当前会话并清空工作区，避免不同场景的结果混用
- 点击历史会话：恢复对应场景、对话结果、性能数据和观测台状态
- 浏览器刷新：从 localStorage 恢复历史会话，最多保留 24 个会话
- 历史标题：使用会话第一条客户消息，并在列表中单行省略

## 测试场景
### 电商客服 · 综合判断
一次请求同时评估以下内容：
- Noul：是否需要优先处理
- Choice：问题分类
- Score：客户不满程度

### 售后路由
- 是否需要人工升级
- 应进入哪个处理队列
- 工单优先级

### 退款风险
- 是否明确要求退款
- 自动退款风险等级
- 下一步建议动作

### 物流异常
- 是否疑似丢件
- 物流异常类型
- 物流处理优先级

### 客户情绪
- 是否明显负面
- 负面情绪强度
- 主要语气

### 批量压力测试
复用综合判断场景，对同一输入连续执行 5 轮，并统计以下指标：
- P50 总耗时
- P95 总耗时
- 最快耗时和最慢耗时
- OpenAI 首文本延迟

## 执行观测台
右侧观测台提供以下 5 个 Tab：
1. 执行步骤：请求构建、Jev 请求、OpenAI SSE、结果比对和当前问题映射 JSON
2. 问题映射：展示业务问题如何映射为 Noul、Choice 和 Score
3. SSE 事件：展示 \`response.created\`、\`response.output_text.delta\` 和 \`response.completed\`
4. 原始数据：展示 Jev Request、Jev Response、OpenAI Request 和 OpenAI Output
5. 性能数据：展示 Jev 首字节、Jev 总耗时、OpenAI 首事件、OpenAI 首文本、OpenAI 总耗时以及批量统计结果

## API
### 健康检查
\`\`\`text
GET /api/health
\`\`\`
用于检查服务端是否读取到 Jev 和 OpenAI API Key。

示例响应：
\`\`\`json
{
  "providers": {
    "jev": true,
    "openai": true
  },
  "environment": {
    "loadedFiles": [
      ".env"
    ]
  }
}
\`\`\`

### Jev 代理
\`\`\`text
POST /api/jev
\`\`\`
请求转发至 \`https://api.typesafe.ai/v1/systemone\`，支持以下能力：
- \`state\` 使用 string、object 或 array
- \`noul\`、\`choice\` 和 \`score\`
- \`429\` 和 \`529\` 指数退避
- \`Retry-After\`
- 上游耗时和重试次数

### OpenAI 流式代理
\`\`\`text
POST /api/openai/stream
\`\`\`
请求转发至 \`https://api.openai.com/v1/responses\`，默认使用 \`gpt-5.6-luna\`，支持以下能力：
- \`stream: true\`
- SSE 原样透传
- \`X-Accel-Buffering: no\`
- JSON Schema Structured Output
- Node.js 端不缓冲完整响应

## 配置
复制环境变量模板：
\`\`\`bash
cp .env.example .env
\`\`\`

根据实际账号填写 API Key：
\`\`\`env
TYPESAFE_API_KEY=你的_TypeSafe_Key
OPENAI_API_KEY=你的_OpenAI_Key
\`\`\`

可选配置：
| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| \`PORT\` | \`3000\` | HTTP 服务端口 |
| \`TYPESAFE_API_BASE\` | \`https://api.typesafe.ai\` | TypeSafe API 地址 |
| \`TYPESAFE_MAX_ATTEMPTS\` | \`3\` | TypeSafe 最大请求次数，范围为 1 到 6 |
| \`TYPESAFE_RETRY_BASE_MS\` | \`250\` | TypeSafe 重试基础间隔，单位为毫秒 |
| \`OPENAI_API_BASE\` | \`https://api.openai.com\` | OpenAI API 地址 |

服务启动时会打印配置读取结果：
\`\`\`text
Environment: .env
TypeSafe API: ready
OpenAI API: ready
\`\`\`

如果页面仍提示配置异常，请依次确认：
1. 文件名是 \`.env\` 或 \`.env.local\`，而不是只修改 \`.env.example\`
2. 环境变量文件位于项目根目录，并且与 \`package.json\` 同级
3. 修改配置后已重新启动 Node.js 进程
4. \`GET http://localhost:3000/api/health\` 返回的 providers 状态为 true

环境变量加载器同时兼容普通写法、引号和 \`export KEY=value\` 写法。

## 快速开始
### 安装依赖
\`\`\`bash
npm install
\`\`\`

### 构建并启动
\`\`\`bash
npm run build
npm start
\`\`\`

启动后访问：
\`\`\`text
http://localhost:3000
\`\`\`

### 开发模式
开发模式会先构建项目，再以 Node.js watch 模式启动服务：
\`\`\`bash
npm run dev
\`\`\`

### 重新构建
修改源码后执行：
\`\`\`bash
npm run build
\`\`\`

构建产物输出到 \`dist/\`，该目录由 \`.gitignore\` 忽略，不纳入版本控制。

## 项目结构
\`\`\`text
jev-openai-chat-inspector/
├── apps/
│   ├── server/
│   │   └── src/
│   │       ├── index.ts
│   │       └── node-shims.d.ts
│   └── web/
│       ├── assets/
│       ├── src/app.ts
│       ├── index.html
│       └── styles.css
├── design/
├── scripts/
│   ├── clean.mjs
│   └── copy-static.mjs
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── tsconfig.base.json
├── tsconfig.server.json
├── tsconfig.web.json
└── README.md
\`\`\`

## 指标口径
Jev 指标链路：
\`\`\`text
浏览器请求
  -> 响应头
  -> 首个响应体字节
  -> 结构化决策完成
\`\`\`

OpenAI 指标链路：
\`\`\`text
浏览器请求
  -> 响应头
  -> 首个 SSE 事件
  -> 首个 response.output_text.delta
  -> response.completed
\`\`\`

Jev 不逐 Token 生成文本，因此页面不会为 Jev 伪造 TTFT 或 SSE 指标。

## 版本记录
### 2.2.0
- 历史区改为会话模型，首次发送消息后才创建会话
- 点击历史会话可以恢复对话和右侧观测台状态
- 切换测试场景时保存当前会话并清空工作区
- 桌面端按照 1536 × 1024 参考图重新调整三栏比例、结果卡、观测台和底部输入区
- OpenAI 默认模型改为 \`gpt-5.6-luna\`，\`terra\` 和 \`sol\` 保留为设置中的手动选项

### 2.1.0
- 修复服务从其他目录启动时无法读取项目根目录 \`.env\` 和 \`.env.local\` 的问题
