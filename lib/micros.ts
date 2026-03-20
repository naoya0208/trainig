import { MicroNutrients } from './store';

export const MICRO_DEFS: {
  key: keyof MicroNutrients;
  label: string;
  unit: string;
  target: number;
  isLimit?: boolean;
  purpose?: 'beauty' | 'muscle'; // 指定なし = 常時表示
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
  // 美容向け（goalPurpose === 'beauty' のときのみ表示）
  { key: 'vitaminE',   label: 'ビタミンE',   unit: 'mg', target: 6.0,  purpose: 'beauty' },
  { key: 'vitaminA',   label: 'ビタミンA',   unit: 'μg', target: 700,  purpose: 'beauty' },
  { key: 'biotin',     label: 'ビオチン',    unit: 'μg', target: 50,   purpose: 'beauty' },
  { key: 'vitaminB2',  label: 'ビタミンB2',  unit: 'mg', target: 1.2,  purpose: 'beauty' },
];

/** 表示するMICRO_DEFSをgoalPurposeでフィルタリング */
export function getActiveMicroDefs(goalPurpose?: string) {
  return MICRO_DEFS.filter(d => !d.purpose || d.purpose === goalPurpose);
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
