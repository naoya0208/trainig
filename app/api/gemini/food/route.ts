import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `
あなたは栄養士AIです。以下の食品・料理について、具材ごとの栄養情報をJSON形式で返してください。

ユーザー入力: "${query}"

回答はJSON配列のみ（説明文不要）:
[
  {
    "name": "料理名",
    "note": "補足情報（ブランドや調理法など、なければ省略）",
    "ingredients": [
      {
        "name": "具材名",
        "grams": 推定グラム数（数値）,
        "calories": カロリー（kcal, 数値）,
        "protein": タンパク質（g, 数値）,
        "fat": 脂質（g, 数値）,
        "carbs": 炭水化物（g, 数値）,
        "fiber": 食物繊維（g, 数値）
      }
    ]
  }
]

ルール:
- 料理は具材に分解して記載（例: ラーメン→麺・スープ・チャーシュー・ネギ・卵など）
- シンプルな食品（バナナ・卵など）は具材1つでOK
- グラムが明示されていない場合は一般的な1食分を推定
- 複数の料理が含まれる場合は配列に複数追加
- 数値は整数または小数点1桁
`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return NextResponse.json({ error: 'parse error' }, { status: 500 });
    const foods = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ foods });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: 'Gemini API error', detail: e?.message }, { status: 500 });
  }
}
