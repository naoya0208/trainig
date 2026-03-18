'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { calcBMR, calcTDEE, calcTargetCalories, calcBMI, getBMIStatus, calcCalorieLimits, calcNutritionTargets } from '@/lib/calc';

const TODAY = new Date().toISOString().split('T')[0];

export default function Home() {
  const { profile, foodEntries, workoutSessions, hydrate } = useStore();
  const [advice, setAdvice] = useState<{ status: string; message: string; tips: string[] } | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [nutritionAdvice, setNutritionAdvice] = useState<{ deficiencies: any[]; timing: any[]; overall: string } | null>(null);
  const [loadingNutrition, setLoadingNutrition] = useState(false);

  useEffect(() => { hydrate(); }, []);

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

  const todayFood = foodEntries.filter(e => e.date === TODAY);
  const todayWork = workoutSessions.filter(s => s.date === TODAY);
  const consumed = todayFood.reduce((s, e) => s + e.calories, 0);
  // Apple Watch使用中は筋トレカロリーをTDEEに含むためダブルカウントしない
  const burned = appleWatchActive ? 0 : todayWork.reduce((s, w) => s + w.burnedCalories, 0);
  const net = consumed - burned;
  const remaining = Math.max(0, targetCalories - net);
  const pct = Math.min(100, Math.round((net / targetCalories) * 100));
  const barColor = pct > 100 ? 'bg-red-500' : pct > 85 ? 'bg-yellow-500' : 'bg-green-500';
  const protein = todayFood.reduce((s, e) => s + e.protein, 0);
  const fat = todayFood.reduce((s, e) => s + e.fat, 0);
  const carbs = todayFood.reduce((s, e) => s + e.carbs, 0);

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
          ⚠️ 設定したペースが速すぎます。目標日の延長をおすすめします。
        </div>
      )}

      {/* Apple Watch */}
      {appleWatchActive && (
        <div className="bg-gray-900 text-white rounded-2xl p-4 mb-4 flex items-center gap-3">
          <span className="text-2xl">⌚</span>
          <div>
            <p className="text-xs text-gray-400">Apple Watch 実測値を使用中</p>
            <p className="font-bold">{profile.appleWatchCalories?.toLocaleString()} kcal 消費</p>
          </div>
          <Link href="/profile" className="ml-auto text-xs text-gray-400 hover:text-white">更新 →</Link>
        </div>
      )}

      {/* カロリーゲージ */}
      <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
        <p className="text-sm text-gray-400 mb-4">今日のカロリー</p>
        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div><p className="text-2xl font-bold">{net.toLocaleString()}</p><p className="text-xs text-gray-400 mt-1">摂取</p></div>
          <div>
            <p className="text-2xl font-bold text-blue-500">
              {appleWatchActive ? profile.appleWatchCalories?.toLocaleString() : burned.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-1">{appleWatchActive ? '⌚ 総消費' : '運動消費'}</p>
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
          { label: '基礎代謝', val: bmr.toLocaleString(), unit: 'kcal', sub: profile.bodyFatPercent ? 'Katch-McArdle' : 'Mifflin式', cls: 'text-gray-900' },
          { label: '総消費', val: tdee.toLocaleString(), unit: 'kcal', sub: appleWatchActive ? '⌚ 実測値' : 'TDEE推定値', cls: 'text-gray-900' },
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

      {/* 今日のログ */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-semibold text-gray-500">今日の食事</p>
            <Link href="/food" className="text-blue-600 text-sm font-semibold">+ 追加</Link>
          </div>
          {todayFood.length === 0 ? <p className="text-sm text-gray-300 text-center py-4">まだ記録がありません</p>
            : todayFood.slice(-3).map(e => (
              <div key={e.id} className="flex justify-between py-1.5 text-sm border-b border-gray-50 last:border-0">
                <span className="text-gray-600 truncate">{e.foodName}（{e.grams}g）</span>
                <span className="font-semibold ml-2">{e.calories}kcal</span>
              </div>
            ))}
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-semibold text-gray-500">今日のトレーニング</p>
            <Link href="/workout" className="text-blue-600 text-sm font-semibold">+ 追加</Link>
          </div>
          {todayWork.length === 0 ? <p className="text-sm text-gray-300 text-center py-4">まだ記録がありません</p>
            : todayWork.map(w => (
              <div key={w.id} className="flex justify-between py-1.5 text-sm border-b border-gray-50 last:border-0">
                <span className="text-gray-600 truncate">{w.name}（{w.durationMinutes}分）</span>
                <span className="font-semibold text-blue-600 ml-2">−{w.burnedCalories}kcal</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
