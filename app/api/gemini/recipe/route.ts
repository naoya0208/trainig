import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, nutrients, condition, goal, messages, dishName } = body;

  const GOAL_INSTRUCTIONS: Record<string, string> = {
    diet:    '【最優先】減量・ダイエット目的。低カロリー・低脂質・高たんぱくで腹持ちの良い料理を優先してください。揚げ物や高糖質な料理は避けてください。',
    muscle:  '【最優先】筋肉増量目的。高タンパク（1品で20g以上が理想）で栄養密度が高い料理を優先してください。食後の筋合成を意識した食材を使ってください。',
    beauty:  '【最優先】美容・肌ケア目的。コラーゲン生成を助けるビタミンC・鉄分、抗酸化作用のある食材、腸活に良い食物繊維を含む料理を優先してください。',
    health:  '【最優先】健康維持目的。栄養バランスが良く、野菜・発酵食品・良質な脂質を含む料理を優先してください。',
    fatigue: '【最優先】疲労回復目的。ビタミンB群・鉄分・クエン酸を豊富に含む食材を使い、エネルギー代謝を高める料理を優先してください。',
    immune:  '【最優先】免疫強化目的。ビタミンC・亜鉛・β-グルカン・発酵食品など免疫機能をサポートする食材を含む料理を優先してください。',
  };
  const goalInstruction = goal ? GOAL_INSTRUCTIONS[goal] ?? '' : '';

  // 料理の詳細取得
  if (action === 'detail') {
    const prompt = `「${dishName}」の詳細なレシピと栄養情報を教えてください。
以下のJSON形式で回答してください:
{
  "ingredients": ["材料1（量）", "材料2（量）"],
  "steps": ["手順1", "手順2", "手順3"],
  "tips": "コツやポイント（1〜2文）",
  "servings": "何人分か",
  "micros": {
    "fiber": 食物繊維g数値,
    "vitaminC": ビタミンCmg数値,
    "vitaminD": ビタミンDμg数値,
    "vitaminB12": ビタミンB12μg数値,
    "vitaminE": ビタミンEmg数値,
    "vitaminA": ビタミンAμg数値,
    "vitaminB6": ビタミンB6mg数値,
    "iron": 鉄分mg数値,
    "calcium": カルシウムmg数値,
    "zinc": 亜鉛mg数値,
    "magnesium": マグネシウムmg数値,
    "folate": 葉酸μg数値,
    "omega3": EPA+DHAg数値
  }
}
micros は1人前の概算値を数値で入れてください。不明な場合は0としてください。`;
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return NextResponse.json({ error: 'parse error', raw: text.slice(0, 200) }, { status: 500 });
      const detail = JSON.parse(jsonMatch[0]);
      detail.searchUrl = `https://cookpad.com/search/${encodeURIComponent(dishName)}`;
      return NextResponse.json(detail);
    } catch (e: any) {
      console.error('[recipe/detail]', e);
      const status = e?.status ?? 500;
      const msg = e?.message ?? String(e);
      return NextResponse.json({ error: msg }, { status });
    }
  }

  // チャット継続
  if (messages && messages.length > 0) {
    const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));
    const lastMessage = messages[messages.length - 1].content;
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const chat = model.startChat({ history });
      const result = await chat.sendMessage(lastMessage);
      return NextResponse.json({ reply: result.response.text() });
    } catch (e: any) {
      console.error('[recipe/chat]', e);
      return NextResponse.json({ error: e?.message ?? String(e) }, { status: e?.status ?? 500 });
    }
  }

  // 初回の料理提案
  const nutrientList = nutrients.length > 0 ? nutrients.join('、') : '特に指定なし';
  const conditionText = condition ? `\n絞り込み条件: ${condition}` : '';
  const prompt = `あなたは管理栄養士兼料理研究家のAIです。
不足している栄養素を補える料理を提案してください。
${goalInstruction ? `\n${goalInstruction}\n` : ''}
不足している栄養素: ${nutrientList}${conditionText}

以下のJSON形式で3〜5品提案してください。目的がある場合はその目的に最も合った料理を先頭に並べてください:
{
  "dishes": [
    {
      "name": "料理名",
      "description": "一言説明（食材・味など）",
      "nutrients": ["この料理で補える主な栄養素"],
      "time": "調理時間の目安",
      "cost": "コスト感（低/中/高）",
      "nutrition": { "calories": 概算カロリー数値, "protein": タンパク質g数値, "fat": 脂質g数値, "carbs": 炭水化物g数値 }
    }
  ],
  "message": "提案の一言コメント"
}
nutritionは1人前の概算値を数値で入れてください。`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: 'parse error' }, { status: 500 });
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (e: any) {
    console.error('[recipe/propose]', e);
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: e?.status ?? 500 });
  }
}
