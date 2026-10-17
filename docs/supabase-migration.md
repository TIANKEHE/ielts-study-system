# SQLite → Supabase PostgreSQL 迁移准备

本轮只完成本地适配、备份、演练和部署配置。没有连接或修改 Supabase 项目，也没有部署 Vercel。原 `prisma/learning.db` 继续作为本机学习库。

## 数据与结构

- SQLite 的 `prisma/schema.prisma` 保留，避免破坏现有本地安装。
- PostgreSQL 在 `prisma/postgresql/schema.prisma`，由 `scripts/generate-clients.mjs` 同步同一组模型，包含18张业务表、原唯一约束和外键。
- 两种 Prisma Client 分开生成。`DATABASE_URL` 以 `file:` 开头时继续使用SQLite；以 `postgresql:` 开头时使用PostgreSQL。不要把 PostgreSQL 连接写进本机日常使用的 `.env`。
- PostgreSQL 初始迁移仅创建独立 `kyes` Schema，不接触 Supabase 的 `auth`、`storage` 或其他业务表。所有个人表启用RLS，无匿名读取策略。不要在 Supabase Data API 的 Exposed schemas 中添加 `kyes`；若仅用 Prisma，可关闭 Data API。
- 运行时使用 `kyes_app` 专用角色，仅有 `kyes` 业务表的CRUD权限，无DDL、建库、建角色、BYPASSRLS权限。Supabase Auth 身份由服务端核验，仅允许环境变量指定的唯一UUID；Auth登录账号与数据库角色是两回事。

## 下一步需要取得的信息（不要发到聊天或GitHub）

| 变量 | 从哪里取得 | 用途/保存位置 |
| --- | --- | --- |
| `DATABASE_URL` | Supabase顶部Connect → Transaction pooler，通常6543端口；专用角色密码另设 | Vercel运行时，服务端敏感变量 |
| `DIRECT_URL` | Connect → Session pooler 5432；有IPv6环境可用Direct connection | 只放Mac私有迁移环境，Prisma建表/后续schema迁移 |
| `MIGRATION_DATABASE_URL` | 使用同一个管理员Session/Direct连接，加入 `schema=kyes` | 只放Mac私有迁移环境，传输数据；不要给浏览器或Vercel运行时 |
| `SUPABASE_URL` | Project Settings → API，项目URL | Vercel服务端变量 |
| `SUPABASE_PUBLISHABLE_KEY` | API Keys → Publishable key；旧项目可用anon key | 只用于用户登录；不需要service_role/secret key |
| `SUPABASE_ALLOWED_USER_ID` | Authentication → Users → 唯一允许使用网站的账号UUID | Vercel服务端允许列表；不是项目ID、不是邮箱 |
| `APP_URL` | 你确认的Vercel正式域名或自定义HTTPS域名 | 登录和写操作的Origin校验 |
| `KYES_AUTH_MODE` | 固定设置为 `supabase` | 云端必需，缺少即拒绝开放数据 |

East US区不代表固定的主机名。直接复制项目Connect面板的实际主机、端口、数据库名和用户名，不根据区域猜测地址。

连接字符串模板仅用于解释，不包含真实凭据：

```dotenv
DATABASE_URL="postgresql://kyes_app.PROJECT_REF:ENCODED_PASSWORD@POOLER_HOST:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=20&schema=kyes&sslmode=require"
DIRECT_URL="postgresql://postgres.PROJECT_REF:ENCODED_ADMIN_PASSWORD@POOLER_HOST:5432/postgres?schema=kyes&sslmode=require"
MIGRATION_DATABASE_URL="与上述管理员Session连接相同"
KYES_AUTH_MODE=supabase
SUPABASE_URL="https://PROJECT_REF.supabase.co"
SUPABASE_PUBLISHABLE_KEY="从项目复制的Publishable key"
SUPABASE_ALLOWED_USER_ID="Auth Users中的账号UUID"
APP_URL="https://你的正式域名"
```

密码中的 `@`、`:`、`/`、`#`、`%` 等需要URL编码，避免重复编码。不要把连接串放进 `NEXT_PUBLIC_*` 变量、源码、截图、日志或聊天。

## 账号保护

1. 在Supabase Authentication创建自己的邮箱/密码账号，并确认邮箱状态。
2. 在Auth设置中关闭公开注册。本站没有注册接口，也不会自动创建账号。
3. 把该账号UUID放到 `SUPABASE_ALLOWED_USER_ID`。任何其他有效Supabase账号也会被拒绝。
4. 登录页面 `/login`，Cookie采用HttpOnly、Secure、SameSite=Lax。服务端用 `auth.getUser()` 校验，不信任Cookie存在、浏览器解码或user_metadata。
5. 数据接口（action、reviews、timer、export）在查询数据库前验证身份；写操作还校验Origin；响应禁止共享缓存。
6. Vercel环境不能启用local绕过。`APP_URL` 必须匹配部署域名。Preview部署需要独立测试数据库、测试owner和该Preview域名，不能默认连接个人正式学习库。

## 私有环境配置

在Mac新建 `.env.migration.local`（已被忽略），只填迁移所需管理员连接。保持原 `.env` 的SQLite地址不变。设置文件权限为仅当前用户可读写，例如 `chmod 600 .env.migration.local`。不要用命令参数传密码。

在Vercel Project → Settings → Environment Variables填写运行时变量。数据库URL/密码按敏感变量保存；本应用不需要任何 `NEXT_PUBLIC_*` 数据库变量。管理员的DIRECT_URL和MIGRATION_DATABASE_URL应留在Mac，不必提供给Vercel。修改后重新部署才生效。

## 经单独确认后才执行的正式迁移顺序

以下命令是准备好的操作方案，本轮没有执行云端命令。

1. 保持线上站点未开放、未访问目标数据库。先暂停Mac所有学习标签的计时、保存训练，停止SQLite服务，避免最后快照之后继续产生未迁移记录。
2. 导出一份新的最终一致性快照，不复用过期演练数据：

```sh
pnpm migration:export --source prisma/learning.db --output work/final-migration-唯一日期
pnpm migration:plan --manifest work/final-migration-唯一日期/manifest.json
```

导出以只读方式打开SQLite，生成可恢复的 `source.db.gz`、逐表压缩JSONL和清单。清单包含每表记录数、SHA256和模型关系。已有输出目录拒绝覆盖。源SQLite始终不修改。

3. 在确认目标项目和私有环境变量后，仅创建 `kyes` 表结构：

```sh
node --env-file=.env.migration.local node_modules/prisma/build/index.js migrate deploy --schema prisma/postgresql/schema.prisma
```

`.env.migration.local` 中同时提供PostgreSQL的 `DATABASE_URL` 与 `DIRECT_URL`；该文件只用于迁移命令，不替换日常 `.env`。

4. 再核对目标标识（不含用户名、密码）：`实际主机:5432/postgres?schema=kyes`。数据写入需要显式双重确认：

```sh
node --env-file=.env.migration.local scripts/migration/import.mjs \
  --manifest work/final-migration-唯一日期/manifest.json \
  --apply \
  --expected-target '实际主机:5432/postgres?schema=kyes' \
  --report work/final-migration-唯一日期/result.json
```

默认不带 `--apply` 时不连接目标库。应用模式拒绝任何非空业务表；无truncate、无replace选项。所有表导入与逐字段检查在同一个数据库事务中，检查失败回滚整个事务。目标已成功导入时再运行会拒绝覆盖，不能无意义重复写入。

5. 校验18张表的数量、原始ID、每个字段和关系，确认CSV重复位置与position/originalPosition、训练queue/cursor/count、提交幂等记录、错误历史、复习日期、任务和计时均保留。历史源指针已断开的记录会如实报告并保留，不以去重删除历史。
6. 仅在目标库中将活动StudyClock变为暂停，活动StudySpan结算到confirmedUntil，不补算跨设备或离线时间。原始备份保留迁移前状态；其余学习字段保持原值。
7. 在管理员会话中审核执行 `scripts/migration/app-role.sql`。它创建NOLOGIN的最小权限角色；用psql的隐藏提示 `\password kyes_app` 设置强密码，再执行 `ALTER ROLE kyes_app LOGIN`。不要把真实密码写到SQL文件或shell参数中。确认能用专用账号连接，Vercel运行时改用这个账号。
8. 配置Vercel、预生产验收登录、跨天复习、多标签计时和大词表训练后，才开放正式域名。成功前不删SQLite；成功后仍建议保留完整本地备份。切换后不要同时向SQLite和PostgreSQL继续学习，系统没有自动双向合并。

## Vercel准备

- 已提供 `vercel.json`，区域 `iad1`，与North Virginia接近；构建命令 `pnpm build:vercel`。
- 锁定现有Prisma6，构建重新生成两种客户端，保留Linux OpenSSL3引擎；不在构建中运行数据库迁移或数据导入。
- 云端构建检查数据库类型、私有Schema、TLS、Auth模式与必要变量。构建只验证配置，不连接生产数据库。
- `.vercelignore` 和 `.gitignore` 排除数据库、数据集、CSV、环境文件、备份、work和outputs。Git只应提交代码、Schema、SQL迁移和文档。
- 学习、Web Speech发音、计时和规则化复习没有新增任何付费AI调用。

## 回退和恢复

未通过验收前，Mac服务仍可用原SQLite启动。恢复压缩备份时先解压到一个新文件，运行SQLite完整性检查，确认无误后再按单独恢复流程操作；不要直接覆盖当前学习库。

正式切换后若已在PostgreSQL产生新记录，不能简单切回旧SQLite，否则会丢掉新增记录。需要先停写并导出目标完整备份，再制定回退/合并方案。

官方参考：
- https://supabase.com/docs/guides/database/prisma
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://vercel.com/kb/guide/connection-pooling-with-functions


## Vercel大响应与云端完整备份

本轮实际首页JSON约9.8MB。云端登录保护包装器在浏览器支持gzip时压缩JSON，当前完整数据压缩后约0.81MB；压缩后仍超过安全阈值的响应会明确拒绝，避免落入平台错误。CSV和常规训练接口继续可用。

云端设置页的完整备份入口改为本机一致性导出说明，不会把数百MB的历史记录塞进单次Vercel响应。本地SQLite的原JSON下载不变。

在Mac的 `.env.backup.local` 设置 `BACKUP_DATABASE_URL`（专用角色的Session连接，schema=kyes），运行：

```sh
node --env-file=.env.backup.local scripts/migration/export-postgres.mjs --output work/cloud-backup-唯一日期
```

脚本在只读、Repeatable Read事务中分页读取全部18表，逐表压缩，生成字段/关联/校验清单；不修改源库，已有目录拒绝覆盖。私有数据保存在Mac，依旧被Git和Vercel忽略。此数据集可用同一个迁移程序恢复到经确认的空PostgreSQL目标；不要在非空库上覆盖。

Vercel响应限制官方说明：https://vercel.com/docs/functions/limitations

报告写盘失败会明确显示“数据已提交并核对，报告未保存”，不会误报为回滚。若在提交边界发生断网，应先只读核对目标，不清空、不覆盖、不直接重复导入。


### 远程核对性能

迁移校验分批读取，每条标量字段保持比较；`TrainingSubmission.response` 在 PostgreSQL 使用内置 `sha256(convert_to(response,'UTF8'))`，与本地原文逐条摘要比较，避免为校验再次下载全部历史快照。此操作不修改文本。单个事务最长30分钟，超时后必须检查目标是否为空，不得直接重跑或清空。


### Vercel首次构建

仅向Production导入运行配置，另设 `ENABLE_EXPERIMENTAL_COREPACK=1` 以使用packageManager指定的pnpm版本。未设置APP_URL时，仅在Vercel读取系统提供的VERCEL_PROJECT_PRODUCTION_URL，作为固定HTTPS来源；未提供正式地址时构建拒绝通过。域名确认后可显式设置APP_URL。生产环境的DIRECT_URL也使用专用应用角色的Session连接；管理员迁移地址仅保留在Mac。
