# Students Tools Deployment Prep Design

日期：2026-06-09

## 背景

当前 `students_tools` 主工作区只包含学情分析系统的设计和实施计划，实际应用脚手架正在另一个 terminal 或 `.worktrees/ai-qr-learning-analysis` 中开发。部署前置工作不能抢占业务代码文件，也不能假设当前根目录已经有最终 `package.json`、Next.js 源码或数据库实现。

参考项目 `D:\Dev\Projects\life-management-system` 的部署方向是 GitHub + Vercel 自动部署，生产分支更新后自动发布，Vercel 项目绑定自定义域名。这次沿用该部署模式，但根据学生课堂系统的数据写入特点补充数据库持久化门槛。

## 目标

- 使用 `students.mylifeos457.com` 作为生产访问域名。
- 采用 GitHub + Vercel Git Deployments 作为默认部署通道。
- `main` 分支对应 Production，非生产分支对应 Preview。
- 所有密钥只保存在 Vercel 环境变量或本地 `.env.local`，不进入仓库。
- 明确 Vercel 上 SQLite 文件数据库不能作为正式课堂数据持久化方案。
- 在业务代码开发完成前，先准备部署清单、环境变量清单、DNS 操作步骤和上线验收标准。

## 非目标

- 本阶段不创建或迁移 GitHub 仓库。
- 本阶段不登录 Vercel 或阿里云控制台执行人工配置。
- 本阶段不修改正在另一个 terminal 开发的业务源码。
- 本阶段不决定最终云数据库供应商，但必须保留 Postgres/Supabase/Neon 等持久数据库切换空间。
- 本阶段不把智谱 API Key、数据库密码、Vercel token 或任何真实学生数据写入仓库。

## 推荐部署架构

第一阶段使用 Vercel 部署 Next.js 应用：

```text
GitHub repository
  -> Vercel Project
  -> Production deployment from main
  -> students.mylifeos457.com
```

Vercel 负责构建、静态资源、Next.js 路由和服务端 API Route。GitHub 的非生产分支推送生成 Preview 部署，Preview 使用 Vercel 自动生成域名，不绑定 `students.mylifeos457.com`。

生产域名只绑定 Production 环境。学生课堂二维码中的基础地址必须使用：

```text
https://students.mylifeos457.com
```

本地开发仍使用：

```text
http://localhost:3000
```

## 域名与 DNS

域名由阿里云管理：`mylifeos457.com`。

生产二级域名：

```text
students.mylifeos457.com
```

配置流程：

1. 在 Vercel 项目 Settings -> Domains 添加 `students.mylifeos457.com`。
2. Vercel 会显示该子域名需要的 DNS 记录。
3. 在阿里云 DNS 解析中新增 CNAME：
   - 主机记录：`students`
   - 记录类型：`CNAME`
   - 记录值：使用 Vercel 后台给出的 CNAME 目标，不在仓库中硬编码
4. 等待 DNS 生效，并在 Vercel Domains 页面确认状态为 Valid。

不建议第一阶段绑定根域名 `mylifeos457.com`。根域名可以保留给未来的总入口、项目导航或 LifeOS 聚合页。

## 环境变量

本地 `.env.local` 和 Vercel 环境变量使用同一命名口径。

基础变量：

```text
APP_BASE_URL=https://students.mylifeos457.com
AI_PROVIDER=zhipu
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4
ZHIPU_CHAT_COMPLETIONS_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions
ZHIPU_MODEL=GLM-4-Flash-250414
ZHIPU_API_KEY=<server-side-secret>
```

数据库变量先按未来持久数据库预留：

```text
DATABASE_URL=<managed-postgres-url>
```

如果业务实现阶段仍使用本地 SQLite：

```text
DATABASE_PATH=./data/app.db
```

则 `DATABASE_PATH` 只能作为本地开发或临时演示配置，不能作为正式 Vercel 生产课堂的持久存储依据。

## 数据库部署边界

学情分析 design spec 只说明数据库保存课堂、题目、学生、答题记录、知识点统计和学情报告，没有指定数据库产品。

当前实施计划选择 SQLite + `better-sqlite3`，适合本地快速开发和测试；但 Vercel Functions 文件系统不是持久写入环境，只有 `/tmp` 临时空间可写。因此，正式线上课堂必须满足以下条件之一：

- 将数据层切换到托管 Postgres，例如 Supabase、Neon、Vercel Marketplace Postgres 或其他可公网访问的数据库。
- 或改用自托管服务器，让 SQLite 数据文件位于持久磁盘，并配套备份。

在未完成持久数据库方案前，Vercel 上线只能作为页面预览、流程演示或受限测试，不能承诺保存真实课堂答题数据。

## 安全与隐私

- `ZHIPU_API_KEY` 只在服务端环境变量中配置。
- 前端 bundle、二维码 URL、学生链接和教师链接都不能包含 API Key。
- 学生答题链接只包含课堂/题目访问 token，不包含姓名、学号或答案。
- 教师看板链接使用独立 token，不能从学生题目链接推导。
- AI 报告请求默认只发送汇总统计，不发送学生逐人明细。
- Preview 部署不绑定生产域名。若包含真实数据，应启用 Vercel Deployment Protection 或只在测试数据下使用。

## 代码准备原则

由于另一个 terminal 正在开发业务实现，部署前置阶段只允许新增文档和部署清单。后续业务代码合入根目录后，再根据实际项目结构补以下文件：

- `vercel.json`
- `.env.example`
- `README.md` 部署说明
- 数据库环境变量读取与生产持久化校验
- 构建、测试和部署检查脚本

如果最终应用是标准 Next.js 项目，优先使用 Vercel 的 Next.js 默认识别，不复制 LifeOS 的 Express `api/index.js` 重写模式。

## 上线前验收标准

代码层面：

- `npm run test` 通过。
- `npm run build` 通过。
- 关键课堂流程 E2E 通过，包括教师导入、发起课堂、学生提交、教师看板、报告页。
- 构建产物扫描不到真实 `ZHIPU_API_KEY`。
- 生产环境没有使用本地 `DATABASE_PATH` 作为正式数据源。

Vercel 层面：

- GitHub 仓库已导入 Vercel。
- Production Branch 为 `main`。
- Production 环境变量已配置 `APP_BASE_URL=https://students.mylifeos457.com`。
- `ZHIPU_API_KEY` 只配置在 Vercel 环境变量中。
- Preview 和 Production 环境变量边界明确。

域名层面：

- Vercel 已添加 `students.mylifeos457.com`。
- 阿里云 DNS 已设置 Vercel 要求的 CNAME。
- `https://students.mylifeos457.com` 可打开生产首页。
- 学生二维码生成的 URL 使用生产域名。

数据层面：

- 正式课堂使用前，必须完成持久数据库方案。
- 若仍是 SQLite，本次线上部署只能标记为演示或预览，不作为真实课堂生产环境。

## 后续实施顺序

1. 等业务应用代码稳定合入根目录。
2. 检查最终技术栈是否仍是 Next.js + SQLite。
3. 补部署配置与 `.env.example`。
4. 写 README 中的 Vercel、GitHub、阿里云 DNS 操作步骤。
5. 如果继续走 Vercel 正式课堂，先把数据层改到持久数据库。
6. 运行测试、构建、E2E 和密钥扫描。
7. 导入 GitHub 仓库到 Vercel。
8. 添加 `students.mylifeos457.com` 并完成阿里云 CNAME。
9. 记录 Production URL、Preview URL 和最终验收结果。

## 官方依据

- Vercel Git Deployments：Vercel 支持 GitHub/GitLab/Bitbucket/Azure DevOps 集成，生产分支产生 Production，其他分支产生 Preview。
- Vercel Custom Domains：子域名需要在 Vercel 项目中添加，并通过 CNAME 记录配置。
- Vercel Functions Runtime：函数文件系统为只读，只有 `/tmp` 临时空间可写，不适合作为正式持久数据库文件位置。
