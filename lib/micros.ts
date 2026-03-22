import { MicroNutrients } from './store';
import { MenstrualPhaseInfo } from './calc';

export const MICRO_DEFS: {
  key: keyof MicroNutrients;
  label: string;
  unit: string;
  target: number;
  isLimit?: boolean;
  purpose?: 'beauty' | 'muscle'; // 指定なし = 常時表示
  priority?: 'high' | 'low';    // beauty のみ。high = 常時表示、low = 折りたたみ
}[] = [
  { key: 'fiber',      label: '食物繊維',    unit: 'g',  target: 22 },
  { key: 'vitaminD',   label: 'ビタミンD',   unit: 'μg', target: 8.5 },
  { key: 'vitaminB12', label: 'ビタミンB12', unit: 'μg', target: 2.4 },
  { key: 'vitaminC',   label: 'ビタミンC',   unit: 'mg', target: 100 },
  { key: 'iron',       label: '鉄分',        unit: 'mg', target: 7.5 },
  { key: 'calcium',    label: 'カルシウム',  unit: 'mg', target: 650 },
  { key: 'zinc',       label: '亜鉛',        unit: 'mg', target: 10 },
  { key: 'omega3',     label: 'EPA+DHA',     unit: 'g',  target: 2.0 },
  { key: 'sodium',     label: 'ナトリウム',  unit: 'mg', target: 2000, isLimit: true },
  // 美容向け・高優先度（常時表示）
  { key: 'vitaminE',        label: 'ビタミンE',    unit: 'mg', target: 6.0,  purpose: 'beauty', priority: 'high' },
  { key: 'biotin',          label: 'ビオチン',     unit: 'μg', target: 50,   purpose: 'beauty', priority: 'high' },
  { key: 'magnesium',       label: 'マグネシウム', unit: 'mg', target: 270,  purpose: 'beauty', priority: 'high' },
  { key: 'vitaminB6',       label: 'ビタミンB6',   unit: 'mg', target: 1.2,  purpose: 'beauty', priority: 'high' },
  // 美容向け・低優先度（折りたたみ）
  { key: 'vitaminA',        label: 'ビタミンA',    unit: 'μg', target: 700,  purpose: 'beauty', priority: 'low' },
  { key: 'vitaminB2',       label: 'ビタミンB2',   unit: 'mg', target: 1.2,  purpose: 'beauty', priority: 'low' },
  { key: 'niacin',          label: 'ナイアシン',   unit: 'mg', target: 13,   purpose: 'beauty', priority: 'low' },
  { key: 'pantothenicAcid', label: 'パントテン酸', unit: 'mg', target: 5,    purpose: 'beauty', priority: 'low' },
  { key: 'selenium',        label: 'セレン',       unit: 'μg', target: 25,   purpose: 'beauty', priority: 'low' },
  { key: 'vitaminK2',       label: 'ビタミンK2',   unit: 'μg', target: 45,   purpose: 'beauty', priority: 'low' },
  { key: 'folate',          label: '葉酸',         unit: 'μg', target: 240,  purpose: 'beauty', priority: 'low' },
];

/** 表示するMICRO_DEFSをgoalPurpose・gender・月経フェーズでフィルタリング＆目標値調整 */
export function getActiveMicroDefs(goalPurpose?: string, gender?: string, phaseInfo?: MenstrualPhaseInfo) {
  return MICRO_DEFS
    .filter(d => !d.purpose || d.purpose === goalPurpose)
    .map(d => {
      let target = d.target;
      // 女性共通の調整（美容モード関係なく適用）
      if (d.key === 'iron' && gender === 'female') target = 10.5;   // 月経による損失
      if (d.key === 'calcium' && gender === 'female') target = 700; // 骨粗鬆症リスク
      // 美容モード追加調整
      if (goalPurpose === 'beauty') {
        if (d.key === 'vitaminC') target = 200; // コラーゲン合成・抗酸化
        if (d.key === 'fiber') target = 25;     // 腸肌相関
      }
      // 月経フェーズ別調整（研究根拠あり）
      if (phaseInfo) {
        const adj = phaseInfo.nutrientAdjustments.find(a => a.key === d.key);
        if (adj && adj.delta !== 0) target = Math.round((target + adj.delta) * 10) / 10;
      }
      return target === d.target ? d : { ...d, target };
    });
}

export function sumMicros(entries: { micros?: MicroNutrients; fiber?: number }[]): MicroNutrients {
  const result: MicroNutrients = {};
  for (const e of entries) {
    const m = e.micros ?? {};
    for (const d of MICRO_DEFS) {
      const val = d.key === 'fiber'
        ? (m.fiber ?? e.fiber ?? 0)
        : ((m[d.key] as number | undefined) ?? 0);
      (result[d.key] as number) = Math.round(((result[d.key] as number ?? 0) + val) * 10) / 10;
    }
  }
  return result;
}
