# VSCN Mod DB

VintageStory 中文社区模组网站项目。项目当前包含首页、夜间模式、模组分类导航，以及 VintageStory 官方账号和 Discourse 社区账号绑定入口。

## 技术栈

- Next.js 16
- React 19
- TypeScript
- Nodemailer SMTP 邮件发送
- Docker Compose

## 功能

- 模组、主题包、整合包和服务器调整分类入口
- VintageStory 官方账号认证
- Discourse OIDC 社区账号认证
- 社区管理员群组识别和后台管理入口
- 独立 Mod 站账号绑定
- 绑定邮箱一次性验证码
- 日间/夜间模式
- Docker 生产部署配置

官方账号和社区账号只用于绑定 Mod 站账号，不能直接使用邮箱密码登录 Mod 站。

首次使用任一渠道时，提供商认证成功后需要绑定邮箱并完成一次性验证码验证。之后使用已绑定的社区账号或游戏账号可直接登录，不会重复要求邮箱验证码。相同绑定邮箱可以关联两个渠道；社区身份优先用于显示昵称和头像，只有游戏身份时使用玩家名首字作为头像占位。Mod 站不会保存 VintageStory 游戏密码。

## 本地开发

需要 Node.js 20.9 或更高版本。

```bash
npm ci
npm run dev
```

开发服务器默认地址为 `http://localhost:3100`。

开发环境预览页面需要直接使用本地管理员时，可在 `.env.development.local` 中设置：

```dotenv
NODE_ENV=development
MOD_AUTH_DEV_ACCOUNT_ENABLED=true
MOD_AUTH_DEV_ACCOUNT_NAME=本地管理员
MOD_AUTH_DEV_ACCOUNT_USERNAME=local-admin
MOD_AUTH_DEV_ACCOUNT_EMAIL=local-admin@localhost.test
```

该账号仅在开发环境生效，不会读取或写入 `data/accounts.json`；生产环境始终使用真实登录会话。

可用命令：

```bash
npm run lint
npm run build
npm run start
```

## 环境变量

以 `.env.example` 为模板创建本地 `.env`，再填写实际配置。`.env`、SMTP 密码、OIDC 客户端密钥和会话密钥不会提交到 Git。

主要配置包括：

- `WEB_URL`：公开网站的 HTTPS 根地址，用于 OIDC 回调和邮件内容。
- `WEB_BIND_HOST`、`WEB_PORT`：Docker 在宿主机上的监听地址和端口。生产环境默认只监听 `127.0.0.1`。
- `OIDC_*`：Discourse OIDC 客户端配置。
- `COMMUNITY_ADMIN_GROUP`：拥有后台管理权限的社区 OIDC 群组，默认是 `管理员`。OIDC 提供商必须在 UserInfo 中返回 `groups` 字段。
- `SMTP_HOST`、`SMTP_PORT`、`SMTP_SECURE`、`SMTP_USER`、`SMTP_PASSWORD`、`SMTP_FROM`：邮箱验证码发送配置。
- `MOD_AUTH_SESSION_SECRET`：至少 32 个字符的随机会话签名密钥。
- `MOD_AUTH_DATA_DIR`：账号和验证码挑战数据目录。

邮箱验证码由服务端随机生成，10 分钟有效，最多允许 5 次验证尝试，验证成功后立即失效。项目不再使用固定激活码环境变量。

## Docker Compose 生产部署

先准备 `.env` 并填写 `WEB_URL`、SMTP、OIDC 和 `MOD_AUTH_SESSION_SECRET`，然后执行：

```bash
docker compose up -d --build
```

Compose 会将应用容器端口绑定到宿主机回环地址，例如：

```text
127.0.0.1:3100 -> container:3100
```

公网访问应由同一台主机上的 Nginx 或 Caddy 提供 HTTPS，再反向代理到 `127.0.0.1:${WEB_PORT}`。容器使用非 root 用户运行，并启用健康检查、`no-new-privileges` 和 capability drop。

生产容器启动时会拒绝以下不完整配置：

- 缺少或过短的 `MOD_AUTH_SESSION_SECRET`
- 缺少或非 HTTPS 的 `WEB_URL`
- 缺少 `SMTP_HOST` 或 `SMTP_FROM`
- 非法 SMTP 端口或不完整的 SMTP 用户名/密码组合
- 与 `WEB_URL` 不同源的 `OIDC_REDIRECT_URI`

账号数据和验证码挑战会保存到 Docker volume `mod_auth_data`。当前 JSON 存储适合单实例部署；多副本部署前应替换为共享数据库或专用存储。

## GitHub 发布前检查

确认以下文件没有被加入仓库：

- `.env`
- `.env.local`、`.env.production`
- `data/`
- `node_modules/`
- `.next/`

发布前建议执行：

```bash
npm run lint
npm run build
```

然后在 GitHub 上创建空仓库，再添加远程地址并推送当前项目。
