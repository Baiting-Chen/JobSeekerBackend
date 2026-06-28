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
  "weakSkills": [],
  "missingSkills": ["Kubernetes"],
  "suggestions": [
    "Add a project showcasing Kubernetes deployment"
  ]
}
```
`matchedSkills` / `weakSkills` / `missingSkills` 按 `requiredSkills` 的 `matchLevel`（`strong` / `weak` / `missing`）互斥且穷尽划分，每个 skill 恰好落在其中一个列表里。同一份简历 + 同一个 application 内容重复调用会直接返回缓存结果（不会重新调用 LLM），`breakdown` 中某类别（must_have / nice_to_have）在 JD 中不存在时返回 `null` 而非 `0`。

---

## 6. Cover Letter `/cover-letter`（需要登录）

### `POST /cover-letter`
基于当前用户简历 + 指定 application 的 JD（以及该 application 上的 `companyDescription`，如果有）生成一份求职信。内部会复用该 application 的 Gap Analysis 缓存，按 strong/weak/missing 决定信里能不能提某项技能：strong 可以放心强调，weak 只能描述成相关/可迁移经验、不能说成直接经验，missing 不能 claim 或暗示。需提前：
1. 上传简历（`POST /users/me/resume`）
2. 保存该 application（`POST /applications`），且该 application 至少有 `requirements` 或 `description`

Body：
```json
{ "applicationId": "uuid", "force": false }
```
`force`（可选，默认 `false`）：传 `true` 时跳过缓存，强制重新生成并覆盖该输入对应的缓存结果。

Response `200`：
```json
{
  "content": "Dear Hiring Team,\n\n...",
  "check": {
    "passed": true,
    "severity": "none",
    "issues": []
  },
  "rewriteCount": 0
}
```
生成后会自动跑一次安全自检（`check`），核对信里是否 claim 了 missing 技能、把 weak 技能夸大成直接经验、编造简历/公司事实、留了占位符、过于笼统或过长。`severity`：有 claim missing / 编造事实类问题为 `major`，只有 weak 夸大/占位符/笼统/过长类问题为 `minor`，没问题为 `none`；`passed` 仅在 `severity` 为 `none` 时为 `true`。

如果 `check` 没通过，会自动重写并重新检查，最多 2 次（`rewriteCount` 记录实际重写了几次）。`rewriteCount > 0` 且 `check.passed` 仍为 `false`，说明已经用完重写次数、问题还没完全解决，前端这时可以提示用户人工检查或传 `force: true` 整篇重新生成。`check`/`rewriteCount` 只在真正重新生成内容时计算一次，命中缓存时直接返回上次的最终结果，不会重复调用 LLM。

按 `userId + inputHash`（简历 + JD + companyDescription + gap analysis 的 strong/weak/missing 技能列表）缓存，同样的输入重复调用直接返回缓存结果（含 `check`/`rewriteCount`），不会重新调用 LLM；需要换一版说法时传 `force: true`。如果 gap analysis 后续被单独 force 重新生成、结果变了，下次调用这个接口会自动生成新版求职信并重新检查，不需要额外操作。

### `POST /cover-letter/check`（仅用于单独测试 checker）
对任意一段求职信文本跑安全自检，不需要先经过生成——方便直接喂一段手写的"问题求职信"测试 checker 本身的判断是否准确。内部仍会用该 application 的简历 + JD + Gap Analysis 缓存作为检查依据。

Body：
```json
{ "applicationId": "uuid", "coverLetterContent": "Dear Hiring Team,\n\n..." }
```

Response `200`：同 `POST /cover-letter` 里的 `check` 字段结构（`passed`/`severity`/`issues`）。

---

## 7. Interview Prep `/interview-prep`（需要登录）

### `POST /interview-prep`
基于指定 application 的 JD 生成面试题。**简历是可选的增强，不是硬性要求**：没上传简历时，行为和以前一样，只生成基于 JD 的 `role_based` 题目；上传了简历，会额外生成 `resume_based`（针对简历具体内容追问）和 `gap_based`（针对 must-have 缺口的准备题，复用该 application 的 Gap Analysis 缓存）。需提前保存该 application，且至少有 `requirements` 或 `description`。

Body：
```json
{ "applicationId": "uuid", "force": false }
```
`force`（可选，默认 `false`）：传 `true` 时跳过缓存，强制重新生成新一批题目并覆盖该输入对应的缓存结果（用于"换一批题"场景）。

Response `200`：
```json
{
  "questions": [
    {
      "question": "Can you walk me through a project where you used TypeScript in production?",
      "category": "technical",
      "difficulty": "medium",
      "focusArea": "TypeScript in production",
      "questionSource": "resume_based",
      "whatToCover": [
        "Briefly describe the project and your role",
        "Explain a specific type-safety issue TypeScript caught",
        "Describe the measurable impact"
      ]
    }
  ]
}
```
`category` 枚举值：`technical` | `behavioral` | `situational`；`difficulty` 枚举值：`easy` | `medium` | `hard`（相对于 JD 隐含的资历水平）；`focusArea` 是这道题考察的核心技能/技术；`questionSource` 枚举值：`role_based`（仅基于 JD） | `resume_based`（基于简历具体内容） | `gap_based`（针对 must-have 缺口）——没有简历时所有题目的 `questionSource` 都是 `role_based`；`whatToCover` 是 2-4 条该问题强答案应覆盖的要点。按 `userId + inputHash`（JD 内容 + 简历 + must-have 缺口列表，没有简历时后两者不参与）缓存，同样的输入重复调用直接返回缓存结果；想要新一批题目时传 `force: true`。

---

## 8. Resume Improvement Plan `/resume-improvement`（需要登录）

### `POST /resume-improvement`
基于当前用户简历 + 指定 application 的 Gap Analysis 结果，生成简历改进计划（要不要先改简历再投，还是可以直接投）。需提前：
1. 上传简历（`POST /users/me/resume`）
2. 保存该 application，且至少有 `requirements` 或 `description`

内部会复用（而不是重新计算）该 application 的 Gap Analysis 缓存。

Body：
```json
{ "applicationId": "uuid", "force": false }
```
`force`（可选，默认 `false`）：传 `true` 时跳过缓存，强制重新生成。

Response `200`：
```json
{
  "summary": "You're a reasonable fit but missing some core requirements...",
  "shouldApplyNow": false,
  "priorityGaps": [
    {
      "skill": "Kubernetes",
      "category": "must_have",
      "matchLevel": "missing",
      "recommendation": "Add a project that deploys a containerized service to a Kubernetes cluster"
    }
  ],
  "resumeRewriteSuggestions": [
    {
      "targetSkill": "AWS",
      "suggestion": "Surface the EC2/S3 usage already in your backend project more explicitly",
      "canBeSupportedByCurrentResume": true
    }
  ],
  "projectSuggestions": [
    {
      "title": "Deploy a small service to Kubernetes",
      "description": "Containerize an existing project and deploy it to a local or managed Kubernetes cluster",
      "skillsAddressed": ["Kubernetes"]
    }
  ]
}
```
按 `userId + inputHash`（简历 + JD + gap analysis 的 skill/category/matchLevel）缓存。

---

## 9. Application Pack `/application-pack`（需要登录）

### `POST /application-pack`
一次性生成完整申请包：先跑 Gap Analysis，再根据匹配度路由——匹配度低则只给简历改进计划，匹配度合格则生成 Cover Letter + Interview Prep。内部由 LangGraph 编排，依次/并行调用 `GapAnalysisService` / `ResumeImprovementService` / `CoverLetterService` / `InterviewPrepService`，每个子结果仍走各自的缓存，这个 endpoint 本身不落库。

前提条件同上（已上传简历、application 至少有 `requirements` 或 `description`）。

Body：
```json
{
  "applicationId": "uuid",
  "forceGapAnalysis": false,
  "forceCoverLetter": false,
  "forceInterviewPrep": false,
  "forceResumeImprovement": false
}
```

Response `200`（`route: "good_fit"`）：
```json
{
  "route": "good_fit",
  "gapAnalysis": { "overallMatch": 72, "matchedSkills": [], "weakSkills": [], "missingSkills": [], "suggestions": [] },
  "resumeImprovementPlan": null,
  "coverLetter": { "content": "...", "check": { "passed": true, "severity": "none", "issues": [] }, "rewriteCount": 0 },
  "interviewPrep": { "questions": [] }
}
```

Response `200`（`route: "low_fit"`）：
```json
{
  "route": "low_fit",
  "gapAnalysis": { "overallMatch": 42, "matchedSkills": [], "weakSkills": [], "missingSkills": [], "suggestions": [] },
  "resumeImprovementPlan": { "summary": "...", "shouldApplyNow": false, "priorityGaps": [], "resumeRewriteSuggestions": [], "projectSuggestions": [] },
  "coverLetter": null,
  "interviewPrep": null
}
```
`route` 由 `overallMatch`（< 75）以及 must-have 缺口比例共同决定，不是单看总分。`low_fit` 路线只生成简历改进计划，`coverLetter` 和 `interviewPrep` 均为 `null`（避免基于较差匹配度写出一封言过其实的求职信，或准备一份此时还用不上的面试题）；`good_fit` 路线生成 Cover Letter + Interview Prep，`resumeImprovementPlan` 为 `null`。

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
