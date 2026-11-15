# 文档索引

按阅读顺序排列。所有文档与代码同仓维护，提交前请确认链接可打开。

| 序号 | 文档 | 适合谁 | 内容 |
|---|---|---|---|
| 1 | [../README.md](../README.md) | 所有人 | 项目介绍、核心能力、快速开始、架构总览、团队信息 |
| 2 | [technical-report.pdf](technical-report.pdf) | 评委 / 技术评审 | 需求分析、系统架构、AI 方案、核心实现、测试部署、创新点（≤30 页） |
| 3 | [api.md](api.md) | 开发者 | 8 个接口的入参、出参、错误码 |
| 4 | [environment.md](environment.md) | 部署者 | 环境变量、依赖清单、最小配置、常见问题 |
| 5 | [deployment.md](deployment.md) | 部署者 | 本地、Docker、云服务器 + Caddy、公网托管取舍 |
| 6 | [evaluation.md](evaluation.md) | 评测 / 答辩 | 检索用例与结果、单测范围、e2e 覆盖、性能方法 |

## 其他材料

- [../deploy/README.md](../deploy/README.md)：生产部署速查（Docker Compose + Caddy）。
- [../tests/evaluation/cases.json](../tests/evaluation/cases.json)：检索评测原始用例。
- `technical-report.html`：技术文档的网页版（PDF 由它打印生成，便于修改后重新导出）。
