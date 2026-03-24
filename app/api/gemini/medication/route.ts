import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const NUTRIENT_KEYS = [
  'fiber','vitaminD','vitaminB12','vitaminC','iron','calcium','zinc','omega3','sodium',
  'vitaminE','vitaminA','biotin','vitaminB2','niacin','pantothenicAcid','magnesium',
  'selenium','vitaminK2',
];

export async function POST(req: NextRequest) {
  const { query, apiKey } = await req.json();
  const genAI = new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY!);
  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });

  const prompt = `
あなたは薬剤師・栄養士AIです。以下の薬・サプリメントについて、栄養素との相互作用をJSON形式で返してください。

薬・サプリメント名: "${query}"

回答はJSONオブジェクトのみ（説明文不要）:
{
  "name": "薬の正式名称または一般名",
  "category": "薬効分類（例: 経口避妊薬, 抗ヒスタミン薬, 抗生物質 等）",
  "depletedNutrients": [
    {
      "key": "栄養素キー（下記リストから選択）",
      "label": "栄養素名（日本語）",
      "severity": "high または medium または low",
      "reason": "消耗・相互作用の理由（研究・機序を簡潔に）"
    }
  ],
  "recommendations": [
    "この薬を飲む際の食事・栄養の推奨事項（配列、3〜5個）"
  ],
  "avoid": [
    "避けるべき食品・飲み物・サプリ（配列、あれば）"
  ],
  "warnings": [
    "重要な注意事項（配列、あれば）"
  ]
}

利用可能な栄養素キー（depletedNutrients.keyはこの中から選択）:
${NUTRIENT_KEYS.join(', ')}

ルール:
- 実際の薬理学・栄養学の研究に基づいた正確な情報を返すこと
- 消耗・相互作用が認められない場合はdepletedNutrientsを空配列にする
- avoidやwarningsも実際に根拠があるもののみ記載
- 薬品名が不明・架空の場合は { "error": "not_found" } を返す
- ブランド名と一般名の両方に対応（例: タイレノール → アセトアミノフェン）
`;

  function extract(text: string) {
    const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }

  try {
    // まずGoogle検索グラウンディングで最新情報を取得
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ googleSearch: {} } as any],
    });
    const result = await model.generateContent(prompt);
    const data = extract(result.response.text());
    if (!data) return NextResponse.json({ error: 'parse error' }, { status: 500 });
    if (data.error === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ medication: data, usedSearch: true });
  } catch {
    // フォールバック: 検索なし
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      const data = extract(result.response.text());
      if (!data) return NextResponse.json({ error: 'parse error' }, { status: 500 });
      if (data.error === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 });
      return NextResponse.json({ medication: data, usedSearch: false });
    } catch (e: any) {
      return NextResponse.json({ error: 'api error', detail: e?.message }, { status: 500 });
    }
  }
}
