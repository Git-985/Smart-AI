# 接口说明

所有接口位于 `app/api/**/route.ts`，运行在 Node.js Runtime。
约定：

- 请求与响应均为 JSON（`/api/documents/parse` 例外，使用 `multipart/form-data`）。
- 入参统一用 Zod 校验，不合法返回 400，并给出稳定错误码。
- 任务类接口通过 HttpOnly Cookie 校验会话归属；不属于当前会话的任务返回 404，避免探测。
- 时间均为 ISO 字符串；`year` 为四位数字字符串。

---

## 1. `POST /api/tasks` 创建任务

**请求**

```json
{
  "message": "帮父亲了解今年居民医保怎么缴费，他行动不太方便。",
  "serviceType": "medical_insurance",
  "region": "河南省周口市",
  "year": "2026"
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `message` | 是 | 1–2000 字，先脱敏再入库；不能只有空白 |
| `serviceType` | 否 | 从模块入口进入时带上，优先于自动识别 |
| `region` / `year` | 否 | 材料或页面已提供时可一并提交 |

**响应** `200`：完整任务对象（`id`、`serviceType`、`missingFields`、`status`、`title` 等）。
`missingFields` 非空表示需要补充信息；此时 `status` 为 `CLARIFYING`。

**错误**：`400 INVALID_TASK_INPUT`。

---

## 2. `POST /api/chat` 检索政策 / 生成解答

同一接口承担四种动作，按入参区分：

| 动作 | 入参 | 说明 |
|---|---|---|
| 继续梳理 | `region`、`year`（或 `clarification`） | 检索政策并生成六问与办理顺序 |
| 提交六问答案 | `answers[]` | 重新生成个性化方案 |
| 继续追问 | `followUp: {kind, text}` | 只追加一条回答，不重跑整份指引 |

```json
{
  "taskId": "demo_2f1c...",
  "region": "河南省周口市",
  "year": "2026",
  "answers": [
    { "question": "这次是给谁办？", "answer": "给父亲本人办" },
    { "question": "补充说明", "answer": "父亲是低保户，我只能周末回来。" }
  ]
}
```

**响应** `200`

```json
{
  "task": { "id": "demo_...", "status": "WAITING_CONFIRMATION", "guidance": { "...": "..." } },
  "reply": { "id": "...", "question": "...", "answer": "...", "citations": ["..."] },
  "message": "已按右侧知识库条目生成解答与办理全流程..."
}
```

**错误**

| 码 | HTTP | 触发 |
|---|---|---|
| `INVALID_CHAT_INPUT` | 400 | 字段格式不合法 |
| `TASK_NOT_FOUND` | 404 | 任务不存在或不属于当前会话 |
| — | 400 | 补充内容超过 6000 字 |

---

## 3. `POST /api/confirmations` 知情确认

```json
{ "taskId": "demo_...", "acknowledged": true }
```

**响应** `200`

```json
{
  "taskId": "demo_...",
  "acknowledged": true,
  "taskStatus": "READY",
  "message": "已记录您了解本次办理的适用范围；这不代表正式申请已提交或完成。"
}
```

**错误**：`400 INVALID_CONFIRMATION`、`404 TASK_NOT_FOUND`、`409 TASK_NOT_WAITING_FOR_CONFIRMATION`。

确认只写一条审计（任务 ID、事件类型、风险级别、时间），不记录正文。

---

## 4. `POST /api/documents` 文件元数据校验

仅接收类型与大小，不接收文件内容，用于旧接口与自动化测试。

```json
{ "mimeType": "image/png", "size": 204800 }
```

支持 `image/jpeg`、`image/png`、`application/pdf`，最大 10MB。
**响应**：`{ "mimeType": "...", "message": "仅校验元数据，未执行 OCR。" }`
**错误**：`400 INVALID_FILE_METADATA`。

---

## 5. `POST /api/documents/parse` 材料解析

`multipart/form-data`

| 字段 | 必填 | 说明 |
|---|---|---|
| `file` | 是 | PDF / DOCX / TXT / PNG / JPG / WEBP，≤10MB |
| `serviceType` | 否 | 决定材料核对项；缺省用通用清单 |

**响应** `200`

```json
{
  "filename": "医保缴费须知.txt",
  "mimeType": "text/plain",
  "size": 1834,
  "pages": null,
  "textLength": 83,
  "truncated": false,
  "text": "……",
  "ocrUsed": false,
  "report": {
    "status": "ready",
    "headline": "已读取 83 字，识别到 5/5 类社保缴纳关键信息。",
    "moduleLabel": "社保缴纳",
    "file": { "name": "…", "typeLabel": "文本文件", "sizeLabel": "1.8 KB", "textLength": 83, "source": "文本层" },
    "checks": [{ "label": "身份证明（身份证/户口簿）", "hit": true }],
    "findings": ["日期：2026年1月5日", "金额：380元"],
    "warnings": [],
    "nextSteps": ["核对姓名、证件号码与办理年度是否一致。"]
  }
}
```

扫描版 PDF（文字层有效字符 < 30）会自动渲染前 3 页做 OCR，`ocrUsed=true` 并返回置信度与页数。

**错误**：`415 INVALID_CONTENT_TYPE` / `UNSUPPORTED_TYPE`、`400 MISSING_FILE` / `EMPTY_FILE`、
`413 FILE_TOO_LARGE`、`422 NO_TEXT` / `PARSE_FAILED`。

---

## 6. `GET /api/policies` 政策库（公开只读）

返回全部政策条目，按入库顺序；`Cache-Control: no-store`。

```json
{ "policies": [{ "policyId": "policy_...", "title": "...", "serviceType": "medical_insurance", "region": "全国", "effectiveAt": "2026-01-01", "quote": "...", "sourceUrl": "https://...", "relevance": 0.9 }] }
```

## 6.1 `POST /api/policies` / `DELETE /api/policies?id=...` 维护

默认**只读**：未配置 `ADMIN_TOKEN` 时返回 `403 POLICY_READONLY`；配置后需带 `x-admin-token` 请求头，错误口令返回 `401 UNAUTHORIZED`。
`POST` 字段：`title`（≥4 字）、`serviceType`、`region`、`quote`（≥10 字）、`sourceUrl`（合法 URL）、`applicabilityReason`（≥4 字），可选 `effectiveAt` / `expiredAt` / `section` / `relevance`。

---

## 7. `POST /api/policies/search` 检索

```json
{ "query": "医保缴费", "region": "河南省周口市", "serviceType": "medical_insurance", "year": "2026" }
```

**响应**：`{ "evidence": [{ "policyId": "...", "title": "...", "relevance": 0.87, "applicabilityReason": "适用于河南省…" }], "count": 6 }`
无匹配时 `evidence` 为空数组，前端据此走“无适用证据”分支，不生成结论。

---

## 8. `GET /api/health` 健康检查

```json
{
  "status": "ok",
  "mode": "standalone",
  "storage": "sqlite",
  "modelConfigured": true,
  "modelProvider": "deepseek",
  "documentParsing": true,
  "ocrEnabled": true,
  "policyCount": 63
}
```

`modelConfigured` 为 `true` 的条件：配置了 `DEEPSEEK_API_KEY` **或** `DEEPSEEK_BASE_URL`（本地模型）。

---

## 错误码汇总

| HTTP | 代码 | 含义 |
|---|---|---|
| 400 | `INVALID_*` | 入参校验失败 |
| 400 | `MISSING_ID` | 删除政策未带 id |
| 401 | `UNAUTHORIZED` | 管理口令不匹配 |
| 403 | `POLICY_READONLY` | 政策库未开启写权限 |
| 404 | `TASK_NOT_FOUND` | 任务不存在或会话不符 |
| 409 | `TASK_NOT_WAITING_FOR_CONFIRMATION` | 当前状态不能确认 |
| 413 | `FILE_TOO_LARGE` | 文件超过 10MB |
| 415 | `UNSUPPORTED_TYPE` | 文件类型不支持 |
| 422 | `NO_TEXT` / `PARSE_FAILED` | 无法提取文字 / 解析失败 |
