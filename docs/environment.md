# 环境与依赖

本文说明运行 Smart AI 需要什么、每个环境变量管什么、以及不同部署形态下的最小配置。

---

## 1. 运行时要求

| 组件 | 版本 | 说明 |
|---|---|---|
| Node.js | ≥ 22.12 | 使用 `node:sqlite`（实验特性，启动时会有 warning，可忽略） |
| npm | ≥ 10 | 依赖锁定文件为 `package-lock.json`，安装用 `npm ci` |
| 磁盘 | ≥ 500MB | `node_modules` 约 400MB，SQLite 与 OCR 缓存另计 |
| 内存 | ≥ 1GB | 扫描件 OCR 时 tesseract 占用较高，建议 2GB |

不需要独立数据库、Redis 或对象存储。SQLite 文件默认位于 `.data/smart-ai.sqlite`，目录必须可写。

---

## 2. 环境变量

`.env.example` 已包含全部变量，复制为 `.env.local`（本地）或 `.env`（容器）即可。

| 变量 | 必填 | 默认值 | 作用 |
|---|---|---|---|
| `SMART_AI_DB_PATH` | 否 | `.data/smart-ai.sqlite` | SQLite 路径；容器内建议挂载到持久卷 |
| `DEEPSEEK_API_KEY` | 否 | 空 | 模型 Key；留空则走规则引擎 |
| `DEEPSEEK_BASE_URL` | 否 | `https://api.deepseek.com` | OpenAI 兼容端点；本地模型只填此项 |
| `DEEPSEEK_MODEL` | 否 | `deepseek-chat` | 模型名，如 `deepseek-reasoner` / `qwen2.5:14b` |
| `DEEPSEEK_TIMEOUT_MS` | 否 | `8000` | 单次模型调用超时；本地模型建议 30000–60000 |
| `TAVILY_API_KEY` | 否 | 空 | 联网核验（优先） |
| `BOCHA_API_KEY` | 否 | 空 | 联网核验（博查） |
| `SERPER_API_KEY` | 否 | 空 | 联网核验（Serper/Google） |
| `WEB_SEARCH_PROVIDER` | 否 | 自动 | 强制通道：`tavily` / `bocha` / `serper` / `sogou` / `bing` |
| `WEB_SEARCH_DISABLED` | 否 | 空 | `true` 时完全关闭联网核验 |
| `ADMIN_TOKEN` | 否 | 空 | 政策库写接口口令；**不配置则写接口一律 403** |
| `NEXT_PUBLIC_APP_URL` | 否 | `http://localhost:3000` | 对外访问地址（打印页、分享链接） |

> `NEXT_PUBLIC_*` 会被打包进前端，只能放公开信息，禁止放 Key。

### 三种典型配置

**A. 零配置演示（默认）**

```bash
# 什么都不填
npm run dev
```

使用规则引擎 + 本地政策库，六问、步骤、材料报告、OCR 全部可用，界面标注“规则兜底”。

**B. 接入云端模型**

```bash
DEEPSEEK_API_KEY=sk-xxxxxxxx
DEEPSEEK_MODEL=deepseek-chat
```

**C. 本地/私有模型（Ollama 示例）**

```bash
DEEPSEEK_BASE_URL=http://127.0.0.1:11434/v1
DEEPSEEK_MODEL=qwen2.5:14b
DEEPSEEK_TIMEOUT_MS=45000
# DEEPSEEK_API_KEY 留空即可
```

---

## 3. 依赖清单

### 运行时依赖

| 包 | 版本 | 用途 |
|---|---|---|
| `next` | ^15.3.2 | 全栈框架（App Router / Route Handlers） |
| `react` / `react-dom` | ^19.0.0 | 界面 |
| `zod` | 4.6.7 | 模型输出与接口入参校验 |
| `lucide-react` | ^0.468.0 | 图标 |
| `pdf-parse` | ^2.4.5 | PDF 文字层抽取与页面渲染（内含 `pdfjs-dist`、`@napi-rs/canvas`） |
| `mammoth` | ^1.13.0 | DOCX 文本抽取 |
| `tesseract.js` | ^7.0.0 | 本地 OCR（`chi_sim+eng`） |

### 开发依赖

`typescript`、`eslint` + `eslint-config-next`、`vitest`、`@playwright/test`、`tsx`、`@types/*`。

### 语言数据

OCR 中文模型位于 `public/tessdata/chi_sim.traineddata.gz`，首次识别会加载到 `.tesseract-cache/`。
该缓存目录已在 `.gitignore` 中忽略，可随时删除重建。

---

## 4. 目录与权限

| 路径 | 用途 | 权限 |
|---|---|---|
| `.data/` | SQLite 主库与 WAL | 读写 |
| `.tesseract-cache/` | OCR 语言缓存 | 读写 |
| `public/tessdata/` | 中文识别模型 | 只读 |
| `.next/` | 构建产物 | 构建时写 |

容器部署时只挂载 `.data`（和可选的 `.tesseract-cache`），其余随镜像。

---

## 5. 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| 启动提示 `SQLite is an experimental feature` | Node 22 的 `node:sqlite` 提示 | 忽略，不影响运行 |
| `/api/health` 显示 `modelConfigured:false` | 未配置 Key 或 BASE_URL | 按上文配置，或继续使用规则模式 |
| 解析报 `NO_TEXT` | 扫描件过暗/加密 PDF | 改传清晰截图（JPG/PNG） |
| OCR 很慢 | 首次加载语言包 / 页数多 | 首次约 5–10s；单次最多 3 页 |
| 政策库写接口 403 | 未配置 `ADMIN_TOKEN` | 属预期：默认只读 |
| 端口被占用 | 3000 已有进程 | `PORT=3001 npm run start` 或使用 `start.*` 脚本自动换端口 |
