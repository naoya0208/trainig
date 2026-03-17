'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Profile, ActivityLevel, GoalType, calcBMR, calcTDEE, calcTargetCalories, calcBMI, getBMIStatus, calcIdealWeight } from '@/lib/calc';

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
  const [bodyFat, setBodyFat] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>(1.55);
  const [goalType, setGoalType] = useState<GoalType>('lose');
  const [targetDate, setTargetDate] = useState('');
  const [appleWatch, setAppleWatch] = useState('');
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
      setBodyFat(profile.bodyFatPercent?.toString() ?? '');
      setActivity(profile.activityLevel);
      setGoalType(profile.goalType);
      setTargetDate(profile.targetDate ?? '');
      setAppleWatch(profile.appleWatchCalories?.toString() ?? '');
    }
  }, [profile]);

  const preview: Profile | null = (() => {
    const a = parseInt(age), h = parseFloat(height), w = parseFloat(weight), t = parseFloat(targetWeight);
    if (isNaN(a) || isNaN(h) || isNaN(w) || isNaN(t)) return null;
    return { gender, age: a, height: h, weight: w, targetWeight: t,
      bodyFatPercent: parseFloat(bodyFat) || undefined,
      activityLevel: activity, goalType,
      targetDate: targetDate || undefined,
      appleWatchCalories: parseFloat(appleWatch) || undefined,
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
            { label: '目標体重', val: targetWeight, set: setTargetWeight, ph: '65.0', unit: 'kg' },
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
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-600 block mb-1">
            体脂肪率 <span className="font-normal text-gray-400 text-xs">（任意 — より精度の高いBMR計算に使用）</span>
          </label>
          <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 px-3 max-w-40">
            <input className="flex-1 py-2.5 text-lg font-bold bg-transparent focus:outline-none"
              type="number" placeholder="20.0" value={bodyFat} onChange={e => setBodyFat(e.target.value)} />
            <span className="text-sm text-gray-400">%</span>
          </div>
        </div>
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
        <label className="text-sm font-semibold text-gray-600 block mb-2">目標の種類</label>
        <div className="flex gap-2 mb-4">
          {([['lose','減量'],['maintain','維持'],['gain','増量']] as const).map(([v,l]) => (
            <button key={v} onClick={() => setGoalType(v)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${goalType === v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {l}
            </button>
          ))}
        </div>
        {goalType !== 'maintain' && (
          <div>
            <label className="text-sm font-semibold text-gray-600 block mb-2">目標達成日</label>
            <input type="date" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              min={new Date().toISOString().split('T')[0]}
              value={targetDate} onChange={e => setTargetDate(e.target.value)} />
          </div>
        )}
      </div>

      {/* Apple Watch連携 */}
      <div className="bg-gray-900 rounded-2xl p-6 mb-4 text-white">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">⌚</span>
          <div>
            <h2 className="font-bold">Apple Watch 連携</h2>
            <p className="text-xs text-gray-400">Shortcutで自動連携 または 手動入力</p>
          </div>
        </div>

        {/* 自動連携説明 */}
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
      </div>

      {/* 計算プレビュー */}
      {bmr && tdee && ti && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-4">
          <p className="text-sm font-bold text-blue-700 mb-3">計算結果プレビュー</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-bold text-gray-900">{bmr.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-0.5">基礎代謝 kcal</p>
              <p className="text-xs text-blue-500">{preview?.bodyFatPercent ? 'Katch-McArdle' : 'Mifflin式'}</p>
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
          {ti.isUnsafe && <p className="text-xs text-yellow-700 bg-yellow-50 rounded-lg p-2 mt-3">⚠️ ペースが速すぎます。目標日を延長してください。</p>}
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
