# Smart AI（明白办）

面向老年人、残障人士与低数字素养人群的无障碍公共服务办理引导平台。

项目把复杂的公共服务咨询拆解为一条**可确认、可追溯的任务**：先识别事项，再追问地区与年份，随后检索政策证据、检查材料元数据、提示风险并交由用户确认。没有适用证据时明确拒答，不给出未经核实的结论。

首期覆盖三类场景：

- 城乡居民医保参保、缴费咨询
- 高校学生资助、助学金申请
- 老年与残障人士公共服务材料办理

## 演示入口

启动后访问：

- `/` 首页与任务入口
- `/demo` 三类虚拟场景一键直达
- `/onboarding` 无障碍偏好
- `/task/new` 创建任务
- `/task/[id]` 任务工作台
- `/result/[id]` 办理指南
- `/family/[id]` 家属协助清单
- `/admin/policies` 政策资料管理入口
- `/api/health` 健康检查

演示使用虚构人物、虚构地区与模拟政策条款，所有证据卡均标注“演示政策、虚构样例”。

## 核心能力

- **事项识别与追问**：信息不全时先追问地区和年份，不直接下结论。
- **政策证据链**：证据包含事项、地区、有效期、条款、来源与适用理由；地区或时间不匹配时返回空结果。
- **无证据拒答（fail-closed）**：检索不到适用证据时，明确告知无法确认，不编造政策。
- **材料元数据检查**：只校验浏览器提供的文件类型与大小，不接收文件内容，不执行 OCR。
- **风险确认与最小审计**：医疗、费用、资格权益等场景必须人工确认；审计只记录任务 ID、事件类型、风险级别与时间。
- **无障碍**：100%–175% 字号、高对比度、键盘操作、语音输入/播报降级、家属协助清单。
- **匿名会话隔离**：HttpOnly Cookie，任务与变更接口校验会话归属。

## 技术栈

- Next.js 15（App Router）+ React 19 + TypeScript
- Route Handlers 提供任务、对话、政策检索、材料元数据、确认与健康检查接口
- Zod 校验输入；Vitest 单元测试；Playwright 端到端测试
- 演示任务保存在单进程内存；Prisma/PostgreSQL/pgvector 为后续扩展预留
- Docker standalone 构建；可选 Docker Compose + Caddy 部署

## 本地运行

要求 Node.js 20.9+ 与 npm。

```bash
npm ci
npm run dev
```

访问 `http://localhost:3000`。

`.env` 不是必需的；需要自定义配置时：

```bash
Copy-Item .env.example .env
```

生产模式本地演示（构建后使用）：

```bash
npm run build
node scripts/start-demo.mjs
# http://127.0.0.1:3107
```

## 测试与检查

```bash
npm run lint
npm test
npm run build
npm run typecheck
npx playwright install chromium
npm run test:e2e
```

当前结果：19 项单元测试、16 项 Playwright 用例（桌面与 390px 移动端），覆盖追问、跨地区无证据、会话隔离、超时重试、文件元数据与确认不完成等边界。

## 部署

- 本地 Docker：`docker compose up -d --build app`
- 生产单实例（Docker Compose + Caddy 自动 HTTPS）：见 [`deploy/README.md`](deploy/README.md)
- 部署脚本：`deploy/deploy.ps1`，支持打包、上传、远程构建与健康检查

项目是单进程内存演示，**不支持多副本、负载均衡或 Serverless 部署**；服务重启后任务会丢失。

## 目录结构

```text
app/                 页面与 Route Handlers
components/          界面组件（任务工作台、无障碍设置、家属协助）
lib/ai/              Agent 状态流、结构化输出与提示词
lib/rag/             政策证据类型与检索
lib/security/        PII 脱敏、风险规则、会话与审计
lib/api/             API 输入 schema
prisma/              业务数据模型（后续扩展）
scripts/             演示启动与性能脚本
tests/               单元测试与端到端测试
deploy/              Docker Compose、Caddy、部署脚本
docs/final/          技术文档、架构图、演示脚本、验收清单
```

## 安全与边界

- 仅使用虚拟人物和虚构政策演示；不要输入真实姓名、身份证号、手机号或病历。
- 政策结论必须绑定可验证来源；无证据时不下结论。
- 材料检查只读取类型和大小，不接收文件字节，不做 OCR。
- 用户确认只代表知情，**不等于正式提交**，系统不代替任何政府窗口。
- 当前未接入真实大模型、真实政策库、OCR 与持久化数据库；这些是后续工作。
- 无障碍设置与家属清单仅保存在当前浏览器。

## 参赛信息

- 作品名称：Smart AI（明白办）
- 参赛团队：________________
- 指导教师：________________
- 联系方式：________________
- 演示地址：________________

## 文档

- [技术文档](docs/final/technical-document.md)
- [架构图](docs/final/architecture.md)
- [演示脚本](docs/final/demo-script.md)
- [验收清单](docs/final/acceptance-checklist.md)
- [部署说明](deploy/README.md)
