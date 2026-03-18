import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: 'APIキーが未設定' });

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent('「テスト成功」とだけ返してください');
    const text = result.response.text();
    return NextResponse.json({ success: true, response: text, keyPrefix: key.slice(0, 10) });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message, keyPrefix: key.slice(0, 10) });
  }
}
