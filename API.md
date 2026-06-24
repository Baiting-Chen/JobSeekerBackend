# API 文档总览

**Base URL:** `http://localhost:3001/api/v1`

所有请求需要 `credentials: "include"`（携带 cookie）。受保护接口需要 `Authorization: Bearer <accessToken>`。

---

## 1. Auth `/auth`

### `POST /auth/register`
```json
{
  "email": "test@example.com",
  "password": "12345678",
  "firstName": "Baiting",
  "lastName": "Chen",
  "targetRole": "Software Engineer",
  "location": "Toronto",
  "linkedIn": "https://linkedin.com/in/xxx"
}
```
- `email`、`password`、`firstName`、`lastName` 必填，其余选填
- `password` 最少 8 位

Response `201`：`{ "accessToken": "<jwt>" }`（同时写入 httpOnly cookie `refreshToken`）

### `POST /auth/login`
```json
{ "email": "test@example.com", "password": "12345678" }
```
Response `200`：`{ "accessToken": "<jwt>" }`

### `POST /auth/refresh`
无 body，自动读取 cookie。
Response `200`：`{ "accessToken": "<jwt>" }`

### `POST /auth/logout`
无 body。
Response `200`：`{ "message": "Logged out" }`

---

## 2. User Profile `/users`（需要登录）

### `GET /users/me`
Response `200`：
```json
{
  "id": "uuid",
  "email": "test@example.com",
  "firstName": "Baiting",
  "lastName": "Chen",
  "targetRole": "Software Engineer",
  "location": "Toronto",
  "linkedIn": "https://linkedin.com/in/xxx",
  "createdAt": "2026-06-10T00:00:00.000Z"
}
```

### `PATCH /users/me`
Body（任意字段，只传要改的）：
```json
{ "location": "Vancouver" }
```
Response `200`：更新后的完整 profile

### `POST /users/me/resume`
上传简历文件（PDF 或 DOCX），解析为纯文本后存库。

- Content-Type: `multipart/form-data`
- 字段名：`resume`
- 支持格式：`.pdf`、`.docx`
- 大小限制：5MB

Response `200`：
```json
{ "resumeFileName": "my_resume.pdf" }
```

### `GET /users/me/resume`
Response `200`：
```json
{
  "resumeFileName": "my_resume.pdf",
  "resumeText": "John Doe\nSoftware Engineer..."
}
```
未上传过简历时两个字段均为 `null`。

---

## 3. Job Extractor `/jobs`（需要登录）

### `POST /jobs/description`
```json
{ "url": "https://www.linkedin.com/jobs/view/xxxx" }
```
Response `200`：
```json
{
  "isJob": true,
  "company": "Google",
  "companyDescription": "Google builds products that help people...",
  "position": "Software Engineer",
  "requirements": "...",
  "description": "...",
  "location": "Remote",
  "salary": "$120k-150k"
}
```
仅做抓取/AI 解析，**不落库**。`companyDescription` 仅在页面本身带"About Us"类公司简介时才会有值，否则为 `null`（不会凭公司名臆测）。

---

## 4. Applications `/applications`（需要登录）

| Method | Path | 用途 |
|--------|------|------|
| POST | `/applications` | 创建（保存一条 application） |
| GET | `/applications` | 列出当前用户所有 application |
| GET | `/applications/:id` | 查单条 |
| PATCH | `/applications/:id` | 更新（含改 status） |
| DELETE | `/applications/:id` | 删除 |

### `POST /applications`
```json
{
  "url": "https://...",
  "company": "Google",
  "companyDescription": "Google builds products that help people...",
  "position": "Software Engineer",
  "requirements": "...",
  "description": "...",
  "location": "Remote",
  "salary": "$120k-150k"
}
```
Response `201`：创建后的完整 application 对象（含 `id`、`status: "SAVED"`、`createdAt`、`updatedAt`）

### `PATCH /applications/:id`
```json
{ "status": "APPLIED" }
```
`status` 枚举值：`SAVED` | `APPLIED` | `INTERVIEWING` | `OFFER` | `REJECTED`

---

## 5. Gap Analysis `/gap-analysis`（需要登录）

### `POST /gap-analysis`
分析当前用户简历与指定 application 的 JD 差距。需提前：
1. 上传简历（`POST /users/me/resume`）
2. 保存该 application（`POST /applications`），且该 application 至少有 `requirements` 或 `description`

JD 内容直接从已保存的 `Application` 读取，不再通过请求体传递。

Body：
```json
{ "applicationId": "uuid", "force": false }
```
`force`（可选，默认 `false`）：传 `true` 时跳过缓存，强制重新调用 LLM 并覆盖该输入对应的缓存结果。

Response `200`：
```json
{
  "overallMatch": 72,
  "breakdown": { "mustHaveScore": 65, "niceToHaveScore": 85 },
  "requiredSkills": [
    {
      "skill": "TypeScript",
      "category": "must_have",
      "matchLevel": "strong",
      "evidence": "Built a full-stack TypeScript application"
    },
    {
      "skill": "Kubernetes",
      "category": "nice_to_have",
      "matchLevel": "missing",
      "evidence": null
    }
  ],
  "matchedSkills": ["TypeScript"],
  "missingSkills": ["Kubernetes"],
  "suggestions": [
    "Add a project showcasing Kubernetes deployment"
  ]
}
```
同一份简历 + 同一个 application 内容重复调用会直接返回缓存结果（不会重新调用 LLM），`breakdown` 中某类别（must_have / nice_to_have）在 JD 中不存在时返回 `null` 而非 `0`。

---

## 6. Cover Letter `/cover-letter`（需要登录）

### `POST /cover-letter`
基于当前用户简历 + 指定 application 的 JD（以及该 application 上的 `companyDescription`，如果有）生成一份求职信。需提前：
1. 上传简历（`POST /users/me/resume`）
2. 保存该 application（`POST /applications`），且该 application 至少有 `requirements` 或 `description`

Body：
```json
{ "applicationId": "uuid", "force": false }
```
`force`（可选，默认 `false`）：传 `true` 时跳过缓存，强制重新生成并覆盖该输入对应的缓存结果。

Response `200`：
```json
{ "content": "Dear Hiring Team,\n\n..." }
```
和 Gap Analysis 一样按 `userId + inputHash`（简历 + JD + companyDescription）缓存，同样的输入重复调用直接返回缓存结果，不会重新调用 LLM；需要换一版说法时传 `force: true`。

---

## 7. Interview Prep `/interview-prep`（需要登录）

### `POST /interview-prep`
基于指定 application 的 JD 生成面试题（不需要简历）。需提前保存该 application，且至少有 `requirements` 或 `description`。

Body：
```json
{ "applicationId": "uuid" }
```

Response `200`：
```json
{
  "questions": [
    {
      "question": "Can you walk me through a project where you used TypeScript in production?",
      "category": "technical",
      "tip": "Focus on a specific challenge and how type safety helped catch it early."
    }
  ]
}
```
`category` 枚举值：`technical` | `behavioral` | `situational`。不落库，每次调用都会重新生成。

---

## 推荐使用流程（Add Application 功能）

```
1. 用户粘贴 job URL
2. 前端调 POST /jobs/description → 拿到 AI 解析的 JD
3. 用户确认/编辑信息
4. 前端调 POST /applications → 真正保存
5. 之后用户在列表页调 PATCH /applications/:id 更新 status
```

---

## 通用注意事项
- `accessToken` 存内存，不存 localStorage
- 401 时先调 `/auth/refresh` 换新 token 再重试原请求
- `targetRole`、`location`、`linkedIn`（user）和 `company`、`position` 等（application）均为可选字段，未填时为 `null`
