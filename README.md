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
