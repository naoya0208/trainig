import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const { profile, type } = await req.json();

  const prompts: Record<string, string> = {
    targetWeight: `
あなたは医療・栄養の専門家AIです。以下のプロフィールに基づいて、目標体重の設定についてアドバイスしてください。

プロフィール:
- 性別: ${profile.gender === 'male' ? '男性' : profile.gender === 'female' ? '女性' : 'その他'}
- 年齢: ${profile.age}歳
- 身長: ${profile.height}cm
- 現在体重: ${profile.weight}kg
- 現在BMI: ${(profile.weight / Math.pow(profile.height / 100, 2)).toFixed(1)}
- 体脂肪率: ${profile.bodyFatPercent ? profile.bodyFatPercent + '%' : '未入力'}
- 現在の目標体重: ${profile.targetWeight}kg

以下の項目についてJSON形式で回答してください:
{
  "standardWeight": 標準体重(kg, 数値),
  "idealRange": "理想的な体重範囲（例: 55〜70kg）",
  "currentStatus": "現在の状態の評価（1〜2文）",
  "targetEvaluation": "設定した目標体重の評価（適切か、無理がないか）",
  "recommendations": ["具体的なアドバイス1", "アドバイス2", "アドバイス3"],
  "caution": "注意事項（あれば）"
}
`,
    dailyAdvice: `
以下のユーザーの今日のデータを分析してアドバイスをください。

プロフィール: 身長${profile.height}cm, 体重${profile.weight}kg, 目標体重${profile.targetWeight}kg
基礎代謝: ${profile.bmr}kcal, 消費カロリー: ${profile.tdee}kcal
目標摂取カロリー: ${profile.targetCalories}kcal
今日の摂取: ${profile.todayConsumed}kcal, 運動消費: ${profile.todayBurned}kcal

JSON形式で回答:
{
  "status": "良好/注意/警告",
  "message": "今日の総評（2〜3文）",
  "tips": ["具体的なアドバイス1", "アドバイス2"]
}
`,
  };

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompts[type] || prompts.dailyAdvice);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: 'parse error' }, { status: 500 });
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gemini API error' }, { status: 500 });
  }
}
