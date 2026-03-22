/** 薬・サプリと栄養の相互作用定義 */

export type MedicationKey =
  | 'pill'           // 低用量ピル(OC/LEP)
  | 'antihistamine'  // 抗ヒスタミン薬（花粉・アレルギー）
  | 'steroid_nasal'  // ステロイド系（点鼻・吸入・皮膚外用）
  | 'antibiotic'     // 抗生物質
  | 'metformin'      // メトホルミン（糖尿病）
  | 'statin'         // スタチン（コレステロール低下薬）
  | 'ssri'           // 抗うつ薬（SSRI）
  | 'levothyroxine'  // 甲状腺ホルモン薬
  | 'iron_supplement'; // 鉄剤（貧血治療）

export interface DepletedNutrient {
  key: string;  // MicroNutrients key
  label: string;
  severity: 'high' | 'medium' | 'low';
  reason: string;
}

export interface MedicationDef {
  key: MedicationKey;
  label: string;
  category: string;
  icon: string;
  depletedNutrients: DepletedNutrient[];
  recommendations: string[];
  avoid?: string[];
  warnings?: string[];
}

export const MEDICATION_DEFS: MedicationDef[] = [
  {
    key: 'pill',
    label: '低用量ピル（OC / LEP）',
    category: 'ホルモン',
    icon: '💊',
    depletedNutrients: [
      { key: 'vitaminB2',  label: 'ビタミンB2',  severity: 'high',   reason: 'ピルによる代謝促進で消耗しやすい（Briggs 1982, Theuer 1972）' },
      { key: 'vitaminB12', label: 'ビタミンB12', severity: 'medium', reason: '吸収阻害の報告あり（Webb 2003）' },
      { key: 'magnesium',  label: 'マグネシウム', severity: 'medium', reason: 'エストロゲン↑により尿中排泄増加（Stanton 1986）' },
      { key: 'zinc',       label: '亜鉛',         severity: 'medium', reason: '血漿亜鉛低下・銅上昇の報告（Mukherjee 2004）' },
      { key: 'vitaminC',   label: 'ビタミンC',    severity: 'low',    reason: '高用量(≥1g)のVit-C服用はピルのエストロゲン濃度を一時上昇させる可能性（Back 1981）' },
    ],
    recommendations: [
      'ビタミンB群（B2・B6・葉酸・B12）を意識的に食事から補給',
      '亜鉛・マグネシウムの補給を意識する（ナッツ・豆類・海藻）',
      'ビタミンCサプリ1g以上はピル服用の前後4時間を避ける',
      '水分をしっかり摂り血栓リスクを下げる',
      '喫煙は血栓リスクを大幅に高めるため禁煙を',
    ],
    avoid: ['大量のビタミンC（1g以上）はピルと4時間あける'],
    warnings: ['喫煙との併用は血栓リスクが著しく高まります。必ず医師に相談を'],
  },
  {
    key: 'antihistamine',
    label: '抗ヒスタミン薬（花粉・アレルギー）',
    category: 'アレルギー',
    icon: '🌿',
    depletedNutrients: [],
    recommendations: [
      '水分を多く摂る（口渇・鼻粘膜乾燥を緩和）',
      'ケルセチン含有食品（タマネギ・リンゴ・そば）で自然な抗ヒスタミン効果（Middleton 2000）',
      'ビタミンC・亜鉛で免疫・粘膜を強化',
      'プロバイオティクスで腸管免疫を整える（gut-immune axis）',
    ],
    avoid: ['アルコールと併用すると眠気が著しく増強される'],
    warnings: ['眠気が出る場合は運動・車の運転前の服用に注意'],
  },
  {
    key: 'steroid_nasal',
    label: 'ステロイド系（点鼻・吸入・外用）',
    category: 'アレルギー / 炎症',
    icon: '💨',
    depletedNutrients: [
      { key: 'calcium',   label: 'カルシウム',  severity: 'medium', reason: '長期使用で骨吸収促進・骨密度低下リスク（Rhen 2005）' },
      { key: 'vitaminD',  label: 'ビタミンD',   severity: 'medium', reason: 'Ca吸収補助に重要。ステロイドはVit-D代謝を阻害（Reid 2010）' },
      { key: 'vitaminK2', label: 'ビタミンK2',  severity: 'low',    reason: 'Ca骨沈着にK2が必要。長期ステロイド使用者で有益性あり（Ushiroyama 2002）' },
    ],
    recommendations: [
      'カルシウム（小魚・乳製品）＋ビタミンD（魚・日光）＋ビタミンK2（納豆・チーズ）を意識',
      '長期使用の場合は骨密度検査（DXA）を年1回推奨',
      '亜鉛・ビタミンCで免疫維持',
    ],
    warnings: ['点鼻・吸入は全身リスクは低いが、長期大量使用の場合は医師に相談'],
  },
  {
    key: 'antibiotic',
    label: '抗生物質',
    category: '感染症',
    icon: '🔬',
    depletedNutrients: [
      { key: 'vitaminK2', label: 'ビタミンK2', severity: 'medium', reason: '腸内細菌によるK2産生が減少（Conly 1994）' },
      { key: 'fiber',     label: '食物繊維',   severity: 'low',    reason: '腸内フローラ回復のためプレバイオティクスとして重要' },
    ],
    recommendations: [
      'ヨーグルト・納豆などプロバイオティクスを毎日摂る（抗生物質と2〜3時間あけて）',
      'ビタミンK2含有食品（納豆・チーズ・鶏もも）を意識',
      '水溶性食物繊維（プレバイオティクス）で善玉菌の回復を助ける',
    ],
    avoid: ['カルシウム・マグネシウム・鉄を多く含む食品は抗生物質の吸収を阻害することがある（2時間あける）'],
    warnings: ['飲み忘れは耐性菌のリスク。指定タイミングで服用し、コース完遂を'],
  },
  {
    key: 'metformin',
    label: 'メトホルミン（糖尿病・PCOS）',
    category: '代謝',
    icon: '🩺',
    depletedNutrients: [
      { key: 'vitaminB12', label: 'ビタミンB12', severity: 'high',   reason: '回腸での吸収を阻害。長期使用者の30%でB12低下（Ting 2006）' },
      { key: 'calcium',    label: 'カルシウム',  severity: 'low',    reason: 'カルシウムがB12吸収を助けるため、摂取不足に注意' },
    ],
    recommendations: [
      'ビタミンB12を食事と血液検査で定期的にモニタリング',
      '魚・貝類・卵・乳製品からB12を摂取する',
      'B12サプリを医師と相談して検討',
    ],
    warnings: ['神経障害・認知機能低下のリスク。B12値を年1回は測定を'],
  },
  {
    key: 'statin',
    label: 'スタチン（コレステロール低下薬）',
    category: '心血管',
    icon: '❤️',
    depletedNutrients: [
      { key: 'vitaminD',  label: 'ビタミンD',   severity: 'medium', reason: 'コレステロール合成阻害でVit-D（コレステロール誘導体）の産生も低下する可能性' },
    ],
    recommendations: [
      'グレープフルーツは薬物代謝を阻害するため避ける',
      'ビタミンD・コエンザイムQ10（イワシ・ブロッコリー）を意識',
      'オメガ3（EPA/DHA）でTG低下の相乗効果（JELIS試験）',
      '筋肉痛・倦怠感が続く場合は医師に報告',
    ],
    avoid: ['グレープフルーツ・グレープフルーツジュースは薬の血中濃度を上げる'],
    warnings: ['横紋筋融解症の初期症状（筋肉痛・赤褐色の尿）に注意'],
  },
  {
    key: 'ssri',
    label: '抗うつ薬（SSRI）',
    category: '精神神経',
    icon: '🧠',
    depletedNutrients: [
      { key: 'sodium',     label: 'ナトリウム', severity: 'low',    reason: 'SIADH（抗利尿ホルモン不適切分泌）により低ナトリウム血症のリスク（Uchida 2010）' },
    ],
    recommendations: [
      'トリプトファン含有食品（バナナ・卵・チーズ・豆腐）でセロトニン合成をサポート',
      'オメガ3（EPA/DHA）は抑うつ症状の軽減に有益性あり（Mocking 2016）',
      'マグネシウム・ビタミンB6でセロトニン→メラトニン変換を助ける',
      '腸内環境（腸脳軸）の改善がメンタルにも寄与',
    ],
    avoid: ['セントジョーンズワートはSSRIとの相互作用で危険（セロトニン症候群）'],
    warnings: ['自己判断での減薬・断薬は危険。必ず医師と相談を'],
  },
  {
    key: 'levothyroxine',
    label: '甲状腺ホルモン薬（チラーヂン等）',
    category: 'ホルモン',
    icon: '🦋',
    depletedNutrients: [],
    recommendations: [
      '服薬は空腹時（食事30〜60分前）が吸収効率最大',
      'カルシウム・鉄・マグネシウム・大豆製品は薬の吸収を低下させる（4時間以上あける）',
      'セレンとヨウ素（昆布・海藻）は甲状腺機能に関与するが過剰摂取注意',
    ],
    avoid: ['カルシウム・鉄・大豆製品は薬と4時間以上あける'],
    warnings: ['薬の服薬タイミングが治療効果に直結します'],
  },
  {
    key: 'iron_supplement',
    label: '鉄剤（貧血治療）',
    category: '貧血',
    icon: '🔴',
    depletedNutrients: [],
    recommendations: [
      'ビタミンC（ブロッコリー・ピーマン・レモン）と一緒に摂ると吸収率3〜4倍',
      'タンニン（お茶・コーヒー・赤ワイン）は鉄吸収を阻害するため食事中は避ける',
      '動物性鉄分（ヘム鉄：肉・魚）は植物性より吸収率が高い',
      '便秘になりやすいため水分・食物繊維を十分に',
    ],
    avoid: ['お茶・コーヒーは服薬直後2時間は避ける（タンニンが吸収阻害）'],
    warnings: ['過剰摂取は酸化ストレスのリスク。医師の指示量を守って'],
  },
];

/** AI検索で登録したカスタム薬 */
export interface CustomMedication {
  id: string;
  name: string;
  category: string;
  depletedNutrients: DepletedNutrient[];
  recommendations: string[];
  avoid?: string[];
  warnings?: string[];
  searchedAt: string; // ISO date
}

/** ユーザーの服薬リストから影響を受ける栄養素をまとめる（ビルトイン＋カスタム両対応）*/
export function getAffectedNutrients(
  medicationKeys: string[],
  customMedications: CustomMedication[] = [],
): Map<string, { label: string; severity: 'high' | 'medium' | 'low'; reasons: string[] }> {
  const map = new Map<string, { label: string; severity: 'high' | 'medium' | 'low'; reasons: string[] }>();

  function merge(name: string, depleted: DepletedNutrient[]) {
    for (const dn of depleted) {
      const existing = map.get(dn.key);
      if (existing) {
        existing.reasons.push(`${name}：${dn.reason}`);
        if (dn.severity === 'high') existing.severity = 'high';
        else if (dn.severity === 'medium' && existing.severity === 'low') existing.severity = 'medium';
      } else {
        map.set(dn.key, { label: dn.label, severity: dn.severity, reasons: [`${name}：${dn.reason}`] });
      }
    }
  }

  for (const key of medicationKeys) {
    const def = MEDICATION_DEFS.find(d => d.key === key);
    if (def) merge(def.label, def.depletedNutrients);
  }
  for (const med of customMedications) {
    merge(med.name, med.depletedNutrients);
  }
  return map;
}
