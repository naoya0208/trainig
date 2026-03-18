import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const { query, mode } = await req.json();
  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });

  const isSupplement = mode === 'supplement';

  const foodPrompt = `
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
        "micros": {
          "fiber": 食物繊維（g）,
          "vitaminD": ビタミンD（μg）,
          "vitaminB12": ビタミンB12（μg）,
          "vitaminC": ビタミンC（mg）,
          "iron": 鉄分（mg）,
          "calcium": カルシウム（mg）,
          "zinc": 亜鉛（mg）,
          "omega3": EPA+DHA（g）,
          "sodium": ナトリウム（mg）
        }
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
- microsの各値は推定値でよい。含まれない場合は0
`;

  const supplementPrompt = `
あなたはサプリメント専門の栄養士AIです。以下のサプリメントについて、1回摂取分の栄養情報をJSON形式で返してください。

ユーザー入力: "${query}"

回答はJSON配列のみ（説明文不要）:
[
  {
    "name": "サプリメント名",
    "note": "摂取タイミングや特記事項（例: 食後推奨、脂溶性なので食事と一緒に）",
    "ingredients": [
      {
        "name": "成分名または剤形（例: ビタミンD3カプセル、フィッシュオイルソフトジェル）",
        "grams": 1粒（1単位）あたりの重量（g, 数値）,
        "servingUnit": "粒" または "錠" または "包" または "スクープ" など,
        "calories": カロリー（kcal, 数値、多くは0〜5程度）,
        "protein": タンパク質（g, 数値）,
        "fat": 脂質（g, 数値）,
        "carbs": 炭水化物（g, 数値）,
        "micros": {
          "fiber": 食物繊維（g）,
          "vitaminD": ビタミンD（μg）,
          "vitaminB12": ビタミンB12（μg）,
          "vitaminC": ビタミンC（mg）,
          "iron": 鉄分（mg）,
          "calcium": カルシウム（mg）,
          "zinc": 亜鉛（mg）,
          "omega3": EPA+DHA（g）,
          "sodium": ナトリウム（mg）
        }
      }
    ]
  }
]

ルール:
- **1粒（1単位）あたり**の栄養値を返すこと（ユーザーがUI上で粒数を変更してスケールするため）
- servingUnitは「粒」「錠」「包」「スクープ」「カプセル」「ソフトジェル」から最適なものを選ぶ
- 複合サプリでも基本は ingredients 1要素でOK（カロリー源になる成分は分けてもよい）
- 数値は整数または小数点1桁
- そのサプリが含む成分のみmicrosに値を入れ、含まない場合は0
- ブランド名が不明な場合は一般的な市販品の平均値を推定
- 複数の商品バリエーションが考えられる場合は配列に複数追加
`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = isSupplement ? supplementPrompt : foodPrompt;
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
