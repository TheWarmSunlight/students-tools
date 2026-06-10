# AI 学情分析课堂工具

## 本地启动

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

访问 `http://localhost:3000/teacher` 进入教师端。

## 智谱 AI 配置

在 `.env.local` 中配置：

```env
ZHIPU_API_KEY=你的智谱API密钥
```

真实密钥只放在 `.env.local`，不要提交到 Git。

## 常用命令

```powershell
npm run lint
npm run test
npm run build
npm run e2e
```

## 首版课堂流程

1. 教师打开 `/teacher`。
2. 下载或按 Excel 模板整理题目，上传生成课堂。
3. 开启课堂后，把每道题二维码展示到黑板或大屏。
4. 学生用平板扫码进入 `/student/{token}`，填写姓名、座号和答案。
5. 教师端实时查看提交人数、正确率、错误分布和知识点掌握情况。
6. 教师打开报告页，基于统计结果生成 AI 学情诊断。

## Deployment

Production domain: `https://students.mylifeos457.com`

### GitHub and Vercel

1. Push the repository to GitHub.
2. Import the GitHub repository into Vercel.
3. Set the Vercel Production Branch to `main`.
4. Keep Preview deployments on non-`main` branches.
5. Add `students.mylifeos457.com` under Vercel Project Settings -> Domains.

### Alibaba Cloud DNS

In Alibaba Cloud DNS for `mylifeos457.com`, add the CNAME record shown by Vercel:

```text
Type: CNAME
Host record: students
Value: use the exact CNAME target shown by Vercel
```

### Vercel Production Environment Variables

```text
APP_BASE_URL=https://students.mylifeos457.com
AI_PROVIDER=zhipu
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4
ZHIPU_CHAT_COMPLETIONS_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions
ZHIPU_MODEL=GLM-4-Flash-250414
ZHIPU_API_KEY=
DATABASE_URL=
```

Set the real `ZHIPU_API_KEY` and managed persistent database URL only in the Vercel dashboard.

Do not set `DATABASE_PATH` in Vercel Production. Local SQLite is for local development or temporary demos only.
When `DATABASE_URL` is configured, the app uses Postgres. Without it, the app falls back to local SQLite.

### Verification

```powershell
npm run test
npm run build
npm run deploy:check
```

Before real classroom use, Production must use a persistent database through `DATABASE_URL`.
