'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { calcBMR, calcTDEE, calcTargetCalories, calcBMI, getBMIStatus, calcCalorieLimits, calcNutritionTargets, getMenstrualPhase } from '@/lib/calc';
import { getActiveMicroDefs, sumMicros } from '@/lib/micros';

import { localDate } from '@/lib/date';
function getToday() { return localDate(); }

export default function Home() {
  const { profile, foodEntries, workoutSessions, savedFoods, saveFoodToHistory, hydrate, setProfile, waterEntries, addWater } = useStore();
  const [today, setToday] = useState(getToday);
  const [advice, setAdvice] = useState<{ status: string; message: string; tips: string[] } | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [nutritionAdvice, setNutritionAdvice] = useState<{ deficiencies: any[]; timing: any[]; overall: string } | null>(null);
  const [loadingNutrition, setLoadingNutrition] = useState(false);

  useEffect(() => {
    hydrate();
    // 1分ごとに日付チェック → 0時を跨いだら自動更新
    const timer = setInterval(() => {
      setToday(prev => {
        const now = getToday();
        return prev !== now ? now : prev;
      });
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // 日付が変わったらApple Watchカロリーを0にリセット
  useEffect(() => {
    if (profile?.appleWatchCalories && profile.appleWatchCalories > 0) {
      setProfile({ ...profile, appleWatchCalories: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🏋️</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">CalTrack へようこそ</h1>
          <p className="text-gray-500 mb-8">AIを使った食事・運動・体重管理アプリです。まずプロフィールを設定してください。</p>
          <Link href="/profile" className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition">
            プロフィールを設定する →
          </Link>
        </div>
      </div>
    );
  }

  const bmr = calcBMR(profile);
  const tdee = calcTDEE(profile);
  const { targetCalories, weeklyChange, daysLeft, isUnsafe } = calcTargetCalories(profile);
  const bmi = calcBMI(profile.weight, profile.height);
  const bmiStatus = getBMIStatus(bmi);
  const appleWatchActive = profile.appleWatchCalories && profile.appleWatchCalories > 0;
  const limits = calcCalorieLimits(profile);
  const nutritionTargets = calcNutritionTargets(profile);

  const todayFood = foodEntries.filter(e => e.date === today);
  const todayWork = workoutSessions.filter(s => s.date === today);
  const todayWaterMl = waterEntries.find(w => w.date === today)?.ml ?? 0;
  const waterTargetMl = Math.round(profile.weight * 30); // 体重×30ml/日
  const menstrualInfo = profile.gender === 'female' && profile.lastPeriodDate
    ? getMenstrualPhase(profile.lastPeriodDate) : null;
  const consumed = todayFood.reduce((s, e) => s + e.calories, 0);
  const burned = appleWatchActive ? 0 : todayWork.reduce((s, w) => s + w.burnedCalories, 0);
  const MICRO_DEFS = getActiveMicroDefs(profile.goalPurpose, profile.gender);
  const net = consumed - burned;
  const remaining = Math.max(0, targetCalories - net);
  const pct = Math.min(100, Math.round((net / targetCalories) * 100));
  const barColor = pct > 100 ? 'bg-red-500' : pct > 85 ? 'bg-yellow-500' : 'bg-green-500';
  const protein = todayFood.reduce((s, e) => s + e.protein, 0);
  const fat = todayFood.reduce((s, e) => s + e.fat, 0);
  const carbs = todayFood.reduce((s, e) => s + e.carbs, 0);
  const todayMicros = sumMicros(todayFood);

  // 食事タイミング判定
  const currentHour = new Date().getHours();
  const mealTimingStatus = (() => {
    const hasBreakfast = todayFood.some(e => e.meal === 'breakfast');
    const hasLunch = todayFood.some(e => e.meal === 'lunch');
    const hasDinner = todayFood.some(e => e.meal === 'dinner');
    const slots = [
      { id: 'breakfast', label: '朝食', done: hasBreakfast, ideal: '7〜9時', warning: !hasBreakfast && currentHour >= 10 },
      { id: 'lunch',     label: '昼食', done: hasLunch,     ideal: '12〜13時', warning: !hasLunch && currentHour >= 14 },
      { id: 'dinner',    label: '夕食', done: hasDinner,    ideal: '18〜20時', warning: !hasDinner && currentHour >= 21 },
    ];
    return slots;
  })();

  async function getNutritionAdvice() {
    setLoadingNutrition(true);
    try {
      const currentTime = new Date().toTimeString().slice(0, 5);
      const res = await fetch('/api/gemini/nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: { ...profile, targetCalories },
          targets: nutritionTargets,
          consumed: { calories: consumed, protein, fat, carbs },
          todayEntries: todayFood,
          currentTime,
        }),
      });
      setNutritionAdvice(await res.json());
    } finally { setLoadingNutrition(false); }
  }

  async function getAIAdvice() {
    setLoadingAdvice(true);
    try {
      const res = await fetch('/api/gemini/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'dailyAdvice',
          profile: { ...profile, bmr, tdee, targetCalories, todayConsumed: consumed, todayBurned: burned },
        }),
      });
      setAdvice(await res.json());
    } finally { setLoadingAdvice(false); }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' })}</h1>
          <p className="text-gray-400 text-sm mt-0.5">現在 {profile.weight}kg</p>
        </div>
        <button onClick={getAIAdvice} disabled={loadingAdvice}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
          {loadingAdvice ? '⏳ 分析中...' : '✨ AIアドバイス'}
        </button>
      </div>

      {/* AIアドバイスカード */}
      {advice && (
        <div className={`rounded-2xl p-5 mb-5 border ${advice.status === '良好' ? 'bg-green-50 border-green-200' : advice.status === '注意' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span>{advice.status === '良好' ? '✅' : advice.status === '注意' ? '⚠️' : '🚨'}</span>
            <span className="font-bold">{advice.status}</span>
            <button onClick={() => setAdvice(null)} className="ml-auto text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <p className="text-sm text-gray-700 mb-2">{advice.message}</p>
          <ul className="space-y-1">{advice.tips?.map((t, i) => <li key={i} className="text-sm text-gray-600">• {t}</li>)}</ul>
        </div>
      )}

      {isUnsafe && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 text-sm text-yellow-800">
          {profile.goalPurpose === 'beauty'
            ? '⚠️ ダイエットのペースが速すぎます（週0.5kg超）。肌荒れ・抜け毛を防ぐため、目標日を延長してください。'
            : '⚠️ 設定したペースが速すぎます（週1kg超）。目標日の延長をおすすめします。'}
        </div>
      )}

      {/* 美容モードバナー */}
      {profile.goalPurpose === 'beauty' && (
        <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-2xl p-4 mb-4">
          <p className="text-sm font-bold text-pink-600 mb-2">✨ 美容・スキンケアモード</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            <div className="bg-white/70 rounded-xl px-3 py-2">
              <p className="font-semibold text-pink-500 mb-0.5">脂質目標30%</p>
              <p>脂溶性ビタミンE・Aの吸収↑<br/>肌の水分バリア機能をサポート</p>
            </div>
            <div className="bg-white/70 rounded-xl px-3 py-2">
              <p className="font-semibold text-pink-500 mb-0.5">タンパク質1.2g/kg</p>
              <p>コラーゲン・ケラチン合成<br/>肌・髪・爪の材料</p>
            </div>
            <div className="bg-white/70 rounded-xl px-3 py-2">
              <p className="font-semibold text-pink-500 mb-0.5">食物繊維25g</p>
              <p>腸内環境改善→肌荒れ軽減<br/>（腸肌相関）</p>
            </div>
            <div className="bg-white/70 rounded-xl px-3 py-2">
              <p className="font-semibold text-pink-500 mb-0.5">ビタミンC 200mg</p>
              <p>コラーゲン合成促進<br/>抗酸化・メラニン抑制</p>
            </div>
          </div>
        </div>
      )}

      {/* 月経フェーズバナー（女性かつ設定済み） */}
      {menstrualInfo && (() => {
        const phaseConfig = {
          menstrual:  { bg: 'bg-red-50    border-red-200',    icon: '🔴', color: 'text-red-600'    },
          follicular: { bg: 'bg-green-50  border-green-200',  icon: '🌱', color: 'text-green-600'  },
          ovulation:  { bg: 'bg-yellow-50 border-yellow-200', icon: '⭐', color: 'text-yellow-600' },
          luteal:     { bg: 'bg-purple-50 border-purple-200', icon: '🌙', color: 'text-purple-600' },
        }[menstrualInfo.phase];
        return (
          <div className={`rounded-2xl border p-3 mb-4 flex items-start gap-3 ${phaseConfig.bg}`}>
            <span className="text-xl mt-0.5">{phaseConfig.icon}</span>
            <div className="flex-1">
              <p className={`text-sm font-bold ${phaseConfig.color}`}>{menstrualInfo.label}（第{menstrualInfo.day}日）</p>
              <p className="text-xs text-gray-500 mt-0.5">{menstrualInfo.tips[0]}</p>
              {menstrualInfo.extraCalories > 0 && (
                <p className={`text-xs font-semibold mt-1 ${phaseConfig.color}`}>📈 目標カロリー +{menstrualInfo.extraCalories}kcal（代謝上昇分）</p>
              )}
            </div>
            <Link href="/profile" className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5">設定 →</Link>
          </div>
        );
      })()}

      {/* Apple Watch未設定の場合は設定促し */}
      {profile.hasAppleWatch === undefined && !appleWatchActive && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4 flex items-center gap-3">
          <span className="text-xl">⌚</span>
          <p className="text-xs text-amber-700 flex-1">Apple Watchの有無を設定すると、消費カロリーの管理方法が最適化されます</p>
          <Link href="/profile" className="text-xs text-amber-600 font-semibold hover:text-amber-800 flex-shrink-0">設定 →</Link>
        </div>
      )}

      {/* Apple Watch / TDEE状態バナー */}
      {appleWatchActive ? (
        <div className="bg-gray-900 text-white rounded-2xl p-4 mb-4 flex items-center gap-3">
          <span className="text-2xl">⌚</span>
          <div>
            <p className="text-xs text-gray-400">Apple Watch 実測値を使用中</p>
            <p className="font-bold">{profile.appleWatchCalories?.toLocaleString()} kcal 消費</p>
          </div>
          <Link href="/profile" className="ml-auto text-xs text-gray-400 hover:text-white">更新 →</Link>
        </div>
      ) : profile.hasAppleWatch === false ? (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4 flex items-center gap-3">
          <span className="text-2xl">📊</span>
          <div>
            <p className="text-xs text-blue-500 font-semibold">TDEE推定モードで管理中</p>
            <p className="text-xs text-gray-500 mt-0.5">消費カロリーは活動量から自動推定しています（{tdee.toLocaleString()} kcal/日）</p>
          </div>
          <Link href="/profile" className="ml-auto text-xs text-blue-400 hover:text-blue-600 flex-shrink-0">設定 →</Link>
        </div>
      ) : null}

      {/* カロリーゲージ */}
      <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
        <p className="text-sm text-gray-400 mb-4">今日のカロリー</p>
        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div><p className="text-2xl font-bold">{net.toLocaleString()}</p><p className="text-xs text-gray-400 mt-1">摂取</p></div>
          <div>
            <p className="text-2xl font-bold text-blue-500">
              {appleWatchActive
                ? profile.appleWatchCalories?.toLocaleString()
                : profile.hasAppleWatch === false
                  ? tdee.toLocaleString()
                  : burned.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {appleWatchActive ? '⌚ 総消費' : profile.hasAppleWatch === false ? 'TDEE推定' : '運動消費'}
            </p>
          </div>
          <div><p className="text-2xl font-bold">{targetCalories.toLocaleString()}</p><p className="text-xs text-gray-400 mt-1">目標</p></div>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-center text-sm text-gray-400">残り <strong className="text-gray-800">{remaining.toLocaleString()} kcal</strong></p>

        {/* カロリー限度 */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-2">
            {profile.goalType === 'lose' ? '減量' : profile.goalType === 'gain' ? '増量' : '維持'}のカロリー範囲
          </p>
          <div className="flex items-center gap-2">
            <div className={`flex-1 text-center rounded-xl py-2 px-2 ${consumed < limits.min ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
              <p className={`text-sm font-bold ${consumed < limits.min ? 'text-red-500' : 'text-gray-500'}`}>{limits.min.toLocaleString()}</p>
              <p className="text-xs text-gray-400">{limits.minLabel.split(' ')[0]}</p>
              <p className="text-xs text-gray-300">{limits.minLabel.split(' ')[1]}</p>
              {consumed < limits.min && <p className="text-xs text-red-400">⚠️ 不足</p>}
            </div>
            <div className="flex-1 text-center bg-blue-50 rounded-xl py-2 px-2 border border-blue-200">
              <p className="text-sm font-bold text-blue-600">{limits.target.toLocaleString()}</p>
              <p className="text-xs text-gray-400">推奨摂取</p>
              <p className="text-xs text-blue-300">目標値</p>
            </div>
            <div className={`flex-1 text-center rounded-xl py-2 px-2 ${consumed > limits.max ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
              <p className={`text-sm font-bold ${consumed > limits.max ? 'text-red-500' : 'text-gray-500'}`}>{limits.max.toLocaleString()}</p>
              <p className="text-xs text-gray-400">{limits.maxLabel.split(' ')[0]}</p>
              <p className="text-xs text-gray-300">{limits.maxLabel.split(' ')[1]}</p>
              {consumed > limits.max && <p className="text-xs text-red-400">⚠️ 超過</p>}
            </div>
          </div>
        </div>
      </div>

      {/* BMR・TDEE・BMI */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: '基礎代謝', val: bmr.toLocaleString(), unit: 'kcal', sub: profile.manualBMR ? '体組成計実測' : profile.bodyFatPercent ? 'Katch-McArdle' : 'Mifflin式', cls: 'text-gray-900' },
          { label: '総消費', val: tdee.toLocaleString(), unit: 'kcal', sub: appleWatchActive ? '⌚ 実測値' : profile.hasAppleWatch === false ? '📊 TDEE推定' : 'TDEE推定値', cls: 'text-gray-900' },
          { label: 'BMI', val: String(bmi), unit: '', sub: bmiStatus.label, cls: bmiStatus.color },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <p className={`text-xl font-bold ${item.cls}`}>{item.val}<span className="text-xs font-normal text-gray-400 ml-0.5">{item.unit}</span></p>
            <p className="text-xs text-gray-400 mt-1">{item.label}</p>
            <p className={`text-xs mt-0.5 ${item.cls}`}>{item.sub}</p>
          </div>
        ))}
      </div>

      {/* 目標 */}
      {daysLeft !== null && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4 text-sm text-blue-800">
          🎯 目標体重 <strong>{profile.targetWeight}kg</strong> まであと <strong>{daysLeft}日</strong>（週{weeklyChange > 0 ? '+' : ''}{weeklyChange.toFixed(2)}kg）
        </div>
      )}

      {/* PFC + 栄養分析 */}
      <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm font-semibold text-gray-500">栄養バランス</p>
          <button onClick={getNutritionAdvice} disabled={loadingNutrition}
            className="bg-gradient-to-r from-green-500 to-blue-500 text-white text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50">
            {loadingNutrition ? '⏳' : '🔍 AI栄養分析'}
          </button>
        </div>
        <div className="space-y-3">
          {[
            { label: 'P タンパク質', val: protein, target: nutritionTargets.protein, max: nutritionTargets.proteinMax, dot: 'bg-blue-500', bar: 'bg-blue-400' },
            { label: 'F 脂質', val: fat, target: nutritionTargets.fat, max: nutritionTargets.fatMax, dot: 'bg-yellow-500', bar: 'bg-yellow-400' },
            { label: 'C 炭水化物', val: carbs, target: nutritionTargets.carbs, max: nutritionTargets.carbsMax, dot: 'bg-green-500', bar: 'bg-green-400' },
          ].map(item => {
            const overMax = item.val > item.max;
            const overTarget = item.val > item.target;
            const pct = Math.min(100, Math.round((item.val / item.max) * 100));
            const targetPct = Math.min(100, Math.round((item.target / item.max) * 100));
            return (
              <div key={item.label}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.dot}`} />
                  <span className="text-sm text-gray-600 flex-1">{item.label}</span>
                  <span className={`text-sm font-semibold ${overMax ? 'text-red-500' : overTarget ? 'text-orange-400' : ''}`}>
                    {item.val.toFixed(1)}g
                  </span>
                  <span className="text-xs text-gray-400">目標{item.target}g</span>
                  <span className="text-xs text-red-300">上限{item.max}g</span>
                </div>
                {/* バー: 上限を100%として表示、目標位置にマーカー */}
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden ml-5 relative">
                  <div className={`h-full rounded-full transition-all ${overMax ? 'bg-red-400' : overTarget ? 'bg-orange-400' : item.bar}`}
                    style={{ width: `${pct}%` }} />
                  {/* 目標位置マーカー */}
                  <div className="absolute top-0 h-full w-0.5 bg-gray-400 opacity-60"
                    style={{ left: `${targetPct}%` }} />
                </div>
                {overMax && <p className="text-xs text-red-500 ml-5 mt-0.5">⚠️ 上限超過</p>}
              </div>
            );
          })}
          <p className="text-xs text-gray-300 mt-1">バーの縦線 = 推奨目標 / バー右端 = 上限</p>

          {/* 美容バランス */}
          {(() => {
            const isBeauty = profile.goalPurpose === 'beauty';
            const TOP3 = [
              { key: 'vitaminC' as const, label: 'ビタミンC', unit: 'mg', target: isBeauty ? 200 : 100, dot: 'bg-orange-400', bar: 'bg-orange-400' },
              { key: 'omega3'   as const, label: 'EPA+DHA',   unit: 'g',  target: 2.0,                   dot: 'bg-blue-400',   bar: 'bg-blue-400'   },
              { key: 'zinc'     as const, label: '亜鉛',      unit: 'mg', target: 10,                    dot: 'bg-teal-400',   bar: 'bg-teal-400'   },
            ];
            const SUB4 = [
              { key: 'niacin'   as const, label: 'ナイアシン', unit: 'mg', target: 13  },
              { key: 'vitaminA' as const, label: 'ビタミンA',  unit: 'μg', target: 700 },
              { key: 'vitaminE' as const, label: 'ビタミンE',  unit: 'mg', target: 6   },
              { key: 'biotin'   as const, label: 'ビオチン',   unit: 'μg', target: 50  },
            ];
            return (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-semibold text-gray-400">美容バランス</p>
                  {isBeauty && <span className="text-xs bg-pink-100 text-pink-500 px-1.5 py-0.5 rounded-full font-semibold">美容モード</span>}
                </div>
                {/* Top3 バー */}
                <div className="space-y-2 mb-3">
                  {TOP3.map(item => {
                    const v = (todayMicros[item.key] as number) ?? 0;
                    const pct = Math.min(100, Math.round(v / item.target * 100));
                    const ok = v >= item.target * 0.8;
                    return (
                      <div key={item.key}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.dot}`} />
                          <span className="text-sm text-gray-600 flex-1">{item.label}</span>
                          <span className={`text-sm font-semibold ${ok ? 'text-gray-700' : v > 0 ? 'text-orange-400' : 'text-gray-300'}`}>{v}{item.unit}</span>
                          <span className="text-xs text-gray-400">目標{item.target}{item.unit}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden ml-5">
                          <div className={`h-full rounded-full transition-all ${ok ? item.bar : v > 0 ? 'bg-orange-400' : 'bg-gray-200'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Sub4 囲みグリッド */}
                <div className="bg-pink-50/60 border border-pink-100 rounded-xl p-3">
                  <div className="grid grid-cols-4 gap-2">
                    {SUB4.map(item => {
                      const v = (todayMicros[item.key] as number) ?? 0;
                      const pct = Math.min(100, Math.round(v / item.target * 100));
                      const ok = v >= item.target * 0.8;
                      return (
                        <div key={item.key} className="bg-white rounded-xl px-2 py-2 text-center shadow-sm">
                          <p className="text-xs text-gray-400 truncate mb-0.5">{item.label}</p>
                          <p className={`text-sm font-bold ${ok ? 'text-pink-500' : v > 0 ? 'text-orange-400' : 'text-gray-300'}`}>
                            {v}<span className="text-xs font-normal">{item.unit}</span>
                          </p>
                          <div className="h-1 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                            <div className={`h-full rounded-full ${ok ? 'bg-pink-400' : v > 0 ? 'bg-orange-300' : 'bg-gray-200'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-gray-300 mt-0.5">{item.target}{item.unit}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 微量栄養素（美容バランスに表示済みのものを除外） */}
          {(() => {
            const BEAUTY_BALANCE_KEYS = new Set(['vitaminC', 'omega3', 'zinc', 'niacin', 'vitaminA', 'vitaminE', 'biotin']);
            const filteredMicroDefs = MICRO_DEFS.filter(d => !BEAUTY_BALANCE_KEYS.has(d.key));
            if (filteredMicroDefs.length === 0) return null;
            return (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 mb-2">微量栄養素</p>
            <div className="grid grid-cols-3 gap-1.5">
              {filteredMicroDefs.map(d => {
                const v = (todayMicros[d.key] as number) ?? 0;
                const pct = d.isLimit
                  ? Math.min(100, Math.round(v / d.target * 100))
                  : Math.min(100, Math.round(v / d.target * 100));
                const ok = d.isLimit ? v <= d.target : v >= d.target * 0.8;
                const color = d.isLimit
                  ? (v > d.target ? 'bg-red-50 border-red-200 text-red-600' : 'bg-gray-50 border-gray-100 text-gray-600')
                  : (ok ? 'bg-green-50 border-green-100 text-green-700' : v > 0 ? 'bg-orange-50 border-orange-100 text-orange-600' : 'bg-gray-50 border-gray-100 text-gray-400');
                return (
                  <div key={d.key} className={`rounded-xl border px-2 py-1.5 ${color}`}>
                    <p className="text-xs font-semibold truncate">{d.label}</p>
                    <p className="text-sm font-bold">{v}<span className="text-xs font-normal ml-0.5">{d.unit}</span></p>
                    <div className="h-1 bg-white/60 rounded-full mt-1 overflow-hidden">
                      <div className={`h-full rounded-full ${ok ? 'bg-green-400' : v > 0 ? 'bg-orange-400' : 'bg-gray-200'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs opacity-60 mt-0.5">{d.isLimit ? '上限' : '目標'}{d.target}{d.unit}</p>
                  </div>
                );
              })}
            </div>
          </div>
            );
          })()}
        </div>

        {/* AI栄養分析結果 */}
        {nutritionAdvice && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-bold text-green-600">🔍 AI栄養分析</p>
              <button onClick={() => setNutritionAdvice(null)} className="text-gray-300 hover:text-gray-500">✕</button>
            </div>
            <p className="text-sm text-gray-700 mb-3">{nutritionAdvice.overall}</p>

            {/* 不足栄養素 */}
            {nutritionAdvice.deficiencies?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">不足している栄養素</p>
                <div className="space-y-2">
                  {nutritionAdvice.deficiencies.map((d: any, i: number) => (
                    <div key={i} className={`rounded-lg p-2 text-xs ${d.severity === 'high' ? 'bg-red-50' : d.severity === 'medium' ? 'bg-yellow-50' : 'bg-gray-50'}`}>
                      <span className={`font-semibold ${d.severity === 'high' ? 'text-red-600' : d.severity === 'medium' ? 'text-yellow-600' : 'text-gray-600'}`}>
                        {d.severity === 'high' ? '🔴' : d.severity === 'medium' ? '🟡' : '🟢'} {d.nutrient}（残り{d.remaining}）
                      </span>
                      <p className="text-gray-600 mt-0.5">{d.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 摂取タイミング */}
            {nutritionAdvice.timing?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">推奨摂取タイミング</p>
                <div className="space-y-3">
                  {nutritionAdvice.timing.map((t: any, i: number) => (
                    <div key={i} className="bg-blue-50 rounded-xl p-3 text-xs">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full">{t.time}</span>
                        <span className="font-semibold text-blue-800">{t.meal}</span>
                      </div>
                      {/* 必要な栄養素 */}
                      {t.nutrients?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {t.nutrients.map((n: any, j: number) => (
                            <div key={j} className="bg-white rounded-lg px-2 py-1 border border-blue-200">
                              <span className="font-bold text-blue-700">{n.name} {n.amount}</span>
                              <p className="text-gray-400 mt-0.5">{n.reason}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-gray-700 font-medium mb-1">▶ {t.suggestion}</p>
                      {t.effect && <p className="text-gray-400">{t.effect}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 食事タイミング */}
      <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-500 mb-3">食事タイミング</p>
        <div className="flex gap-2">
          {mealTimingStatus.map(slot => (
            <div key={slot.id} className={`flex-1 rounded-xl px-2 py-2.5 text-center border ${slot.done ? 'bg-green-50 border-green-200' : slot.warning ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
              <p className="text-lg leading-none mb-1">{slot.done ? '✅' : slot.warning ? '⚠️' : '○'}</p>
              <p className={`text-xs font-semibold ${slot.done ? 'text-green-600' : slot.warning ? 'text-red-500' : 'text-gray-400'}`}>{slot.label}</p>
              <p className="text-xs text-gray-300 mt-0.5">{slot.ideal}</p>
            </div>
          ))}
        </div>
        {mealTimingStatus.some(s => s.warning) && (
          <p className="text-xs text-red-400 mt-2">⚠️ 朝食スキップはコルチゾール上昇→食欲増加の原因になります</p>
        )}
      </div>

      {/* 水分摂取トラッカー */}
      <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-500">水分摂取</p>
            <p className="text-xs text-gray-400 mt-0.5">目標：{(waterTargetMl / 1000).toFixed(1)}L（体重×30ml）</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-500">{todayWaterMl >= 1000 ? `${(todayWaterMl / 1000).toFixed(1)}L` : `${todayWaterMl}ml`}</p>
            <p className="text-xs text-gray-400">{Math.min(100, Math.round(todayWaterMl / waterTargetMl * 100))}%</p>
          </div>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div className="h-full rounded-full bg-blue-400 transition-all duration-500"
            style={{ width: `${Math.min(100, Math.round(todayWaterMl / waterTargetMl * 100))}%` }} />
        </div>
        <div className="flex gap-2">
          {[200, 350, 500].map(ml => (
            <button key={ml} onClick={() => addWater(today, ml)}
              className="flex-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl py-2 text-sm font-semibold text-blue-600 transition">
              +{ml}ml
            </button>
          ))}
          <button onClick={() => addWater(today, -Math.min(200, todayWaterMl))}
            disabled={todayWaterMl === 0}
            className="px-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl py-2 text-sm font-semibold text-gray-400 transition disabled:opacity-30">
            −
          </button>
        </div>
        {todayWaterMl >= waterTargetMl && (
          <p className="text-xs text-blue-500 mt-2 text-center">💧 今日の水分目標達成！肌のうるおいをサポート</p>
        )}
      </div>

      {/* 今日の食事ログ */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm font-semibold text-gray-500">今日の食事</p>
          <Link href="/food" className="text-blue-600 text-sm font-semibold">+ 追加</Link>
        </div>
        {todayFood.length === 0 ? <p className="text-sm text-gray-300 text-center py-4">まだ記録がありません</p>
          : todayFood.slice(-3).map(e => {
            const isFav = savedFoods.some(f => f.foodName === e.foodName && f.isFavorite);
            return (
              <div key={e.id} className="flex items-center justify-between py-1.5 text-sm border-b border-gray-50 last:border-0">
                <span className="text-gray-600 truncate flex-1">{e.foodName}（{e.grams}g）</span>
                <span className="font-semibold ml-2">{e.calories}kcal</span>
                <button
                  onClick={() => saveFoodToHistory({
                    id: e.id, foodName: e.foodName, grams: e.grams,
                    per100g: {
                      calories: e.grams > 0 ? Math.round(e.calories / e.grams * 100) : 0,
                      protein: e.grams > 0 ? parseFloat((e.protein / e.grams * 100).toFixed(1)) : 0,
                      fat: e.grams > 0 ? parseFloat((e.fat / e.grams * 100).toFixed(1)) : 0,
                      carbs: e.grams > 0 ? parseFloat((e.carbs / e.grams * 100).toFixed(1)) : 0,
                    },
                    isFavorite: true, lastUsed: e.date, useCount: 1,
                  })}
                  className="ml-2 text-lg leading-none hover:scale-110 transition-transform"
                >{isFav ? '★' : '☆'}</button>
              </div>
            );
          })}
      </div>
    </div>
  );
}
