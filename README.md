# Smart AI（明白办）

面向老年人、残障人士与低数字素养人群的无障碍公共服务办理引导平台。

项目把复杂的公共服务咨询拆解为一条**可确认、可追溯的任务**：识别事项、追问地区与年份、检索政策证据、检查材料元数据、提示风险并交由用户确认。没有适用证据时明确拒答，不给出未经核实的结论。

首期覆盖三类场景：城乡居民医保参保缴费、高校学生资助申请、老年与残障人士公共服务材料办理。

## 项目简介

### 背景

公共服务政策术语密集，地区、年份、人群条件往往藏在附件和脚注里；用户常常不知道先交什么、去哪里办、材料是否齐全。老年人、残障人士和低数字素养人群还面临字体小、操作复杂、担心证件泄露等额外门槛。

### 主要功能

- **事项识别与追问**：信息不全时先追问地区和年份，不直接下结论。
- **政策证据链**：证据包含事项、地区、有效期、条款、来源和适用理由；地区或时间不匹配时返回空结果。
- **无证据拒答（fail-closed）**：检索不到适用证据时，明确告知无法确认，不编造政策。
- **材料元数据检查**：只校验浏览器提供的文件类型与大小，不接收文件内容，不执行 OCR。
- **风险确认与最小审计**：医疗、费用、资格权益等场景必须人工确认；审计只记录任务 ID、事件类型、风险级别与时间。
- **无障碍支持**：100%–175% 字号、高对比度、键盘操作、语音输入/播报降级、家属协助清单。
- **匿名会话隔离**：HttpOnly Cookie；任务页面与变更接口校验会话归属。

### 演示说明

- 演示使用虚构人物、虚构地区和模拟政策条款，所有证据卡均标注“演示政策、虚构样例”。
- 材料检查只读取类型和大小，不上传文件内容，不做 OCR。
- 用户确认只代表知情，**不等于正式提交**；系统不代替任何政府窗口。
- 当前未接入真实大模型、真实政策库、OCR 和持久化数据库，这些属于后续扩展。

## 技术架构

### 总体架构

```mermaid
flowchart LR
  U[用户 / 家属] --> UI[Next.js App Router 无障碍界面]
  UI --> T[任务 API]
  UI --> C[对话与追问 API]
  UI --> D[材料元数据 API]
  UI --> A[确认与审计 API]

  T --> S[匿名会话 + 单进程任务状态]
  C --> W[规则状态机]
  W --> R[演示政策检索]
  R --> F[事项 / 地区 / 时间过滤]
  F --> E[证据卡 / 无证据拒答]

  D --> M[MIME + 文件大小检查]
  A --> H[风险确认 + 最小审计]

  DB[(PostgreSQL / pgvector 预留)] -. 后续接入 .-> S
  LLM[真实模型 预留] -. 后续接入 .-> W
  OCR[OCR 预留] -. 后续接入 .-> D
```

### 技术栈

- **前端与服务端**：Next.js 15（App Router）、React 19、TypeScript
- **接口**：Next.js Route Handlers，Zod 校验输入
- **状态与会话**：单进程内存任务存储、HttpOnly 匿名会话
- **测试**：Vitest 单元测试、Playwright 端到端测试
- **构建与部署**：Next.js standalone、Docker、Docker Compose、Caddy
- **后续扩展预留**：Prisma / PostgreSQL / pgvector、真实模型、OCR

### 工程规范

- TypeScript + ESLint；API 输入统一使用 Zod 校验。
- 页面、组件、业务库、接口分层；关键边界有单元测试与端到端测试覆盖。
- 提交信息使用 `feat:`、`fix:`、`docs:`、`chore:` 前缀。
- 仓库保留完整 Git 提交历史，可追溯各阶段开发内容。

### 目录结构

```text
app/                 页面与 Route Handlers
components/          任务工作台、无障碍设置、家属协助等组件
lib/ai/              Agent 状态流、结构化输出与提示词
lib/rag/             政策证据类型与检索
lib/security/        PII 脱敏、风险规则、会话与审计
lib/api/             API 输入 schema
prisma/              数据模型（后续数据库扩展）
scripts/             演示启动与性能脚本
tests/               单元测试与端到端测试
deploy/              Docker Compose、Caddy、部署脚本
docs/final/          技术文档、架构图、演示脚本、验收清单
```

## 安装与运行指南

### 环境要求

- Node.js 20.9 或更高版本（推荐 22 LTS；仓库提供 `.nvmrc`）
- npm 10 或更高版本
- 可选：Docker 与 Docker Compose（用于容器部署）
- 可选：PostgreSQL + pgvector（当前演示未接入，仅为后续扩展预留）

### 安装

```bash
npm ci
```

如果 npm 下载较慢，可临时切换到国内镜像（仅影响本机 npm 配置）：

```bash
npm config set registry https://registry.npmmirror.com
npm ci
```

安装完成后如需要，可用 `npm config set registry https://registry.npmjs.org` 还原。

### 环境配置

演示模式不需要真实密钥，可直接运行。需要自定义配置时：

```powershell
Copy-Item .env.example .env
```

或：

```bash
cp .env.example .env
```

### 启动

开发模式：

```bash
npm run dev
```

访问 `http://localhost:3000`，演示入口为 `/demo`。

生产模式本地演示：

```bash
npm run build
node scripts/start-demo.mjs
```

访问 `http://127.0.0.1:3107`。

Docker 单实例：

```bash
docker compose up -d --build app
```

### 验证

```bash
npm run lint
npm test
npm run build
npm run typecheck
npx playwright install chromium
npm run test:e2e
```

当前结果：19 项单元测试、16 项 Playwright 用例（桌面与 390px 移动端）。覆盖追问、跨地区无证据、会话隔离、超时重试、文件元数据和确认不完成等边界。

### 部署

生产单实例（Docker Compose + Caddy 自动 HTTPS）见 [`deploy/README.md`](deploy/README.md)。

本项目是**单进程内存演示**，不支持多副本、负载均衡或 Serverless 部署；服务重启后任务会丢失。

## 环境变量

模板文件：`.env.example`。演示模式全部可留空。

| 变量 | 必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | 否 | PostgreSQL 连接串；当前演示未接入数据库 |
| `LLM_API_KEY` | 否 | 真实模型密钥；当前未接入 |
| `LLM_BASE_URL` | 否 | 模型服务地址；当前未接入 |
| `LLM_MODEL` | 否 | 模型名称；当前未接入 |
| `EMBEDDING_API_KEY` | 否 | 向量检索密钥；预留 |
| `STORAGE_ENDPOINT` | 否 | 对象存储地址；预留 |
| `STORAGE_BUCKET` | 否 | 对象存储桶名；预留 |
| `NEXT_PUBLIC_APP_URL` | 否 | 部署后的公开访问地址 |

不要将真实密钥、真实证件或上传文件提交到仓库。

## 依赖清单

核心运行依赖（版本以 `package.json` 为准）：

- `next`、`react`、`react-dom`
- `zod`、`zustand`、`lucide-react`
- `@prisma/client`（数据库扩展预留）

开发与测试依赖：

- `typescript`、`eslint`、`eslint-config-next`
- `vitest`、`@playwright/test`
- `prisma`、`tsx`、`@types/node`、`@types/react`、`@types/react-dom`

依赖锁定文件为 `package-lock.json`，安装时使用 `npm ci` 以保证可复现。

## 演示视频

- 录制脚本：[`docs/final/demo-script.md`](docs/final/demo-script.md)
- 视频链接：待补充（提交前填写 Bilibili / 网盘链接）

建议录制路径：`/demo` 三类场景 → 事项识别 → 补地区与年份 → 证据卡 → 跨地区无证据 → 材料元数据 → 知情确认 → 家属协助。

## 团队信息

| 项目 | 内容 |
|---|---|
| 团队名称 | jhjnb |
| 团队编号 | 41573 |
| 所属院校 | 广州商学院 |
| 参赛组别 | B组 |
| 团队人数 | 3 人 |

## 相关文档

- [技术文档](docs/final/technical-document.md)
- [架构图](docs/final/architecture.md)
- [演示脚本](docs/final/demo-script.md)
- [验收清单](docs/final/acceptance-checklist.md)
- [部署说明](deploy/README.md)
