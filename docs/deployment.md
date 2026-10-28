# 演示部署与恢复

## 状态和边界

本地 standalone 构建、API、浏览器流程已验证。Docker、GitHub Actions 及
公网发布尚未在目标环境执行：当前电脑未检测到 Docker，没有服务器地址、
域名和发布凭据。仓库提供工作流，不表示工作流已经运行成功。

这是单进程演示：用户通过匿名会话进入，不需要账号密码。任务和会话归属
只存在当前进程内，重启丢失；24 小时后访问过期任务返回不可用。不适合
多副本、负载均衡或会随请求切换实例的无服务器部署。数据持久化与真实
模型、OCR、正式办理接口仍未接入。

## 本地验证

Node.js 22：

```powershell
npm ci
npm run lint
npm test
npm run build
npm run typecheck
npx playwright install chromium
npm run test:e2e
```

不要在同一目录同时运行 `next dev` 和构建。Windows 若自动服务回收卡住，
分开两个终端运行：

```powershell
node scripts/start-demo.mjs
```

第二终端：

```powershell
$env:E2E_EXTERNAL_SERVER="1"
npm run test:e2e
npm run test:performance
```

性能脚本默认访问本机 3107 端口，可通过 `PERF_BASE_URL` 指定受控测试环境。
禁止把它当作真实 LLM 性能测试。测试后在第一终端 Ctrl+C 结束服务。

## Docker 单实例

```sh
docker compose up -d --build app
curl --fail http://127.0.0.1:3000/api/health
docker compose logs --tail 100 app
```

默认只绑定回环地址。通过服务器现有 HTTPS 反向代理转发到 3000，保留
Host 和 HTTPS 转发信息，关闭对任务动态响应的代理缓存；不要把实例复制
成多副本。首次访问后完整演示一遍创建、追问、证据、确认、指南、家属页面。
密钥放服务器环境配置，不进镜像或仓库。

数据库仅作为可选服务：`docker compose --profile database up -d postgres`。
启动数据库并不会让本演示自动切换到数据库存储。

## CI 与镜像发布

`ci.yml` 在 push/PR 时执行单测、生产构建、浏览器测试和容器健康检查，
并保存 Playwright 报告。尚未推送，因此未取得远端 CI 结果。

`publish.yml` 需在 GitHub Actions 手动触发；通过检查后构建镜像，发布
到当前仓库对应 GHCR 路径，标签为提交 SHA。它发布镜像，不会安装到
服务器。配置服务器时使用经过检查的 SHA 标签，保留上一版本用于回滚。
如需自动服务器发布，必须先确定服务器平台与其部署凭据。

## 健康、日志与恢复

`GET /api/health` 显示 demo / process-memory，不检测外部数据库或模型。
Docker 每 30 秒探活，进程退出后按 Compose 策略重启；unhealthy 状态
本身不会自动重启，需要运维处理或外部监控。日志可用
`docker compose logs` 查看，不输出用户描述、证件或密钥。

回滚到上一 SHA 镜像并重建容器；任务不备份，重启后用户重新创建。
当前不能宣称有生产级备份、登录账号或可恢复任务存储。

## 剩余依赖问题

2026-10-28 的 npm 审计：已修复 Zod、PostCSS 和 Vitest/Tinypool 告警。
仍有 3 项 high，均属于 Prisma -> @prisma/config -> deepmerge-ts 依赖链；
`npm audit fix` 未解决。该工具链不在演示业务请求路径，但在用于真实
数据库工作流前仍需评估/升级，不应声称依赖审计完全通过。
