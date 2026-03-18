import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const { profile, targets, consumed, todayEntries, currentTime } = await req.json();

  const prompt = `
あなたは管理栄養士AIです。以下のデータを分析して、栄養摂取状況と今後の食事タイミングのアドバイスをしてください。

現在時刻: ${currentTime}
目標カロリー: ${profile.targetCalories}kcal

【今日の目標栄養素】
- タンパク質: ${targets.protein}g
- 脂質: ${targets.fat}g
- 炭水化物: ${targets.carbs}g
- 食物繊維: ${targets.fiber}g

【現在の摂取状況】
- カロリー: ${consumed.calories}kcal（残り${profile.targetCalories - consumed.calories}kcal）
- タンパク質: ${consumed.protein}g（残り${Math.max(0, targets.protein - consumed.protein)}g）
- 脂質: ${consumed.fat}g（残り${Math.max(0, targets.fat - consumed.fat)}g）
- 炭水化物: ${consumed.carbs}g（残り${Math.max(0, targets.carbs - consumed.carbs)}g）

【今日の食事記録】
${todayEntries.map((e: any) => `- ${e.time || e.meal}: ${e.foodName}（${e.grams}g, ${e.calories}kcal, P${e.protein}g F${e.fat}g C${e.carbs}g）`).join('\n')}

以下のJSON形式で回答してください:
{
  "deficiencies": [
    {"nutrient": "栄養素名", "remaining": "残り量（g）", "severity": "high/medium/low", "message": "具体的なコメント"}
  ],
  "timing": [
    {
      "time": "推奨時間帯（例: 15:00〜16:00）",
      "meal": "食事の種類",
      "nutrients": [
        {"name": "栄養素名（例: タンパク質）", "amount": "この食事で摂るべき量（例: 20g）", "reason": "この時間に必要な理由"}
      ],
      "suggestion": "具体的な食品と量の提案",
      "effect": "この食事タイミングの効果"
    }
  ],
  "overall": "今日の食事全体への総評（1〜2文）"
}
`;

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
