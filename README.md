# kyes

IELTS Personal Study Space。中文、本地单用户雅思学习系统：每日计划 → 学习 → 测试 → 五遍纠错 → 间隔复习 → 复盘。

## 本地运行

需要 Node.js 22+ 和 pnpm。

```sh
pnpm install
cp .env.example .env
# 仅对全新的空目录初始化数据库；已有数据库不要重置。
touch prisma/learning.db
pnpm db:push
pnpm build
pnpm start
```

打开 http://127.0.0.1:3000/ 。数据保存在本机 SQLite。源码仓库不包含个人数据库、.env、导出和备份。

已有 v2 数据库升级：先停止服务，运行 `python3 scripts/upgrade-v3.py`（自动备份、保留数据和来源顺序），再执行 `pnpm exec prisma generate`、`pnpm build` 和 `pnpm start`。v1 旧库需先按上一版流程升级到 v2。已有 v3 数据库还需执行 `python3 scripts/upgrade-v4.py`，再生成 Prisma Client 和构建；该脚本仅增加首次完成时间字段并先备份。

## 当前功能

- 剑桥 8–21 册及四科教材管理；共享词条、独立来源位置，CSV 原始行序与重复位置保留。
- A/B 默写模式、五遍正确纠错、逐次测试记录、可恢复训练、键盘防重和浏览器英文发音。
- 间隔复习、默认 20 词分组、10/20/30/50 词可配置、组末统计、服务器分页。
- 四科自动计时，听力/阅读/写作/口语计划为 60/90/60/30 分钟；服务器时间戳、单一活动标签、后台暂停、心跳确认、异常中断结算与日/周/月统计。
- 紧凑首页四科概览和独立科目页；听力三个一级任务、剑桥每日 300 新词、阅读22章、写作例句填空/中译英、口语Part独立练习；三主题、字号调整、专注默写。
- 本地规则化建议、CSV 与完整 JSON 备份、事务恢复。全部基本学习功能不调用付费 AI API。

运行验证：`pnpm test`、`pnpm typecheck`、`pnpm build`。

技术：Next.js、TypeScript、React Hook Form、Zod、Prisma、SQLite、Vitest。业务规则放在 lib/，训练及计时使用数据库事务，AI 接口仅预留，未连接供应商。

设计与计时规则见 [docs/architecture.md](docs/architecture.md)。代码同步流程见 [docs/github.md](docs/github.md)。仓库只存源码，不包含已导入的个人词汇、学习历史及数据库。

## Supabase / Vercel准备

本机SQLite继续保留；PostgreSQL使用独立Schema和客户端，线上所有学习API要求Supabase验证的单一owner账号。迁移默认只检查、显式确认后才向空目标写入，并逐字段核对和事务回滚。

详细步骤和环境变量说明见 [docs/supabase-migration.md](docs/supabase-migration.md)。不要直接用旧版或未配置登录保护的构建上线；不要把个人数据或.env提交到仓库。
