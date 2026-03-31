// OG 图片端点 — 返回存储的 Base64 图片作为 PNG
// 路由: /api/og/{shortId}
// 社交平台抓取 OG meta 时会请求此端点获取预览图

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  const { id } = req.query;

  // 只查询图片数据字段，减少数据库传输
  const card = await prisma.card.findUnique({
    where: { shortId: id },
    select: { imageData: true },
  });

  if (!card || !card.imageData) {
    return res.status(404).end();
  }

  // 将 Base64 解码为二进制 Buffer
  const buffer = Buffer.from(card.imageData, 'base64');

  // 设置缓存头：图片不会变，缓存一年
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(buffer);
}
