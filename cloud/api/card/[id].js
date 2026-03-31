// 卡片展示页 — SSR 返回 HTML，带 OG meta tags 用于社交媒体预览
// 路由: /card/{shortId}
// 页面展示卡片图片 + PinToken 下载 CTA

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  const { id } = req.query;

  // 根据短链接 ID 查询卡片
  const card = await prisma.card.findUnique({
    where: { shortId: id },
  });

  if (!card) {
    return res.status(404).send('Card not found');
  }

  // OG 图片使用独立端点，方便社交平台抓取
  const ogImageUrl = `https://PinToken.ai/api/og/${card.shortId}`;
  const cardUrl = `https://PinToken.ai/card/${card.shortId}`;

  // 返回完整 HTML 页面
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PinToken Savings Card</title>

  <!-- Open Graph / Twitter Card — 社交媒体分享预览 -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="I saved $${card.saved.toFixed(0)} on AI APIs with PinToken" />
  <meta property="og:description" content="${card.monthRequests} requests, ${card.topModel} — ${card.monthLabel}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:url" content="${cardUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="I saved $${card.saved.toFixed(0)} on AI APIs" />
  <meta name="twitter:image" content="${ogImageUrl}" />

  <style>
    body {
      background: #13151a;
      color: #e8eaf0;
      font-family: 'Courier New', monospace;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    img {
      max-width: 720px;
      width: 100%;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    }
    .cta {
      margin-top: 32px;
      text-align: center;
    }
    .cta a {
      display: inline-block;
      background: #FF6B35;
      color: #fff;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 14px;
    }
    .cta a:hover {
      opacity: 0.9;
    }
    .cta p {
      color: #8b8fa8;
      font-size: 12px;
      margin-top: 12px;
    }
  </style>
</head>
<body>
  <img src="data:image/png;base64,${card.imageData}" alt="PinToken Savings Card" />
  <div class="cta">
    <a href="https://PinToken.ai">Generate your own savings card</a>
    <p>Track your AI API spending with PinToken — free & open source</p>
  </div>
</body>
</html>`);
}
