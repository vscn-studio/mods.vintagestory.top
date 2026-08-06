# 网站权限清单

本文档记录网站权限管理页中的基础权限目录。权限应同时绑定到角色和资源范围：角色决定可以执行的操作，资源范围决定只能操作自己的资源、组织资源，还是全站资源。

## 权限目录

| 权限 ID | 功能 | 默认角色 | 资源范围 |
| --- | --- | --- | --- |
| `project.create` | 创建项目 | 已验证用户 | 本人 |
| `project.update` | 编辑项目资料 | 项目 Owner、Maintainer | 项目 |
| `project.member.manage` | 管理项目成员 | 项目 Owner、Maintainer | 项目 |
| `project.transfer` | 转让项目 | 项目 Owner | 项目 |
| `project.archive` | 归档或删除项目 | 项目 Owner | 项目 |
| `release.create` | 创建项目版本 | 项目 Owner、Maintainer、Contributor | 项目 |
| `release.publish` | 发布或撤回版本 | 项目 Owner、Maintainer | 项目 |
| `release.file.manage` | 上传和管理文件 | 项目 Owner、Maintainer、Contributor | 项目版本 |
| `download.public` | 下载公开文件 | 所有访客 | 公开项目和版本 |
| `comment.create` | 发表评论 | 已验证用户 | 本人评论 |
| `comment.moderate` | 管理评论和举报 | 版主、站点管理员 | 全站 |
| `organization.create` | 创建组织 | 可信用户 | 本人 |
| `organization.manage` | 管理组织成员和设置 | 组织 Owner、Admin | 组织 |
| `organization.project.manage` | 管理组织项目 | 组织 Owner、Admin、Maintainer | 组织项目 |
| `github.connect` | 连接 GitHub 账号 | 本人 | 本人账号 |
| `github.import` | 导入 GitHub 仓库 | 项目 Owner、Maintainer | 项目 |
| `github.sync` | 同步 README、标签和 Release | 项目 Owner、Maintainer | 已绑定仓库 |
| `github.publish` | 从 GitHub 发布版本 | 项目 Owner、Maintainer | 已绑定仓库和项目 |
| `review.content` | 审核项目、版本和文件 | 审核员、站点管理员 | 全站 |
| `user.manage` | 管理用户和封禁 | 站点管理员 | 全站用户 |
| `api.key.manage` | 管理 API 密钥 | 站点管理员 | 全站应用 |
| `audit.view` | 查看审计日志 | 站点管理员、审核员 | 全站 |

## 角色定义

### 项目角色

- `Owner`：项目全部权限，可转让、归档、删除项目并管理成员。
- `Maintainer`：编辑项目、管理版本和文件、发布版本。
- `Contributor`：创建版本草稿和上传文件，但不能发布版本。
- `Reviewer`：审核项目、版本和文件。
- `Viewer`：只读访问项目内部内容。

### 组织角色

- `Owner`：组织全部权限，可转让组织所有权。
- `Admin`：管理成员、组织设置和组织项目。
- `Maintainer`：维护组织项目。
- `Member`：参与组织项目。
- `Viewer`：只读访问组织资源。

### 站点角色

- `Moderator`：处理评论、举报和社区违规内容。
- `Reviewer`：审核项目、版本和文件。
- `Site administrator`：管理全站用户、组织、内容、存储、API、备份和权限策略。

## GitHub 集成要求

1. 用户连接 GitHub 账号时只申请必要的身份和仓库读取权限。
2. 导入仓库前验证用户拥有仓库管理权限。
3. 配置 Webhook 或发布写入操作时单独申请仓库级写权限，并显示授权范围。
4. GitHub Tag、Release 或构建产物同步到网站后，仍按 `release.publish` 检查发布权限。
5. GitHub 账号解绑、仓库迁移、自动发布和权限变更必须写入审计日志。

## 约束

- 公开项目的下载不要求登录；私有项目和组织内部项目必须检查资源成员关系。
- 删除、转让、发布、封禁、修改角色和 GitHub 自动发布属于高风险操作，应要求二次确认并记录审计日志。
- 权限默认遵循最小权限原则，新增权限不能自动赋予站点管理员以外的角色。
