import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
あなたは栄養士AIです。以下の食品・料理について栄養情報をJSON形式で返してください。

ユーザー入力: "${query}"

回答はJSON配列のみ（説明文不要）:
[
  {
    "name": "食品名",
    "grams": 推定グラム数（数値）,
    "calories": カロリー（kcal, 数値）,
    "protein": タンパク質（g, 数値）,
    "fat": 脂質（g, 数値）,
    "carbs": 炭水化物（g, 数値）,
    "note": "補足情報（ブランドや調理法など）"
  }
]

ルール:
- グラムが明示されていない場合は一般的な1食分を推定
- 複数の料理が含まれる場合は配列に複数追加
- 外食・コンビニ商品も対応
- 数値は整数または小数点1桁
`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return NextResponse.json({ error: 'parse error' }, { status: 500 });
    const foods = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ foods });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gemini API error' }, { status: 500 });
  }
}
