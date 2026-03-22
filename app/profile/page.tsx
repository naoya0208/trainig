'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Profile, ActivityLevel, GoalType, GoalPurpose, calcBMR, calcTDEE, calcTargetCalories, calcBMI, getBMIStatus, calcIdealWeight, getEffectiveTargetWeight, getMenstrualPhase } from '@/lib/calc';
import { MEDICATION_DEFS, MedicationKey } from '@/lib/medications';
import { localDate } from '@/lib/date';

const ACTIVITIES: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 1.2,   label: 'ほぼ非活動的', desc: 'デスクワーク・ほぼ運動なし' },
  { value: 1.375, label: '軽い活動',     desc: '週1〜2回の軽い運動' },
  { value: 1.55,  label: '中程度の活動', desc: '週3〜5回の運動' },
  { value: 1.725, label: '活発な活動',   desc: '週6〜7回のハードな運動' },
  { value: 1.9,   label: '非常に活発',   desc: '肉体労働・1日2回トレーニング' },
];

function ProfileContent() {
  const { profile, setProfile, hydrate, syncCode, setSyncCode, loadFromCloud, syncToCloud } = useStore();
  const searchParams = useSearchParams();
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [targetBodyFat, setTargetBodyFat] = useState('');
  const [targetMode, setTargetMode] = useState<'weight' | 'bodyfat'>('weight');
  const [bodyFat, setBodyFat] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>(1.55);
  const [goalType, setGoalType] = useState<GoalType>('lose');
  const [goalPurpose, setGoalPurpose] = useState<GoalPurpose | undefined>(undefined);
  const [targetDate, setTargetDate] = useState('');
  const [manualBMR, setManualBMR] = useState('');
  const [appleWatch, setAppleWatch] = useState('');
  const [hasAppleWatch, setHasAppleWatch] = useState<boolean | undefined>(undefined);
  const [lastPeriodDate, setLastPeriodDate] = useState('');
  const [isIrregularCycle, setIsIrregularCycle] = useState(false);
  const [cycleLength, setCycleLength] = useState('28');
  const [medications, setMedications] = useState<string[]>([]);
  const [aiAdvice, setAiAdvice] = useState<any>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncInput, setSyncInput] = useState('');
  const [syncMsg, setSyncMsg] = useState('');

  useEffect(() => {
    hydrate();
    setSyncInput(syncCode);
  }, []);

  async function handleSyncLoad() {
    if (!syncInput.trim()) return;
    setSyncMsg('読み込み中...');
    const ok = await loadFromCloud(syncInput.trim());
    setSyncMsg(ok ? '✓ データを読み込みました' : '✗ 同期コードが見つかりません');
    setTimeout(() => setSyncMsg(''), 3000);
  }

  async function handleSyncSave() {
    if (!syncInput.trim() || !profile) return;
    setSyncCode(syncInput.trim());
    await syncToCloud();
    setSyncMsg('✓ クラウドに保存しました');
    setTimeout(() => setSyncMsg(''), 3000);
  }

  useEffect(() => {
    if (profile) {
      setGender(profile.gender);
      setAge(profile.age.toString());
      setHeight(profile.height.toString());
      setWeight(profile.weight.toString());
      setTargetWeight(profile.targetWeight.toString());
      setTargetBodyFat(profile.targetBodyFatPercent?.toString() ?? '');
      if (profile.targetBodyFatPercent != null) setTargetMode('bodyfat');
      setBodyFat(profile.bodyFatPercent?.toString() ?? '');
      setActivity(profile.activityLevel);
      setGoalType(profile.goalType);
      setGoalPurpose(profile.goalPurpose);
      setTargetDate(profile.targetDate ?? '');
      setManualBMR(profile.manualBMR?.toString() ?? '');
      setAppleWatch(profile.appleWatchCalories?.toString() ?? '');
      setHasAppleWatch(profile.hasAppleWatch);
      setLastPeriodDate(profile.lastPeriodDate ?? '');
      setIsIrregularCycle(profile.isIrregularCycle ?? false);
      setCycleLength(profile.cycleLength?.toString() ?? '28');
      setMedications(profile.medications ?? []);
    }
  }, [profile]);

  const preview: Profile | null = (() => {
    const a = parseInt(age), h = parseFloat(height), w = parseFloat(weight);
    const t = parseFloat(targetWeight);
    const tbf = parseFloat(targetBodyFat);
    if (isNaN(a) || isNaN(h) || isNaN(w)) return null;
    if (targetMode === 'weight' && isNaN(t)) return null;
    if (targetMode === 'bodyfat' && isNaN(tbf)) return null;
    return {
      gender, age: a, height: h, weight: w,
      targetWeight: targetMode === 'weight' ? t : (isNaN(t) ? w : t),
      targetBodyFatPercent: targetMode === 'bodyfat' ? tbf : undefined,
      bodyFatPercent: parseFloat(bodyFat) || undefined,
      activityLevel: activity, goalType,
      targetDate: targetDate || undefined,
      manualBMR: parseFloat(manualBMR) || undefined,
      appleWatchCalories: parseFloat(appleWatch) || undefined,
      hasAppleWatch,
      goalPurpose,
      lastPeriodDate: gender === 'female' && lastPeriodDate ? lastPeriodDate : undefined,
      isIrregularCycle: gender === 'female' ? isIrregularCycle : undefined,
      cycleLength: gender === 'female' && !isIrregularCycle ? parseInt(cycleLength) || 28 : undefined,
      medications: medications.length > 0 ? medications : undefined,
    };
  })();

  const bmr = preview ? calcBMR(preview) : null;
  const tdee = preview ? calcTDEE(preview) : null;
  const ti = preview ? calcTargetCalories(preview) : null;
  const bmi = preview ? calcBMI(preview.weight, preview.height) : null;
  const bmiStatus = bmi ? getBMIStatus(bmi) : null;
  const ideal = preview ? calcIdealWeight(preview.height) : null;

  async function getTargetAdvice() {
    if (!preview) return;
    setLoadingAdvice(true);
    try {
      const res = await fetch('/api/gemini/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'targetWeight', profile: preview }),
      });
      setAiAdvice(await res.json());
    } finally { setLoadingAdvice(false); }
  }

  function handleSave() {
    if (!preview) return;
    setProfile(preview);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">プロフィール設定</h1>

      {/* 基本情報 */}
      <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
        <h2 className="font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">基本情報</h2>

        <label className="text-sm font-semibold text-gray-600 block mb-2">性別</label>
        <div className="flex gap-2 mb-4">
          {([['male','男性'],['female','女性'],['other','その他']] as const).map(([v,l]) => (
            <button key={v} onClick={() => setGender(v)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${gender === v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {[
            { label: '年齢', val: age, set: setAge, ph: '30', unit: '歳' },
            { label: '身長', val: height, set: setHeight, ph: '170', unit: 'cm' },
            { label: '現在の体重', val: weight, set: setWeight, ph: '70.0', unit: 'kg' },
          ].map(f => (
            <div key={f.label}>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{f.label}</label>
              <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 px-3">
                <input className="flex-1 py-2.5 text-lg font-bold bg-transparent focus:outline-none"
                  type="number" placeholder={f.ph} value={f.val} onChange={e => f.set(e.target.value)} />
                <span className="text-sm text-gray-400">{f.unit}</span>
              </div>
            </div>
          ))}
          {/* 目標：体重 or 体脂肪率 */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-xs font-semibold text-gray-500">目標</label>
              <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
                <button onClick={() => setTargetMode('weight')}
                  className={`px-2 py-0.5 rounded-md font-semibold transition ${targetMode === 'weight' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>
                  体重
                </button>
                <button onClick={() => setTargetMode('bodyfat')}
                  className={`px-2 py-0.5 rounded-md font-semibold transition ${targetMode === 'bodyfat' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>
                  体脂肪率
                </button>
              </div>
            </div>
            {targetMode === 'weight' ? (
              <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 px-3">
                <input className="flex-1 py-2.5 text-lg font-bold bg-transparent focus:outline-none"
                  type="number" placeholder="65.0" value={targetWeight} onChange={e => setTargetWeight(e.target.value)} />
                <span className="text-sm text-gray-400">kg</span>
              </div>
            ) : (
              <div>
                <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 px-3">
                  <input className="flex-1 py-2.5 text-lg font-bold bg-transparent focus:outline-none"
                    type="number" placeholder="15.0" value={targetBodyFat} onChange={e => setTargetBodyFat(e.target.value)} />
                  <span className="text-sm text-gray-400">%</span>
                </div>
                {preview?.targetBodyFatPercent != null && preview.bodyFatPercent != null && (
                  <p className="text-xs text-blue-500 mt-1">
                    ≈ 目標体重 {getEffectiveTargetWeight(preview)}kg
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-gray-600 block mb-1">
              体脂肪率 <span className="font-normal text-gray-400 text-xs">（任意）</span>
            </label>
            <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 px-3">
              <input className="flex-1 py-2.5 text-lg font-bold bg-transparent focus:outline-none"
                type="number" placeholder="20.0" value={bodyFat} onChange={e => setBodyFat(e.target.value)} />
              <span className="text-sm text-gray-400">%</span>
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600 block mb-1">
              基礎代謝 <span className="font-normal text-gray-400 text-xs">（体組成計の実測値）</span>
            </label>
            <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 px-3">
              <input className="flex-1 py-2.5 text-lg font-bold bg-transparent focus:outline-none"
                type="number" placeholder="1400" value={manualBMR} onChange={e => setManualBMR(e.target.value)} />
              <span className="text-sm text-gray-400">kcal</span>
            </div>
          </div>
        </div>
        {manualBMR && parseFloat(manualBMR) > 0 && (
          <p className="text-xs text-blue-500 mt-2 bg-blue-50 rounded-xl px-3 py-2">
            ✓ 体組成計の実測BMR（{parseFloat(manualBMR).toLocaleString()}kcal）を使用します。計算式より優先されます。
          </p>
        )}
      </div>

      {/* 目標体重ガイド */}
      {ideal && bmi && bmiStatus && (
        <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-gray-800">目標体重の目安</h2>
            <button onClick={getTargetAdvice} disabled={loadingAdvice || !preview}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50 flex items-center gap-1">
              {loadingAdvice ? '⏳' : '✨ AIアドバイス'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-green-700">{ideal.standard}kg</p>
              <p className="text-xs text-green-600 mt-0.5">標準体重</p>
              <p className="text-xs text-gray-400">BMI 22</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-sm font-bold text-blue-700">{ideal.lower}〜{ideal.upper}kg</p>
              <p className="text-xs text-blue-600 mt-0.5">健康範囲</p>
              <p className="text-xs text-gray-400">BMI 18.5〜24.9</p>
            </div>
            <div className={`rounded-xl p-3 text-center ${bmi < 18.5 ? 'bg-blue-50' : bmi < 25 ? 'bg-green-50' : bmi < 30 ? 'bg-yellow-50' : 'bg-red-50'}`}>
              <p className={`text-lg font-bold ${bmiStatus.color}`}>{bmi}</p>
              <p className={`text-xs mt-0.5 ${bmiStatus.color}`}>{bmiStatus.label}</p>
              <p className="text-xs text-gray-400">現在のBMI</p>
            </div>
          </div>

          {/* AIアドバイス */}
          {aiAdvice && (
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-100">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-bold text-blue-600">✨ Gemini AI アドバイス</p>
                <button onClick={() => setAiAdvice(null)} className="text-gray-300 hover:text-gray-500">✕</button>
              </div>
              {aiAdvice.currentStatus && <p className="text-sm text-gray-700 mb-2">{aiAdvice.currentStatus}</p>}
              {aiAdvice.targetEvaluation && <p className="text-sm text-gray-700 mb-3 p-2 bg-white rounded-lg">{aiAdvice.targetEvaluation}</p>}
              {aiAdvice.recommendations && (
                <ul className="space-y-1">
                  {aiAdvice.recommendations.map((r: string, i: number) => (
                    <li key={i} className="text-sm text-gray-600">• {r}</li>
                  ))}
                </ul>
              )}
              {aiAdvice.caution && <p className="text-xs text-yellow-700 mt-3 bg-yellow-50 p-2 rounded-lg">⚠️ {aiAdvice.caution}</p>}
            </div>
          )}
        </div>
      )}

      {/* 活動量 */}
      <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
        <h2 className="font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">活動量</h2>
        <div className="space-y-2">
          {ACTIVITIES.map(a => (
            <button key={a.value} onClick={() => setActivity(a.value)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition ${activity === a.value ? 'bg-blue-50 border-blue-200' : 'border-gray-100 hover:bg-gray-50'}`}>
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${activity === a.value ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}`} />
              <div className="text-left">
                <p className={`text-sm font-semibold ${activity === a.value ? 'text-blue-700' : 'text-gray-700'}`}>{a.label}</p>
                <p className="text-xs text-gray-400">{a.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 目標設定 */}
      <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
        <h2 className="font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">目標設定</h2>

        <label className="text-sm font-semibold text-gray-600 block mb-2">重視する目的</label>
        <div className="flex gap-2 mb-4">
          {([
            ['muscle', '💪 筋肉・パフォーマンス'],
            ['beauty', '✨ 美容・スキンケア'],
          ] as const).map(([v, l]) => (
            <button key={v} onClick={() => {
                const next = goalPurpose === v ? undefined : v;
                setGoalPurpose(next);
                // 美容モードに切り替えた場合、増量は非対応のため維持にリセット
                if (next === 'beauty' && goalType === 'gain') setGoalType('maintain');
              }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${goalPurpose === v ? (v === 'beauty' ? 'bg-pink-500 text-white' : 'bg-blue-600 text-white') : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {l}
            </button>
          ))}
        </div>
        {goalPurpose === 'beauty' && (
          <div className="mb-4 bg-pink-50 border border-pink-100 rounded-xl px-3 py-3 text-xs text-pink-700 space-y-1.5">
            <p className="font-semibold">✨ 美容・スキンケアモードで変わること</p>
            <p>• <strong>PFC比率</strong>：タンパク質1.2g/kg ／ 脂質30%（脂溶性ビタミン吸収・肌の潤い）</p>
            <p>• <strong>食物繊維</strong>目標 22g→<strong>25g</strong>（腸肌相関・腸内フローラ改善）</p>
            <p>• <strong>ビタミンC</strong>目標 100mg→<strong>200mg</strong>（コラーゲン合成・抗酸化）</p>
            {(gender === 'female') && <p>• <strong>鉄分</strong>目標 7.5mg→<strong>10.5mg</strong>（月経による損失を考慮）</p>}
            <p>• 追加表示：ビタミンE・A・ビオチン・ビタミンB2（美肌・美髪・美爪）</p>
          </div>
        )}

        <label className="text-sm font-semibold text-gray-600 block mb-2">目標の種類</label>
        <div className="flex gap-2 mb-2">
          {(goalPurpose === 'beauty'
            ? [['lose','ダイエット'],['maintain','維持']] as const
            : [['lose','減量'],['maintain','維持'],['gain','増量']] as const
          ).map(([v,l]) => (
            <button key={v} onClick={() => setGoalType(v)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${goalType === v ? (goalPurpose === 'beauty' ? 'bg-pink-500 text-white' : 'bg-blue-600 text-white') : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {l}
            </button>
          ))}
        </div>
        {goalPurpose === 'beauty' && goalType === 'lose' && (
          <p className="text-xs text-pink-500 bg-pink-50 rounded-xl px-3 py-2 mb-3">
            ✨ 週-0.5kgまでの緩やかなペース。急激な減量は肌荒れ・抜け毛の原因になります。
          </p>
        )}
        {goalPurpose !== 'beauty' && goalType === 'lose' && (
          <p className="text-xs text-blue-400 bg-blue-50 rounded-xl px-3 py-2 mb-3">
            💪 週-1.0kgまで対応。筋肉を維持しながら脂肪を落とすモードです。
          </p>
        )}
        {goalType !== 'maintain' && (
          <div>
            <label className="text-sm font-semibold text-gray-600 block mb-2">目標達成日</label>
            <input type="date" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              min={localDate()}
              value={targetDate} onChange={e => setTargetDate(e.target.value)} />
          </div>
        )}
      </div>

      {/* 月経周期（女性のみ） */}
      {gender === 'female' && (
        <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🌸</span>
            <div>
              <h2 className="font-bold text-gray-800">月経周期</h2>
              <p className="text-xs text-gray-400">フェーズに合わせてカロリー・栄養目標を最適化</p>
            </div>
          </div>
          {/* 不定期トグル */}
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-gray-600">不定期・生理不順</label>
            <button onClick={() => setIsIrregularCycle(!isIrregularCycle)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${isIrregularCycle ? 'bg-pink-400' : 'bg-gray-200'}`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isIrregularCycle ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          {isIrregularCycle && (
            <div className="bg-pink-50 border border-pink-100 rounded-xl px-3 py-3 mb-3 text-xs text-pink-700 space-y-1">
              <p className="font-semibold">🌸 不定期モード</p>
              <p>• フェーズ別カロリー自動調整はオフになります</p>
              <p>• 参考として平均周期日数を入力すると目安表示に使います</p>
              <p>• 生理不順はストレス・栄養不足・体重変化が原因のことが多いです</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">直近の生理開始日</label>
              <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                max={new Date().toISOString().split('T')[0]}
                value={lastPeriodDate} onChange={e => setLastPeriodDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">平均周期日数{isIrregularCycle ? '（目安）' : ''}</label>
              <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 px-3">
                <input className="flex-1 py-2.5 text-lg font-bold bg-transparent focus:outline-none"
                  type="number" placeholder="28" min="21" max="40"
                  value={cycleLength} onChange={e => setCycleLength(e.target.value)} />
                <span className="text-sm text-gray-400">日</span>
              </div>
            </div>
          </div>
          {lastPeriodDate && (() => {
            const cl = parseInt(cycleLength) || 28;
            const info = getMenstrualPhase(lastPeriodDate, cl);
            const phaseColors: Record<string, string> = {
              menstrual: 'bg-red-50 border-red-200 text-red-700',
              follicular: 'bg-green-50 border-green-200 text-green-700',
              ovulation: 'bg-yellow-50 border-yellow-200 text-yellow-700',
              luteal: 'bg-purple-50 border-purple-200 text-purple-700',
            };
            const cls = phaseColors[info.phase];
            return (
              <div className={`rounded-xl border p-3 ${cls}`}>
                <p className="font-bold text-sm mb-1">現在：{info.label}（第{info.day}日）</p>
                {!isIrregularCycle && info.extraCalories > 0 && (
                <p className="text-xs mb-2">📈 カロリー目標 +{info.extraCalories}kcal（代謝上昇を反映）</p>
              )}
              {isIrregularCycle && (
                <p className="text-xs mb-2 opacity-70">⚠️ 不定期モードのため自動カロリー調整はオフです（参考表示）</p>
              )}
              <ul className="space-y-0.5">
                {info.tips.map((t, i) => <li key={i} className="text-xs opacity-80">• {t}</li>)}
              </ul>
            </div>
          );
          })()}
          {!lastPeriodDate && (
            <p className="text-xs text-gray-400">生理開始日を入力すると、フェーズ別栄養アドバイスと黄体期カロリー+200kcal調整が有効になります。</p>
          )}
        </div>
      )}

      {/* 服薬・薬の情報 */}
      <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">💊</span>
          <div>
            <h2 className="font-bold text-gray-800">服薬情報</h2>
            <p className="text-xs text-gray-400">薬と栄養の相互作用を考慮した摂取アドバイスを表示</p>
          </div>
        </div>
        <div className="space-y-2">
          {MEDICATION_DEFS.map(med => {
            const isSelected = medications.includes(med.key);
            return (
              <button key={med.key}
                onClick={() => setMedications(prev =>
                  isSelected ? prev.filter(k => k !== med.key) : [...prev, med.key]
                )}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ${
                  isSelected ? 'bg-orange-50 border-orange-300' : 'border-gray-100 hover:bg-gray-50'
                }`}>
                <span className="text-lg flex-shrink-0">{med.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isSelected ? 'text-orange-700' : 'text-gray-700'}`}>{med.label}</p>
                  <p className="text-xs text-gray-400">{med.category}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  isSelected ? 'border-orange-400 bg-orange-400' : 'border-gray-300'
                }`}>
                  {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                </div>
              </button>
            );
          })}
        </div>
        {medications.length > 0 && (
          <p className="text-xs text-orange-600 bg-orange-50 rounded-xl px-3 py-2 mt-3">
            💊 {medications.length}種の薬を登録中。ホーム画面で栄養への影響を確認できます。
          </p>
        )}
        <p className="text-xs text-gray-400 mt-3">※ このアプリの情報は一般的な参考情報です。服薬中の食事管理は必ず医師・薬剤師に相談してください。</p>
      </div>

      {/* Apple Watch連携 */}
      <div className="bg-gray-900 rounded-2xl p-6 mb-4 text-white">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">⌚</span>
          <div>
            <h2 className="font-bold">消費カロリーの計測</h2>
            <p className="text-xs text-gray-400">Apple Watchの有無で計算方法が変わります</p>
          </div>
        </div>

        {/* Apple Watch有無の確認 */}
        <p className="text-xs text-gray-400 mb-2">Apple Watchをお持ちですか？</p>
        <div className="flex gap-2 mb-4">
          {([
            [true,  '⌚ 持っている'],
            [false, '📱 持っていない'],
          ] as const).map(([v, l]) => (
            <button key={String(v)} onClick={() => setHasAppleWatch(v)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${hasAppleWatch === v ? (v ? 'bg-blue-600 text-white' : 'bg-gray-600 text-white') : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {l}
            </button>
          ))}
        </div>

        {/* Apple Watchなし → TDEEモード説明 */}
        {hasAppleWatch === false && (
          <div className="bg-gray-800 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-green-400">✓ TDEE推定モードで管理します</p>
            <p className="text-xs text-gray-400">
              Apple Watchがなくても大丈夫です。「活動量」の設定から1日の消費カロリーを自動推定（TDEE）し、目標摂取カロリーを計算します。
            </p>
            <div className="bg-gray-700 rounded-xl p-3 text-xs text-gray-300 space-y-1.5">
              <p className="font-semibold text-white mb-1">TDEEモードで正確に管理するコツ</p>
              <p>• 活動量を正直に設定する（過大評価しがち）</p>
              <p>• 体重の増減を週1回記録して活動量を微調整する</p>
              <p>• 運動した日は食事タブから「運動記録」で追加消費を記録できる</p>
            </div>
            <p className="text-xs text-gray-500">体重が目標通りに変化しない場合は、活動量レベルを1段階下げて試してみてください。</p>
          </div>
        )}

        {/* Apple Watchあり → 連携方法 */}
        {hasAppleWatch === true && (
          <>
            <div className="bg-gray-800 rounded-xl p-3 mb-3">
              <p className="text-xs text-blue-300 font-semibold mb-2">⚡ Shortcutsで自動連携する方法</p>
              <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                <li>iPhoneの「ショートカット」アプリを開く</li>
                <li>新規ショートカットを作成</li>
                <li>「ヘルスケア」→「ヘルスケアサンプルを検索」を追加
                  <br/><span className="ml-4 text-gray-500">種類: アクティブエネルギー消費量</span></li>
                <li>同様に「安静時エネルギー」も取得</li>
                <li>「計算」で2つを合計</li>
                <li>「URLを開く」を追加:
                  <br/><span className="ml-4 text-blue-400 break-all">https://calorie-web-theta.vercel.app/api/apple-watch?calories=[合計値]</span></li>
              </ol>
              <p className="text-xs text-gray-500 mt-2">★ オートメーションで毎朝自動実行すると便利です</p>
            </div>
            <p className="text-xs text-gray-400 mb-2">手動入力（今日の合計消費カロリー）</p>
            <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-4">
              <input className="flex-1 py-3 text-xl font-bold bg-transparent focus:outline-none text-white placeholder-gray-600"
                type="number" placeholder="2500" value={appleWatch} onChange={e => setAppleWatch(e.target.value)} />
              <span className="text-gray-400 text-sm">kcal/日</span>
            </div>
            {appleWatch && parseFloat(appleWatch) > 0 && (
              <p className="text-xs text-green-400 mt-2">✓ Apple Watch実測値を使用します（TDEE推定値より優先）</p>
            )}
          </>
        )}

        {/* 未選択 */}
        {hasAppleWatch === undefined && (
          <p className="text-xs text-gray-500 text-center py-2">上のボタンで選択してください</p>
        )}
      </div>

      {/* 計算プレビュー */}
      {bmr && tdee && ti && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-4">
          <p className="text-sm font-bold text-blue-700 mb-3">計算結果プレビュー</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-bold text-gray-900">{bmr.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-0.5">基礎代謝 kcal</p>
              <p className="text-xs text-blue-500">{preview?.manualBMR ? '体組成計実測' : preview?.bodyFatPercent ? 'Katch-McArdle' : 'Mifflin式'}</p>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{tdee.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-0.5">消費 kcal</p>
              <p className="text-xs text-blue-500">{preview?.appleWatchCalories ? '⌚ 実測値' : 'TDEE推定'}</p>
            </div>
            <div>
              <p className="text-xl font-bold text-blue-600">{ti.targetCalories.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-0.5">目標摂取 kcal</p>
              {ti.daysLeft && <p className="text-xs text-blue-500">週{ti.weeklyChange > 0 ? '+' : ''}{ti.weeklyChange.toFixed(2)}kg</p>}
            </div>
          </div>
          {ti.isGoalMismatch && <p className="text-xs text-red-700 bg-red-50 rounded-lg p-2 mt-3">⚠️ 目標体重と目標の種類が一致していません。減量なら目標体重を現在の体重より低く設定してください。</p>}
          {ti.isMinCal && <p className="text-xs text-orange-700 bg-orange-50 rounded-lg p-2 mt-3">⚠️ 計算結果が最低カロリー下限（{preview?.goalPurpose === 'beauty' ? '1,400' : preview?.gender === 'female' ? '1,200' : '1,500'}kcal）を下回るため、下限値を適用しています。目標日を延長してください。</p>}
          {ti.isUnsafe && !ti.isMinCal && <p className="text-xs text-yellow-700 bg-yellow-50 rounded-lg p-2 mt-3">⚠️ ペースが速すぎます（{preview?.goalPurpose === 'beauty' ? '週0.5kg超' : '週1kg超'}）。{preview?.goalPurpose === 'beauty' ? '週0.5kg' : '週1kg'}に制限して計算しています。目標日を延長してください。</p>}
        </div>
      )}

      <button onClick={handleSave} disabled={!preview}
        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 transition disabled:opacity-50">
        {saved ? '✓ 保存しました' : '保存する'}
      </button>

      {/* デバイス同期 */}
      <div className="bg-white rounded-2xl p-6 mt-4 shadow-sm">
        <h2 className="font-bold text-gray-800 mb-1">デバイス同期</h2>
        <p className="text-xs text-gray-400 mb-4">同じ同期コードを複数デバイスで使うとデータが共有されます。Apple Watchショートカットにも使用します。</p>
        <div className="flex gap-2 mb-2">
          <input
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="同期コード（例: naoya123）"
            value={syncInput}
            onChange={e => setSyncInput(e.target.value)}
          />
          <button onClick={handleSyncSave} className="bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">保存</button>
          <button onClick={handleSyncLoad} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-xl text-sm font-semibold hover:bg-gray-200">読込</button>
        </div>
        {syncCode && <p className="text-xs text-blue-600">現在の同期コード: <strong>{syncCode}</strong></p>}
        {syncMsg && <p className="text-xs text-green-600 mt-1">{syncMsg}</p>}
        {syncCode && (
          <div className="mt-3 bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 font-semibold mb-1">Apple Watch Shortcutsの最終URLに使うアドレス:</p>
            <p className="text-xs text-blue-600 break-all">https://calorie-web-theta.vercel.app/api/apple-watch?calories=[合計]&code={syncCode}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">読み込み中...</div>}>
      <ProfileContent />
    </Suspense>
  );
}
