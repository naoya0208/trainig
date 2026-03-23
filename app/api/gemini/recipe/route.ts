import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const { nutrients, condition, messages } = await req.json();

  // チャット継続の場合
  if (messages && messages.length > 0) {
    const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));
    const lastMessage = messages[messages.length - 1].content;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastMessage);
    return NextResponse.json({ reply: result.response.text() });
  }

  // 初回の料理提案
  const nutrientList = nutrients.join('、');
  const conditionText = condition ? `\n絞り込み条件: ${condition}` : '';

  const prompt = `あなたは管理栄養士兼料理研究家のAIです。
不足している栄養素を補える料理を提案してください。

不足している栄養素: ${nutrientList}${conditionText}

以下のJSON形式で3〜5品提案してください:
{
  "dishes": [
    {
      "name": "料理名",
      "description": "一言説明（食材・味など）",
      "nutrients": ["この料理で補える主な栄養素"],
      "time": "調理時間の目安",
      "cost": "コスト感（低/中/高）"
    }
  ],
  "message": "提案の一言コメント"
}`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: 'parse error' }, { status: 500 });
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: 'Gemini API error', detail: e?.message }, { status: 500 });
  }
}
