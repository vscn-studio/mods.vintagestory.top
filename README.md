# VSCN Mod DB

VintageStory 中文社区模组目录与发布平台。认证仍使用 VintageStory 官方账号和 Discourse OIDC，业务数据现在由 PostgreSQL + Prisma 持久化，文件由本地或 S3 兼容对象存储保存。

## 技术栈

- Next.js 16、React 19、TypeScript
- PostgreSQL 16、Prisma 6
- 本地对象存储、S3/MinIO/R2 或多吉云 OSS（SigV4 短时下载签名）
- Vitest 单元测试、Playwright 浏览器测试

## 已实现功能

- 双身份账号、邮箱验证码绑定、数据库会话和会话撤销
- `hasOfficialIdentity` 服务端资格判断；绑定官方身份后才能创建项目或组织
- 项目和组织创建、资料编辑、私有可见性、成员角色、邀请接受/拒绝、转让和归档
- 版本状态机 `DRAFT -> PENDING_REVIEW -> PUBLISHED`，文件魔数/MIME/SHA-256 校验和扫描状态
- 公开目录搜索、筛选、排序、分页；项目详情、截图、下载、收藏、关注、评论和举报
- 管理 API：用户、组织、项目、文件扫描、审核、举报、评论、审计日志和存储连通性检测
- 统一错误信封、请求 ID、Origin/CSRF 双提交校验、速率限制和高风险操作二次确认

GitHub、API 密钥和备份编排属于第二阶段能力。存储凭据仍由部署环境管理，后台只显示脱敏状态、对象统计和连通性检测，不会读取或保存长期密钥。

## 本地开发

需要 Node.js 20.9 或更高版本，以及 Docker Desktop（用于 PostgreSQL）。

```bash
npm ci
copy .env.example .env                 # PowerShell 可使用 Copy-Item
docker compose up -d db
```

在 `.env` 中设置至少以下值：

```dotenv
NODE_ENV=development
DATABASE_URL=postgresql://vscn:vscn_dev_password@localhost:5433/vscn_mod_db?schema=public
MOD_AUTH_SESSION_SECRET=replace-with-a-random-value-at-least-32-chars
```

应用迁移并（可选）写入开发数据：

```bash
npm run db:migrate
SEED_DEV_DATA=true npm run db:seed
npm run dev
```

开发服务器默认运行在 `http://localhost:3100`。`MOD_AUTH_DEV_ACCOUNT_ENABLED=true` 仍可用于预览管理员界面，但该 fixture 没有官方身份，不能绕过创建资格检查。

## 生产部署

填写 `.env` 中的 OIDC、SMTP、`WEB_URL`、`MOD_AUTH_SESSION_SECRET`、`DATABASE_URL` 和 S3 参数。使用 Compose 内置数据库时，连接地址必须使用服务名 `db`：

```dotenv
POSTGRES_PORT=5433
DATABASE_URL=postgresql://vscn:vscn_dev_password@db:5432/vscn_mod_db?schema=public
```

然后启动服务：

```bash
docker compose up -d --build
```

宿主机的 `POSTGRES_PORT` 默认是 `5433`，只供宿主机工具连接；Web 和迁移容器始终访问 `db:5432`。Compose 的 `migrate` 服务默认使用内部 `db` 主机名。如果数据库托管在外部，设置 `MIGRATION_DATABASE_URL`；它可以与 Web 容器使用的 `DATABASE_URL` 不同。生产必须使用 HTTPS `WEB_URL`、至少 32 字符的随机会话密钥和 S3 兼容存储，文件下载使用短时 SigV4 URL。

### 多吉云 OSS

多吉云使用临时 S3 凭据，不需要将实际的 S3 endpoint 或底层 bucket 写入配置。设置 `STORAGE_DRIVER=s3`、`STORAGE_S3_PROVIDER=dogecloud`，并填写多吉云控制台的存储空间和 API 凭据：

```dotenv
STORAGE_DRIVER=s3
STORAGE_S3_PROVIDER=dogecloud
STORAGE_DOGECLOUD_BUCKET=your-space-name
STORAGE_DOGECLOUD_ACCESS_KEY=your-access-key
STORAGE_DOGECLOUD_SECRET_KEY=your-secret-key
STORAGE_DOGECLOUD_API_BASE=https://api.dogecloud.com
STORAGE_S3_SIGNED_URL_TTL=300
```

服务端会以 `OSS_FULL` scope 请求 `/auth/tmp_token.json`，缓存有效期内的短期凭据，并自动采用响应中的 `s3Bucket` 与 `s3Endpoint`。长期凭据只存在于部署环境；管理员可在“存储设置”执行无写入连通性检测。

旧版 `data/accounts.json` 只用于一次性导入，导入会保留原账号 ID、双身份关系、组织成员并生成冲突报告：

```bash
npm run db:import-legacy
```

确认报告后停止运行时 JSON 读取；多副本部署不要依赖 JSON 文件。

## 常用命令

```bash
npm run lint
npm run build
npm test
npm run test:e2e
npm run db:validate
npm run db:migrate
```

API 默认分页 `pageSize=20`，上限 60。私有项目、未发布版本和未通过扫描的文件对无权限请求统一返回 404；所有写操作都在服务端重新检查资源角色，客户端按钮不构成权限边界。
