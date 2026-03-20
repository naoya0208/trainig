'use client';
import { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, LineChart, Line, Legend } from 'recharts';
import { useStore, FoodEntry, MicroNutrients } from '@/lib/store';
import { calcTargetCalories, calcNutritionTargets } from '@/lib/calc';
import { getActiveMicroDefs, sumMicros } from '@/lib/micros';
import { localDate } from '@/lib/date';

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

interface DayData {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  micros: MicroNutrients;
  entries: FoodEntry[];
}

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDow(y: number, m: number) { return new Date(y, m, 1).getDay(); }
function pad2(n: number) { return String(n).padStart(2, '0'); }
function dateStr(y: number, m: number, d: number) { return `${y}-${pad2(m + 1)}-${pad2(d)}`; }

const CHART_COLORS = ['#60A5FA','#34D399','#FBBF24','#F87171','#A78BFA','#FB923C','#4ADE80','#F472B6','#38BDF8','#E879F9','#94A3B8'];
const PFC_KEYS = [
  { key: 'protein' as const, label: 'P タンパク質' },
  { key: 'fat'     as const, label: 'F 脂質' },
  { key: 'carbs'   as const, label: 'C 炭水化物' },
];

export default function CalendarPage() {
  const { profile, foodEntries, hydrate } = useStore();
  const today = localDate();
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(today);
  const [chartType, setChartType] = useState<'cal' | 'pfc'>('cal');

  useEffect(() => { hydrate(); }, []);

  const { targetCalories } = profile ? calcTargetCalories(profile) : { targetCalories: 0 };
  const nutritionTargets = profile ? calcNutritionTargets(profile) : null;

  // 日付ごとにデータ集計
  const dayMap = useMemo(() => {
    const map: Record<string, DayData> = {};
    for (const e of foodEntries) {
      if (!map[e.date]) map[e.date] = { calories: 0, protein: 0, fat: 0, carbs: 0, micros: {}, entries: [] };
      map[e.date].calories += e.calories;
      map[e.date].protein = Math.round((map[e.date].protein + e.protein) * 10) / 10;
      map[e.date].fat = Math.round((map[e.date].fat + e.fat) * 10) / 10;
      map[e.date].carbs = Math.round((map[e.date].carbs + e.carbs) * 10) / 10;
      map[e.date].entries.push(e);
    }
    for (const date of Object.keys(map)) {
      map[date].micros = sumMicros(map[date].entries);
    }
    return map;
  }, [foodEntries]);

  // カレンダーグリッド
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDow = getFirstDow(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  // 直近60日のグラフデータ
  const chartData = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (59 - i));
      const ds = localDate(d);
      const data = dayMap[ds];
      return {
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        calories: data?.calories ?? 0,
        protein: data?.protein ?? 0,
        fat: data?.fat ?? 0,
        carbs: data?.carbs ?? 0,
      };
    }).filter(d => d.calories > 0 || d.date === `${new Date().getMonth() + 1}/${new Date().getDate()}`);
  }, [dayMap]);

  const sel = dayMap[selectedDate];
  const selDate = new Date(selectedDate + 'T00:00:00');

  // 食品別積み上げグラフ用データ
  const uniqueFoods = sel ? [...new Set(sel.entries.map(e => e.foodName))] : [];
  const pfcStackData = sel ? PFC_KEYS.map(({ key, label }) => {
    const row: Record<string, string | number> = { name: label };
    for (const foodName of uniqueFoods) {
      row[foodName] = Math.round(sel.entries.filter(e => e.foodName === foodName).reduce((s, e) => s + e[key], 0) * 10) / 10;
    }
    return row;
  }) : [];

  const MICRO_DEFS = getActiveMicroDefs(profile?.goalPurpose);

  function calColor(calories: number) {
    if (!targetCalories || calories === 0) return '';
    const ratio = calories / targetCalories;
    if (ratio <= 1.0) return 'bg-green-100 text-green-700';
    if (ratio <= 1.15) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-5">記録カレンダー</h1>

      {/* カレンダー */}
      <div className="bg-white rounded-2xl p-4 mb-5 shadow-sm">
        {/* 月ナビ */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500">‹</button>
          <span className="font-bold text-gray-800">{viewYear}年 {viewMonth + 1}月</span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500">›</button>
        </div>

        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 mb-1">
          {DOW.map((d, i) => (
            <div key={d} className={`text-center text-xs font-semibold py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
          ))}
        </div>

        {/* 日付セル */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, idx) => {
            if (day === null) return <div key={idx} />;
            const ds = dateStr(viewYear, viewMonth, day);
            const data = dayMap[ds];
            const isToday = ds === today;
            const isSelected = ds === selectedDate;
            const dow = (firstDow + day - 1) % 7;
            return (
              <button key={ds} onClick={() => setSelectedDate(ds)}
                className={`relative flex flex-col items-center py-1.5 rounded-xl transition text-xs
                  ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'}
                  ${isToday && !isSelected ? 'font-bold' : ''}`}>
                <span className={`text-xs mb-0.5 ${dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : isToday ? 'text-blue-600 font-bold' : 'text-gray-600'}`}>{day}</span>
                {data ? (
                  <span className={`text-xs px-1 py-0.5 rounded-md font-semibold ${calColor(data.calories)}`}>
                    {data.calories >= 1000 ? `${(data.calories / 1000).toFixed(1)}k` : data.calories}
                  </span>
                ) : (
                  <span className="text-xs text-gray-200">-</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 選択日の詳細 */}
      <div className="bg-white rounded-2xl p-5 mb-5 shadow-sm">
        <p className="text-sm font-semibold text-gray-500 mb-3">
          {selDate.getFullYear()}年{selDate.getMonth() + 1}月{selDate.getDate()}日
          <span className="ml-1 text-gray-400">({DOW[selDate.getDay()]})</span>
          {selectedDate === today && <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">今日</span>}
        </p>

        {sel ? (
          <>
            {/* カロリーサマリ */}
            <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-xl">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{sel.calories.toLocaleString()}</p>
                <p className="text-xs text-gray-400">kcal</p>
              </div>
              {targetCalories > 0 && (
                <>
                  <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${sel.calories <= targetCalories ? 'bg-blue-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(100, Math.round(sel.calories / targetCalories * 100))}%` }} />
                  </div>
                  <div className="text-center text-xs text-gray-400">
                    <p>目標 {targetCalories}</p>
                    <p className={sel.calories <= targetCalories ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                      {sel.calories <= targetCalories ? `残 ${targetCalories - sel.calories}` : `+${sel.calories - targetCalories}`}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* PFC */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: 'タンパク質', val: sel.protein, unit: 'g', color: 'text-blue-600', target: nutritionTargets?.protein },
                { label: '脂質', val: sel.fat, unit: 'g', color: 'text-yellow-600', target: nutritionTargets?.fat },
                { label: '炭水化物', val: sel.carbs, unit: 'g', color: 'text-green-600', target: nutritionTargets?.carbs },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className={`text-lg font-bold ${item.color}`}>{item.val}</p>
                  <p className="text-xs text-gray-400">{item.label} {item.unit}</p>
                  {item.target && <p className="text-xs text-gray-300">目標 {item.target}{item.unit}</p>}
                </div>
              ))}
            </div>

            {/* 微量栄養素 */}
            {MICRO_DEFS.some(d => (sel.micros[d.key] ?? 0) > 0) && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-400 mb-2">微量栄養素</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {MICRO_DEFS.map(d => {
                    const v = (sel.micros[d.key] as number) ?? 0;
                    const ok = d.isLimit ? v <= d.target : v >= d.target * 0.8;
                    const color = d.isLimit
                      ? (v > d.target ? 'bg-red-50 border-red-200 text-red-600' : 'bg-gray-50 border-gray-100 text-gray-600')
                      : (ok ? 'bg-green-50 border-green-100 text-green-700' : v > 0 ? 'bg-orange-50 border-orange-100 text-orange-600' : 'bg-gray-50 border-gray-100 text-gray-400');
                    return (
                      <div key={d.key} className={`rounded-xl border px-2 py-1.5 ${color}`}>
                        <p className="text-xs font-semibold truncate">{d.label}</p>
                        <p className="text-sm font-bold">{v}<span className="text-xs font-normal ml-0.5">{d.unit}</span></p>
                        <p className="text-xs opacity-60">{d.isLimit ? '上限' : '目標'}{d.target}{d.unit}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PFC別・食品積み上げグラフ */}
            {sel.calories > 0 && uniqueFoods.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-400 mb-2">PFC内訳（食品別）</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={pfcStackData} margin={{ left: -20, right: 5 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} unit="g" />
                    <Tooltip formatter={(v, name) => [`${v}g`, String(name).length > 12 ? String(name).slice(0, 11) + '…' : name]} />
                    {uniqueFoods.map((foodName, i) => (
                      <Bar key={foodName} dataKey={foodName} stackId="pfc"
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                        radius={i === uniqueFoods.length - 1 ? [3, 3, 0, 0] : undefined} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                {/* 食品凡例 */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center">
                  {uniqueFoods.map((name, i) => (
                    <span key={name} className="flex items-center gap-1 text-xs text-gray-600">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      {name.length > 10 ? name.slice(0, 9) + '…' : name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 食事リスト */}
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">食事内容</p>
              <div className="space-y-1">
                {sel.entries.map(e => (
                  <div key={e.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0 text-sm">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0
                      ${e.meal === 'breakfast' ? 'bg-orange-100 text-orange-600' : e.meal === 'lunch' ? 'bg-green-100 text-green-600' : e.meal === 'dinner' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                      {e.meal === 'breakfast' ? '朝' : e.meal === 'lunch' ? '昼' : e.meal === 'dinner' ? '夕' : '間'}
                    </span>
                    {e.time && <span className="text-xs text-gray-400 flex-shrink-0">{e.time}</span>}
                    <span className="flex-1 text-gray-700 truncate">{e.foodName}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{e.grams}g</span>
                    <span className="text-xs font-semibold text-gray-700 flex-shrink-0">{e.calories}kcal</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="text-center text-gray-300 py-10">この日の記録はありません</p>
        )}
      </div>

      {/* グラフ */}
      {chartData.length > 1 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-500">摂取推移</p>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              <button onClick={() => setChartType('cal')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${chartType === 'cal' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>カロリー</button>
              <button onClick={() => setChartType('pfc')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${chartType === 'pfc' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>PFC</button>
            </div>
          </div>

          {chartType === 'cal' ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ left: -20, right: 5 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [`${v} kcal`, 'カロリー']} />
                {targetCalories > 0 && (
                  <ReferenceLine y={targetCalories} stroke="#3B82F6" strokeDasharray="4 4"
                    label={{ value: `目標 ${targetCalories}`, fontSize: 9, fill: '#3B82F6', position: 'right' }} />
                )}
                <Bar dataKey="calories" fill="#60A5FA" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ left: -20, right: 5 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v, name) => [`${v}g`, name === 'protein' ? 'タンパク質' : name === 'fat' ? '脂質' : '炭水化物']} />
                <Legend formatter={v => v === 'protein' ? 'タンパク質' : v === 'fat' ? '脂質' : '炭水化物'} />
                <Line type="monotone" dataKey="protein" stroke="#60A5FA" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="fat" stroke="#FBBF24" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="carbs" stroke="#34D399" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}
