# Smart AI 生产部署：Docker Compose + Caddy + 自动 HTTPS

目标：把当前演示部署到一台 Ubuntu 云服务器，得到一个稳定的 `https://你的域名` 地址。

> 这不是“多副本生产集群”。项目是**单进程内存**，只能单实例运行；Caddy 负责 HTTPS 和反向代理。

## 架构

```text
浏览器 / 手机
      │  HTTPS 443
      ▼
   Caddy（自动申请/续期证书）
      │  内网 app:3000
      ▼
   Next.js standalone（单进程内存 + 匿名会话）
```

- `app` 只绑定 `127.0.0.1:3000`，不直接暴露公网。
- `caddy` 暴露 80/443，自动 HTTP→HTTPS、自动证书。
- 两个容器通过 Compose 默认网络通信。

## 一、你需要准备

| 项目 | 要求 |
|---|---|
| 服务器 | Ubuntu 22.04 / 24.04，2 核 2G，20GB 磁盘，公网 IP |
| 安全组 | 放行 22、80、443（不要放行 3000） |
| 权限 | root，或有 sudo 的用户 |
| 域名 | 已有域名 / DuckDNS 免费二级域名 / `sslip.io` 应急 |
| 备案 | 服务器在中国香港/海外：不需要 ICP 备案；中国大陆服务器 + 域名：需要备案，否则 80/443 可能被拦 |

### 买服务器的建议

- 阿里云/腾讯云“轻量应用服务器”，地域选**中国香港**，镜像 Ubuntu 22.04，2C2G。
- 海外 Vultr / DigitalOcean / Hetzner 也可以。
- 价格以购买页为准，2C2G 通常几十元/月。
- **不要选中国大陆地域**，除非你已经有备案域名；否则明天之前拿不到 HTTPS 域名。

## 二、域名（三选一）

### A. 已有域名（最稳）

在 DNS 添加 A 记录：

```text
demo.example.com  →  你的服务器公网 IP
```

等待 1–5 分钟，验证：

```powershell
Resolve-DnsName demo.example.com
```

### B. 没有域名：DuckDNS（免费，5 分钟）

1. 打开 <https://www.duckdns.org>，用 GitHub/Google/Reddit 登录。
2. 创建一个子域名，例如 `smartai-demo`，复制 token。
3. 在浏览器打开（把参数换成你的）：

```text
https://www.duckdns.org/update?domains=smartai-demo&token=你的TOKEN&ip=你的服务器IP
```

4. 你的域名就是 `smartai-demo.duckdns.org`。

### C. 应急：sslip.io（不需要注册）

如果服务器 IP 是 `1.2.3.4`，直接用：

```text
1.2.3.4.sslip.io
```

它会把域名解析到 `1.2.3.4`，Caddy 可以正常申请证书。缺点是域名不好看，且公共服务的证书签发可能受速率限制；正式提交优先用 A 或 B。

## 三、部署（Windows 一键）

在项目根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\deploy.ps1 -Server 1.2.3.4 -Domain demo.example.com
```

脚本会：

1. 打包源码（排除 `node_modules`、`.next`、`.git`）；
2. `scp` 上传到 `/root/`；
3. `ssh` 执行 `bootstrap.sh`；
4. 安装 Docker、Compose、配置 2G swap、放行 22/80/443；
5. `docker compose up -d --build`；
6. 等待 `/api/health` 通过，打印地址。

使用密钥：

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\deploy.ps1 `
  -Server 1.2.3.4 -Domain demo.example.com -KeyPath C:\keys\smartai.pem
```

只打包、不上传：

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\deploy.ps1 `
  -Server 127.0.0.1 -Domain demo.example.com -PackageOnly
```

生成的文件：`deploy\smartai-src.zip`。

## 四、部署（手动，服务器上执行）

先在本地生成包（见上面的 `-PackageOnly`），然后：

```powershell
scp .\deploy\smartai-src.zip .\deploy\bootstrap.sh root@1.2.3.4:/root/
ssh root@1.2.3.4 "DOMAIN=demo.example.com bash /root/bootstrap.sh /root/smartai-src.zip"
```

如果服务器已经装好 Docker 和 Compose：

```bash
mkdir -p /opt/smartai && unzip -oq /root/smartai-src.zip -d /opt/smartai
cd /opt/smartai/deploy
echo 'DOMAIN=demo.example.com' > .env
docker compose -f docker-compose.prod.yml up -d --build
```

## 五、验证

```powershell
curl.exe -fsS https://demo.example.com/api/health
```

期望：

```json
{"status":"ok","mode":"demo","storage":"process-memory","modelConfigured":false,"ocrEnabled":false}
```

然后：

- [ ] 浏览器打开 `https://demo.example.com`，走完 `/demo` → 识别 → 补地区/年份 → 证据卡
- [ ] 手机断开 Wi-Fi，用 4G/5G 再走一遍
- [ ] `http://` 自动跳 `https://`
- [ ] 服务器上 `docker compose -f docker-compose.prod.yml ps` 两个服务都是 healthy/running
- [ ] `docker compose -f docker-compose.prod.yml logs --tail=100 caddy` 没有证书错误

## 六、日常运维

```bash
cd /opt/smartai/deploy

# 日志
docker compose -f docker-compose.prod.yml logs -f --tail=100

# 重启
docker compose -f docker-compose.prod.yml restart

# 更新代码：重新上传 zip 后
docker compose -f docker-compose.prod.yml up -d --build

# 清理旧镜像
docker image prune -f
```

- 证书存在 `caddy_data` 卷里，容器重启不会重新申请。
- 任务和会话在内存里，`restart` 后全部丢失，这是演示的已知限制。
- 回滚：上传上一个版本的 zip，重新 `up -d --build`。

## 七、常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| `docker pull` 超时 / Docker Hub 连不上 | 国内网络 | 换香港/海外服务器；或配置镜像加速器后 `systemctl restart docker` |
| 构建被 Killed / OOM | 2G 内存不够 | 确认 2G swap 已启用：`swapon --show`；或临时升到 4G |
| `502 Bad Gateway` | app 没起来 | `docker compose logs app`；`curl 127.0.0.1:3000/api/health` |
| Caddy 证书失败 | DNS 没指向 / 80 被墙 / 80 未放行 | `Resolve-DnsName 域名`；安全组放行 80；`docker compose logs caddy` |
| `docker compose` 不存在 | 只装了 docker.io | 安装 `docker-compose-plugin`，或重跑 bootstrap |
| SSH 连不上 | 安全组没放行 22 / 密钥不对 | 云控制台 VNC 登录检查 |
| 页面样式错乱 | 静态资源没进镜像 | 确认 `npm run build` 成功；重建镜像 |
| 域名打不开但 IP 能开 | DNS 未生效 | 等 5 分钟；`nslookup` 检查 |

## 八、安全边界

- **没有登录/鉴权**：拿到地址的人都能创建演示任务。只放虚拟信息，不要输入真实姓名、身份证、手机号、病历。
- `app` 只绑定 `127.0.0.1:3000`，公网只暴露 Caddy 的 80/443。
- 建议 SSH 只用密钥，禁用密码登录（确认密钥可用后再改）。
- 需要限制访问时，可在 Caddyfile 里加 Basic Auth：

```caddyfile
{$DOMAIN} {
    basic_auth {
        demo $2a$14$替换成哈希
    }
    reverse_proxy app:3000
}
```

生成哈希（在服务器上）：

```bash
docker run --rm caddy:2-alpine caddy hash-password --plaintext '你的密码'
```

然后把哈希填进去，`docker compose restart caddy`。评委访问时需要输一次账号密码。

## 九、为什么不用 Vercel / Serverless

这个演示依赖**单进程内存 + 进程内匿名会话**。Serverless 会在请求之间切换实例，任务和会话会随机丢失，表现为“刚创建的任务打不开”。所以必须用**单实例常驻进程**：本机隧道、VPS Docker，或一台常开电脑。

## 十、时间与成本

- 已有服务器 + 域名：部署 15–25 分钟。
- 从零买服务器 + 配 DuckDNS：30–50 分钟。
- 中国大陆服务器 + 新域名备案：1–3 周，**明天来不及**，不要选这条路。

## 十一、我（AI）能代做到哪一步

能：打包、上传、SSH 登录、装 Docker、写 Caddy 配置、构建、启动、验证、排错。

不能：替你买服务器、实名认证、付款、注册域名。这些必须你本人完成。

如果你把服务器 IP、SSH 用户和密钥（或临时密码）给我，我可以直接执行 `deploy.ps1` 完成剩余步骤；更安全的做法是生成一个临时 SSH key，你只把公钥加到服务器。
