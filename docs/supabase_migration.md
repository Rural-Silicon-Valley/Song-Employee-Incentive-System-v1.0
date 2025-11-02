# Supabase 迁移与监控指南

## 迁移思路
- 数据库：将 Prisma `provider` 从 `sqlite` 切换到 `postgresql`，`DATABASE_URL` 指向 Supabase Postgres。
- 认证：可选择继续使用现有 JWT/Login 逻辑，或迁移到 Supabase Auth（邮箱 OTP、Magic Link、第三方登录）。
- 存储：任务附件/讲解视频可用 Supabase Storage 替代本地/第三方存储。
- 定时任务：将每日扣分/周结算迁移到 Supabase Scheduled Functions，或保留 Node 定时任务但连接 Supabase DB。

## 步骤
1. 在 Supabase 创建项目，获取 `SUPABASE_DB_URL` 与 `anon/service` keys。
2. 修改 `backend/prisma/schema.prisma`：
   - `datasource db { provider = "postgresql" url = env("DATABASE_URL") }`
3. 导出本地 SQLite 数据至 Postgres（可写小脚本用 Prisma 读取旧库写入新库）。
4. 执行 `npx prisma migrate dev` 生成并应用迁移到 Supabase。
5. 更新 `.env`：`DATABASE_URL` 指向 Supabase。
6. （可选）接入 Supabase Auth：前端改用 `@supabase/supabase-js`，后端减少认证路由，转为以 RLS 为主。

## 监控与活跃度
- 数据图：
  - Supabase Studio 提供关系图、表行计数、索引与查询分析。
  - 使用 `pg_stat_statements` + Supabase Logs 观测慢查询与请求分布。
- 活跃度：
  - 统计登录/提交/答题/错题等表增量，写入 weekly/monthly 统计表（或物化视图）。
  - 使用 Supabase Edge Functions 定时汇总活跃用户、任务完成率、周榜稳定性等指标。
- 可视化：
  - 用 Supabase 的 log explorer + 自建小看板（前端页）展示每周 PV/UV、任务完成数、积分发放量、错题纠正率等指标。

## 风险与注意
- SQLite → Postgres 类型差异与唯一约束需要校验；字符串枚举可转 enum 或 text。
- JSON/数组字段可直接用 `jsonb`；注意 Prisma schema 相应更新。
- 邮件通道：可改用 Supabase Auth 邮件或继续 Resend/SMTP。
