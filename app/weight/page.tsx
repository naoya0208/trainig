'use client';
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useStore } from '@/lib/store';
import { calcBMI, getBMIStatus, calcNutritionTargets } from '@/lib/calc';
import { MICRO_DEFS, sumMicros } from '@/lib/micros';

import { localDate } from '@/lib/date';
function getToday() { return localDate(); }

const NUTRIENT_FOODS: Record<string, string[]> = {
  'タンパク質':    ['鶏むね肉', '卵', 'さば', '豆腐', 'ギリシャヨーグルト', 'プロテイン'],
  '脂質':          ['アボカド', 'ナッツ', 'オリーブオイル', 'サーモン'],
  '炭水化物':      ['玄米', 'オートミール', 'さつまいも', 'バナナ'],
  '食物繊維':      ['ブロッコリー', 'きのこ', '玄米', '豆類', 'さつまいも', 'アボカド'],
  'ビタミンD':     ['さば', 'いわし', 'サーモン', '卵黄', 'きのこ（干し）'],
  'ビタミンB12':   ['さば', 'いわし', '貝類', '牛肉', 'チーズ'],
  'EPA+DHA':      ['さば', 'いわし', 'サーモン', 'まぐろ（脂身）', 'さんま'],
  '鉄分':          ['ほうれん草', 'レバー', 'あさり', '牛赤身肉', '枝豆'],
  'カルシウム':    ['牛乳', 'チーズ', 'ヨーグルト', '小魚', '豆腐'],
  'ビタミンC':     ['ブロッコリー', 'ピーマン', 'レモン', 'いちご', 'キウイ'],
  '亜鉛':          ['牡蠣', '牛肉', 'カシューナッツ', '卵', '豆腐'],
  'ナトリウム':    ['味噌汁', '梅干し', '漬物', '塩鮭', 'スポーツドリンク'],
  // 美容栄養素
  'ビタミンE':     ['アーモンド', 'ひまわり油', 'アボカド', 'かぼちゃ', 'うなぎ'],
  'ビタミンA':     ['レバー', 'にんじん', 'ほうれん草', 'かぼちゃ', 'うなぎ'],
  'ビオチン':      ['卵黄', 'レバー', 'くるみ', 'アーモンド', 'さつまいも'],
  'ビタミンB2':    ['レバー', 'うなぎ', '卵', '牛乳', 'アーモンド'],
  'ナイアシン':    ['まぐろ', '鶏むね肉', 'さば', 'レバー', 'ピーナッツ'],
  'パントテン酸':  ['レバー', '鶏むね肉', 'アボカド', '納豆', '卵'],
  'マグネシウム':  ['アーモンド', '豆腐', '納豆', 'ほうれん草', 'バナナ', '玄米'],
  'セレン':        ['まぐろ', 'いわし', '牡蠣', '卵', 'くるみ'],
  'ビタミンK2':    ['納豆', 'チーズ', '鶏もも肉', 'バター', '卵黄'],
  'ビタミンB6':    ['まぐろ', '鶏むね肉', 'バナナ', 'さつまいも', 'ピスタチオ'],
  '葉酸':          ['枝豆', 'ほうれん草', 'ブロッコリー', 'アスパラ', 'レバー'],
};

export default function WeightPage() {
  const { profile, weightEntries, foodEntries, addWeight, setProfile, hydrate } = useStore();
  const [input, setInput] = useState('');
  const [today, setToday] = useState(getToday);
  const [showAllBeautyMicros, setShowAllBeautyMicros] = useState(false);

  useEffect(() => {
    hydrate();
    if (profile) setInput(profile.weight.toString());
    const timer = setInterval(() => {
      const now = getToday();
      setToday(prev => prev !== now ? now : prev);
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  function handleSave() {
    const w = parseFloat(input);
    if (isNaN(w) || w < 20 || w > 300) return;
    addWeight({ date: today, weight: w });
    if (profile) setProfile({ ...profile, weight: w });
  }

  const recent = weightEntries.slice(-30);
  const bmi = profile ? calcBMI(profile.weight, profile.height) : null;
  const bmiStatus = bmi ? getBMIStatus(bmi) : null;
  const diff = profile ? parseFloat((profile.weight - profile.targetWeight).toFixed(1)) : null;
  const nutritionTargets = profile ? calcNutritionTargets(profile) : null;

  // 過去7日間の栄養習慣集計
  const past7 = (() => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days.push(localDate(d));
    }
    return days.map(date => {
      const entries = foodEntries.filter(e => e.date === date);
      return {
        date,
        protein: Math.round(entries.reduce((s, e) => s + e.protein, 0) * 10) / 10,
        fat: Math.round(entries.reduce((s, e) => s + e.fat, 0) * 10) / 10,
        carbs: Math.round(entries.reduce((s, e) => s + e.carbs, 0) * 10) / 10,
        calories: entries.reduce((s, e) => s + e.calories, 0),
        micros: sumMicros(entries),
      };
    });
  })();

  const recordedDays = past7.filter(d => d.calories > 0);
  const avg = recordedDays.length === 0 ? null : {
    protein: Math.round(recordedDays.reduce((s, d) => s + d.protein, 0) / recordedDays.length * 10) / 10,
    fat:     Math.round(recordedDays.reduce((s, d) => s + d.fat,     0) / recordedDays.length * 10) / 10,
    carbs:   Math.round(recordedDays.reduce((s, d) => s + d.carbs,   0) / recordedDays.length * 10) / 10,
    micros: (() => {
      const result: Record<string, number> = {};
      MICRO_DEFS.forEach(d => {
        result[d.key] = Math.round(recordedDays.reduce((s, day) => s + ((day.micros[d.key] as number) ?? 0), 0) / recordedDays.length * 10) / 10;
      });
      return result;
    })(),
  };

  const isBeautyMode = profile?.goalPurpose === 'beauty';

  // 不足栄養素（PFCとmicros両方チェック）- 美容モード以外は基本栄養素のみ
  const deficient: { label: string; foods: string[] }[] = [];
  if (avg && nutritionTargets) {
    if (avg.protein < nutritionTargets.protein * 0.8) deficient.push({ label: 'タンパク質', foods: NUTRIENT_FOODS['タンパク質'] });
    MICRO_DEFS.filter(d => !d.isLimit && (!d.purpose || (isBeautyMode && d.purpose === 'beauty'))).forEach(d => {
      const v = avg.micros[d.key] ?? 0;
      if (v < d.target * 0.8) {
        const foods = NUTRIENT_FOODS[d.label] ?? [];
        deficient.push({ label: d.label, foods });
      }
    });
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-5">体重管理</h1>

      {/* 入力 */}
      <div className="bg-white rounded-2xl p-6 mb-5 shadow-sm">
        <p className="text-sm text-gray-400 mb-3">今日の体重</p>
        <div className="flex items-end gap-3 mb-5">
          <input className="text-5xl font-bold text-gray-900 w-40 border-b-2 border-blue-500 focus:outline-none bg-transparent pb-1"
            type="number" step="0.1" value={input} onChange={e => setInput(e.target.value)} placeholder="00.0" />
          <span className="text-xl text-gray-400 pb-2">kg</span>
        </div>
        <button onClick={handleSave} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition">記録する</button>
      </div>

      {/* ステータス */}
      {profile && bmi && bmiStatus && diff !== null && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <p className={`text-xl font-bold ${bmiStatus.color}`}>{bmi}</p>
            <p className="text-xs text-gray-400 mt-1">BMI</p>
            <p className={`text-xs mt-0.5 ${bmiStatus.color}`}>{bmiStatus.label}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <p className="text-xl font-bold">{profile.weight}</p>
            <p className="text-xs text-gray-400 mt-1">現在 kg</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <p className={`text-xl font-bold ${diff > 0 ? 'text-red-500' : diff < 0 ? 'text-blue-500' : 'text-green-500'}`}>
              {diff > 0 ? `+${diff}` : diff}
            </p>
            <p className="text-xs text-gray-400 mt-1">目標まで kg</p>
            <p className="text-xs text-gray-400 mt-0.5">目標 {profile.targetWeight}kg</p>
          </div>
        </div>
      )}

      {/* グラフ */}
      <div className="bg-white rounded-2xl p-5 mb-5 shadow-sm">
        <p className="text-sm font-semibold text-gray-500 mb-4">体重推移</p>
        {recent.length >= 2 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={recent} margin={{ left: -20, right: 10 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
              <Tooltip formatter={(v) => [`${v}kg`, '体重']} labelFormatter={l => l} />
              {profile?.targetWeight && <ReferenceLine y={profile.targetWeight} stroke="#3B82F6" strokeDasharray="4 4" label={{ value: `目標 ${profile.targetWeight}kg`, fontSize: 10, fill: '#3B82F6' }} />}
              <Line type="monotone" dataKey="weight" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-gray-300 py-10">2日分以上の記録でグラフが表示されます</p>
        )}
      </div>

      {/* 栄養素の習慣（過去7日） */}
      {avg && nutritionTargets && (
        <div className="bg-white rounded-2xl p-5 mb-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-500 mb-1">栄養素の習慣（過去7日平均）</p>
          <p className="text-xs text-gray-300 mb-4">{recordedDays.length}日分の記録から算出</p>

          {/* PFC平均 */}
          <div className="space-y-3 mb-4">
            {[
              { label: 'タンパク質', avg: avg.protein, target: nutritionTargets.protein, unit: 'g', bar: 'bg-blue-400' },
              { label: '脂質',       avg: avg.fat,     target: nutritionTargets.fat,     unit: 'g', bar: 'bg-yellow-400' },
              { label: '炭水化物',   avg: avg.carbs,   target: nutritionTargets.carbs,   unit: 'g', bar: 'bg-green-400' },
            ].map(item => {
              const pct = Math.min(100, Math.round(item.avg / item.target * 100));
              const ok = pct >= 80;
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-gray-600">{item.label}</span>
                    <span className={ok ? 'text-gray-500' : 'text-red-500 font-semibold'}>
                      平均 {item.avg}{item.unit} / 目標 {item.target}{item.unit}{!ok && ' ⚠️'}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${ok ? item.bar : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 栄養素バランス（7日平均） */}
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-semibold text-gray-400">栄養素バランス（7日平均）</p>
              {isBeautyMode && <span className="text-xs bg-pink-100 text-pink-500 px-1.5 py-0.5 rounded-full font-semibold">美容モード</span>}
            </div>

            {/* ① TOP3 バー表示（最重要・常時） */}
            {(() => {
              const TOP3 = [
                { key: 'vitaminC' as const, label: 'ビタミンC', unit: 'mg', dot: 'bg-orange-400', bar: 'bg-orange-400' },
                { key: 'omega3'   as const, label: 'EPA+DHA',   unit: 'g',  dot: 'bg-blue-400',   bar: 'bg-blue-400'   },
                { key: 'zinc'     as const, label: '亜鉛',      unit: 'mg', dot: 'bg-teal-400',   bar: 'bg-teal-400'   },
              ];
              return (
                <div className="space-y-2 mb-4">
                  {TOP3.map(item => {
                    const def = MICRO_DEFS.find(d => d.key === item.key);
                    const target = def?.target ?? 0;
                    const v = (avg.micros[item.key] as number) ?? 0;
                    const pct = Math.min(100, Math.round(v / target * 100));
                    const ok = v >= target * 0.8;
                    return (
                      <div key={item.key}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.dot}`} />
                          <span className="text-sm text-gray-600 flex-1">{item.label}</span>
                          <span className={`text-sm font-semibold ${ok ? 'text-gray-700' : v > 0 ? 'text-orange-400' : 'text-gray-300'}`}>{v}{item.unit}</span>
                          <span className="text-xs text-gray-400">目標{target}{item.unit}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden ml-5">
                          <div className={`h-full rounded-full transition-all ${ok ? item.bar : v > 0 ? 'bg-orange-400' : 'bg-gray-200'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* ② 高優先度美容4種（2列大カード・美容モード常時） */}
            {isBeautyMode && (
              <div className="bg-pink-50/60 border border-pink-100 rounded-xl p-3 mb-3">
                <p className="text-xs font-semibold text-pink-400 mb-2">✨ 美容キー栄養素</p>
                <div className="grid grid-cols-2 gap-2">
                  {MICRO_DEFS.filter(d => d.purpose === 'beauty' && d.priority === 'high').map(d => {
                    const v = (avg.micros[d.key] as number) ?? 0;
                    const pct = Math.min(100, Math.round(v / d.target * 100));
                    const ok = v >= d.target * 0.8;
                    return (
                      <div key={d.key} className="bg-white rounded-xl px-3 py-2.5 shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-gray-500">{d.label}</p>
                          <p className={`text-base font-bold ${ok ? 'text-pink-500' : v > 0 ? 'text-orange-400' : 'text-gray-300'}`}>
                            {v}<span className="text-xs font-normal ml-0.5">{d.unit}</span>
                          </p>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${ok ? 'bg-pink-400' : v > 0 ? 'bg-orange-300' : 'bg-gray-200'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-gray-300 mt-1">目標 {d.target}{d.unit} / {pct}%</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ③ 基本微量栄養素（3列中カード・常時） */}
            {(() => {
              const TOP3_KEYS = new Set(['vitaminC', 'omega3', 'zinc']);
              const baseDefs = MICRO_DEFS.filter(d => !d.purpose && !TOP3_KEYS.has(d.key));
              return (
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {baseDefs.map(d => {
                    const v = (avg.micros[d.key] as number) ?? 0;
                    const pct = Math.min(100, Math.round(v / d.target * 100));
                    const ok = d.isLimit ? v <= d.target : v >= d.target * 0.8;
                    const color = d.isLimit
                      ? (v > d.target ? 'bg-red-50 border-red-200 text-red-600' : 'bg-gray-50 border-gray-100 text-gray-600')
                      : (ok ? 'bg-green-50 border-green-100 text-green-700' : v > 0 ? 'bg-orange-50 border-orange-100 text-orange-600' : 'bg-gray-50 border-gray-100 text-gray-400');
                    return (
                      <div key={d.key} className={`rounded-xl border px-2 py-2 ${color}`}>
                        <p className="text-xs font-semibold truncate">{d.label}</p>
                        <p className="text-sm font-bold mt-0.5">{v}<span className="text-xs font-normal ml-0.5">{d.unit}</span></p>
                        <div className="h-1 bg-white/60 rounded-full mt-1.5 overflow-hidden">
                          <div className={`h-full rounded-full ${ok ? 'bg-green-400' : v > 0 ? 'bg-orange-400' : 'bg-gray-200'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs opacity-50 mt-0.5">{d.isLimit ? '上限' : '目標'}{d.target}{d.unit}</p>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* ④ 低優先度美容（3列コンパクト・折りたたみ） */}
            {isBeautyMode && (() => {
              const lowDefs = MICRO_DEFS.filter(d => d.purpose === 'beauty' && d.priority === 'low');
              return (
                <div>
                  <button onClick={() => setShowAllBeautyMicros(v => !v)}
                    className="text-xs text-pink-400 hover:text-pink-600 font-semibold flex items-center gap-1 mb-2">
                    {showAllBeautyMicros ? '▲ 詳細を閉じる' : `▼ 詳細栄養素（${lowDefs.length}種）`}
                  </button>
                  {showAllBeautyMicros && (
                    <div className="grid grid-cols-4 gap-1">
                      {lowDefs.map(d => {
                        const v = (avg.micros[d.key] as number) ?? 0;
                        const pct = Math.min(100, Math.round(v / d.target * 100));
                        const ok = v >= d.target * 0.8;
                        const color = ok ? 'bg-green-50 border-green-100 text-green-700' : v > 0 ? 'bg-orange-50 border-orange-100 text-orange-600' : 'bg-gray-50 border-gray-100 text-gray-400';
                        return (
                          <div key={d.key} className={`rounded-lg border px-1.5 py-1.5 ${color}`}>
                            <p className="text-xs font-semibold truncate leading-tight">{d.label}</p>
                            <p className="text-xs font-bold mt-0.5">{v}<span className="text-xs font-normal">{d.unit}</span></p>
                            <div className="h-0.5 bg-white/60 rounded-full mt-1 overflow-hidden">
                              <div className={`h-full rounded-full ${ok ? 'bg-green-400' : v > 0 ? 'bg-orange-400' : 'bg-gray-200'}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* 不足栄養素と食品提案 */}
          {deficient.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-red-500 mb-3">⚠️ 不足しがちな栄養素と補給できる食品</p>
              <div className="space-y-2">
                {deficient.map(({ label, foods }) => (
                  <div key={label} className="bg-red-50 rounded-xl p-3">
                    <p className="text-xs font-bold text-red-600 mb-2">● {label}が不足</p>
                    <div className="flex flex-wrap gap-1.5">
                      {foods.map(f => (
                        <span key={f} className="text-xs bg-white border border-red-100 text-gray-700 px-2 py-1 rounded-full">{f}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 履歴 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <p className="text-sm font-semibold text-gray-500 mb-3">記録履歴</p>
        {weightEntries.length === 0
          ? <p className="text-center text-gray-300 py-8">まだ記録がありません</p>
          : [...weightEntries].reverse().slice(0, 30).map(e => (
            <div key={e.date} className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-600">{e.date}</span>
              <span className="text-sm font-semibold">{e.weight} kg</span>
            </div>
          ))}
      </div>
    </div>
  );
}
