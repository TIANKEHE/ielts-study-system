# GitHub 同步

目标仓库：https://github.com/TIANKEHE/ielts-study-system.git

当前项目沿用远程 main 历史，保留原来的 kyes 占位文件，不使用强制推送。远程当前为公开仓库；本项目不更改仓库可见性。源码和个人学习数据分别管理。

## 上传范围

提交 app/、lib/、prisma/schema.prisma、scripts/、tests/、docs/、package.json、pnpm锁文件、构建配置与占位.env.example。保留远程已有文件和提交历史。

.gitignore 排除 node_modules、.next 构建、.env与密钥、本地SQLite及其日志和备份、CSV/TSV、学习记录、work/、outputs/与个人导出。不要使用 git add -f 绕过这些规则。

## 日常同步

在项目根目录执行：

```sh
git status
git pull --ff-only origin main
# 修改代码后检查待提交文件
 git add .
node scripts/check-publish-safety.mjs
git diff --cached --stat
git commit -m "Describe the change"
git push origin main
```

暂存审查脚本检查文件路径和常见密钥模式，只输出需检查的文件名，不输出密钥内容。提交前仍需检查差异，确认不包含个人数据。

若 pull 提示存在未提交的修改，先提交或保存工作；若提示分支已分叉，先检查历史并解决冲突，避免使用 --force 或破坏性重置。若 GitHub 提示无权限，使用仓库所有者或有写权限的账号完成登录。

本机数据库不会随 git pull 或 git push 同步；个人数据请使用系统内的完整JSON备份或本地SQLite备份。
