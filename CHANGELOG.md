# Changelog

All notable changes to this project will be documented in this file.

## v1.0 (2025-11-02)

- Auth: 邮箱验证码登录（QQ SMTP），一次性“专属令牌”发放与注册/登录。
- Policy: 每邮箱每月令牌发放≤3；每日活跃分钟统计；连续3天(<10m/日)自动禁用令牌。
- Activity: `/api/activity/heartbeat` 心跳上报分钟数至 `DailyActivity`。
- Inbox: 用户未使用原因提交；管理员收件箱查看、检索与处理。
- Admin: 新增 `/admin` 页面实现收件箱管理与导出。
- Dev Utils: 全局登出、重置用户/验证码/活动记录；管理员提升/降级与列表。
- UI: `/auth` 双列卡片式布局，细化错误提示；基本样式与响应式支持。
- Infra: Prisma 模型扩展（DailyActivity、TokenIssue、InactivityReport），定时任务 nightly 扫描自动禁用。
