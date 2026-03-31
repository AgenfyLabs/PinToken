// POST /api/cards
// 接收卡片数据 + base64 图片，存入数据库，返回短链接
// Body: { month_cost, subscription_cost, saved, saved_pct, month_requests, month_tokens, top_model, month_label, image_data }
// Response: { id, url: "https://PinToken.ai/card/{shortId}" }

import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  // 只接受 POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      month_cost,
      subscription_cost,
      saved,
      saved_pct,
      month_requests,
      month_tokens,
      top_model,
      month_label,
      image_data,
    } = req.body;

    // 基础校验：图片数据和月份标签必填
    if (!image_data || !month_label) {
      return res.status(400).json({ error: 'Missing required fields: image_data, month_label' });
    }

    // 生成 10 位短链接 ID
    const shortId = nanoid(10);

    const card = await prisma.card.create({
      data: {
        shortId,
        monthLabel: month_label,
        monthCost: month_cost || 0,
        subscriptionCost: subscription_cost || 100,
        saved: saved || 0,
        savedPct: saved_pct || 0,
        monthRequests: month_requests || 0,
        monthTokens: BigInt(month_tokens || 0),
        topModel: top_model || 'unknown',
        imageData: image_data,
      },
    });

    res.status(201).json({
      id: card.shortId,
      url: `https://PinToken.ai/card/${card.shortId}`,
    });
  } catch (err) {
    console.error('卡片创建失败:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
