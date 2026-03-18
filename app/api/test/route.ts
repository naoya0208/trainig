import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: 'APIキーが未設定' });

  const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-pro', 'gemini-1.0-pro'];
  const results: Record<string, string> = {};

  for (const modelName of models) {
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('テスト');
      results[modelName] = '✅ 成功: ' + result.response.text().slice(0, 20);
    } catch (e: any) {
      results[modelName] = '❌ ' + e?.message?.slice(0, 80);
    }
  }

  return NextResponse.json(results);
}
