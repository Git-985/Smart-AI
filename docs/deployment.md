# 部署指南

> 在线演示：[https://wbapp-551hbcyvpjrcfwqseim6oe.app.workbuddy.host/?sharecode=6HHKLUBS53](https://wbapp-551hbcyvpjrcfwqseim6oe.app.workbuddy.host/?sharecode=6HHKLUBS53)（已配置服务端 DeepSeek Key，Key 不进入前端与仓库）

三种形态：**本地运行**、**单机 Docker**、**云服务器 + 域名（HTTPS）**。
项目使用 SQLite 与本地 OCR，属于**单实例应用**：不要横向扩容多副本，也不适合部署到无持久磁盘的纯 Serverless 平台。

---

## 1. 本地运行

```bash
cp .env.example .env.local
npm ci
npm run dev            # http://localhost:3000
```

生产模式：

```bash
npm run build
PORT=3000 npm run start
```

要求：Node ≥ 22.12，`.data/` 可写。首次构建约 1–2 分钟；扫描件 OCR 首次会加载语言包（5–10s）。

---

## 2. 单机 Docker

```bash
docker compose up -d --build
curl -s localhost:3000/api/health
```

- 只绑定 `127.0.0.1:3000`，不直接暴露公网。
- SQLite 落在命名卷 `smartai_data`，容器重建不丢任务。
- 镜像基于 `node:22-bookworm-slim`，standalone 输出，镜像内以 `node` 用户运行。

停止 / 更新：

```bash
docker compose down
git pull && docker compose up -d --build
```

---

## 3. 云服务器 + 域名（推荐用于公网演示）

`deploy/docker-compose.prod.yml` 同时启动应用与 Caddy：Caddy 负责 80/443、自动申请与续期证书，应用只在内网监听。

### 3.1 准备

| 项目 | 建议 |
|---|---|
| 服务器 | Ubuntu 22.04/24.04，2 核 2G，20GB 磁盘 |
| 安全组 | 放行 22、80、443；**不要**放行 3000 |
| 域名 | 任意可解析域名；无域名可用 `xxx.sslip.io` 临时替代 |
| 备案 | 香港/海外服务器不需要 ICP；中国大陆服务器 + 域名需备案 |

### 3.2 上线步骤

```bash
# 1) 服务器安装 Docker
curl -fsSL https://get.docker.com | sh

# 2) 拉代码
git clone <your-repo-url> /opt/smart-ai
cd /opt/smart-ai/deploy

# 3) 配置环境（不要提交 .env）
cat > .env <<'ENV'
DOMAIN=your-domain.example.com
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
ADMIN_TOKEN=
ENV

# 4) 启动
docker compose -f docker-compose.prod.yml up -d --build

# 5) 验证
curl -s https://your-domain.example.com/api/health
```

`deploy/bootstrap.sh` 封装了上述步骤（安装 Docker、写环境、启动、健康检查），可参考或直接执行。

### 3.3 环境变量

生产编排读取 `deploy/.env`：

| 变量 | 说明 |
|---|---|
| `DOMAIN` | 必填，Caddy 用它申请证书 |
| `DEEPSEEK_API_KEY` | 可选；不填走规则模式 |
| `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL` | 可选，指向兼容端点 |
| `ADMIN_TOKEN` | 可选；不填则政策库写接口 403 |

完整变量见 [environment.md](environment.md)。

### 3.4 数据与备份

```bash
# 备份 SQLite（热备需同时处理 WAL）
docker compose -f docker-compose.prod.yml exec app \
  node -e "const db=require('node:sqlite');const s=new db.DatabaseSync('/app/data/smart-ai.sqlite');s.exec('PRAGMA wal_checkpoint(TRUNCATE)')"
docker run --rm -v smartai_data:/data -v $PWD:/backup alpine \
  tar czf /backup/smartai-$(date +%F).tgz -C /data .
```

恢复时把备份解回同名卷并重启即可。

### 3.5 更新与回滚

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build   # 滚动重建
# 回滚：git checkout <上一个 commit> 后重复上面命令
```

SQLite 结构为“启动时建表 + 补种子”，无独立迁移脚本；跨版本升级前先备份。

---

## 4. 公网托管平台的取舍

| 平台 | 是否适合 | 原因 |
|---|---|---|
| 云服务器 / 轻量应用服务器 | ✅ 推荐 | 有持久磁盘、可跑 Docker、可上 HTTPS |
| 自建 VPS + Caddy | ✅ | 同上，证书自动 |
| Vercel / Netlify 等 Serverless | ⚠️ 不建议 | 无持久磁盘：SQLite 会丢；OCR 依赖本地二进制与语言包，冷启动慢 |
| 纯静态托管 | ❌ | 需要服务端接口与模型调用 |

如果必须用 Serverless，需要把存储换成外部数据库、OCR 换成云服务，属于另一套改造。

---

## 5. 排障

| 现象 | 排查 |
|---|---|
| 502 / 容器不停重启 | `docker compose logs app`；多为 `.data` 不可写或端口占用 |
| Caddy 证书申请失败 | 域名未解析到本机 / 80 端口被占用 / 大陆服务器未备案 |
| 页面能开但模型不生效 | `/api/health` 看 `modelConfigured`；检查 Key 与出网 |
| OCR 报错 | 确认镜像内含 `public/tessdata`，或挂载该目录 |
| 任务丢失 | 检查卷是否挂载到 `/app/data`，以及是否多副本同时写同一个库 |
