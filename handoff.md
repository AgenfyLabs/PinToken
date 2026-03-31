## 状态：进行中（M1 完成 + Dashboard 增强）

## 最后完成
- Dashboard 高峰状态系统：三态（正常/预警/高峰），Anthropic 21:00-03:00 北京时间硬编码
- 状态区域始终可见，大圆点+标题+描述，红黄绿联动
- 订阅对比（本月 API 等值 vs Max $100）嵌入状态区右侧
- Dashboard 改为居中弹窗风格（960px 限宽+阴影+圆角+关闭按钮）
- 像素图钉 logo（SVG inline，PRD 配色）
- 金额统一 2 位小数
- README.md 按 PRD 附录D 七段式结构编写
- 费用计算确认正确：cache tokens 已正确纳入

## 下一步（按优先级）
1. **M2 规划** — 8 provider 全接入 + 终端面板 + 高峰提醒 + 分享卡片
2. **Dashboard 截图** — README 需要真实数据截图（assets/dashboard-preview.png）
3. **npm 发布准备** — package.json 完善、bin 入口确认、npm publish 测试
4. **Product Hunt 准备** — M1 完成后上线 PH

## 未解决问题
- bin/pintoken.mjs 中 Dashboard URL 指向 `/dashboard` 而非 `/`，server.mjs 中 `/` 即为 Dashboard
- 尚未用真实 API Key 测试代理转发（用户是 Max 订阅，Scanner 是主要数据源）
- logo.png 尚未创建（README 引用 assets/logo.png）

## 最近修改的文件
- dashboard/app.js, index.html, style.css（弹窗风格+高峰状态+订阅对比）
- src/api/routes.mjs（高峰判断+订阅API+月度汇总注入summary）
- src/db/store.mjs（getMonthSummary）
- README.md（新增）

## 关键上下文
- 设计 spec: docs/superpowers/specs/2026-03-31-pintoken-m1-design.md
- Scanner spec: docs/superpowers/specs/2026-03-31-jsonl-scanner-design.md
- PRD: PinToken_PRD.md
- 用户是 Max 订阅，无 API Key，Scanner 是主要数据源
- 核心价值：Token 消耗状态感知（高峰/正常），不是"省了多少钱"
