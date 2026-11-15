# 生产部署速查

完整说明见 [../docs/deployment.md](../docs/deployment.md)。本文件只保留上线时最短的操作路径。

## 形态

```text
浏览器 ──HTTPS──▶ Caddy（自动证书） ──内网──▶ Next.js standalone（单实例 + SQLite 卷）
```

- 应用只监听 `127.0.0.1:3000`，公网只开 80/443。
- SQLite 落在命名卷 `smartai_data:/app/data`；不要多副本共用同一个库。
- 本项目是**单实例**应用，Caddy 只做反向代理与 HTTPS。

## 服务器

Ubuntu 22.04/24.04，2C2G，20GB 磁盘；安全组放行 22/80/443。
域名解析到服务器 IP；中国大陆服务器 + 域名需要备案，香港/海外不需要。

## 上线

```bash
curl -fsSL https://get.docker.com | sh
git clone <your-repo-url> /opt/smart-ai
cd /opt/smart-ai/deploy
cp .env.example .env      # 填 DOMAIN，按需填模型 Key
docker compose -f docker-compose.prod.yml up -d --build
curl -s https://$DOMAIN/api/health
```

`bootstrap.sh` 会把上述步骤串起来执行；`deploy.ps1` 用于在本地 Windows 上远程编排。

## 变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `DOMAIN` | 是 | Caddy 申请证书用 |
| `DEEPSEEK_API_KEY` | 否 | 留空则为规则模式 |
| `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL` | 否 | 指向兼容端点（Ollama/vLLM） |
| `ADMIN_TOKEN` | 否 | 政策库写接口口令；不填则写接口 403 |

## 更新与备份

```bash
git pull && docker compose -f docker-compose.prod.yml up -d --build
docker run --rm -v smartai_data:/data -v $PWD:/backup alpine tar czf /backup/smartai-$(date +%F).tgz -C /data .
```
