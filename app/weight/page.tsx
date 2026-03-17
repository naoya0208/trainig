'use client';
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useStore } from '@/lib/store';
import { calcBMI, getBMIStatus } from '@/lib/calc';

const TODAY = new Date().toISOString().split('T')[0];

export default function WeightPage() {
  const { profile, weightEntries, addWeight, setProfile, hydrate } = useStore();
  const [input, setInput] = useState('');

  useEffect(() => { hydrate(); if (profile) setInput(profile.weight.toString()); }, []);

  function handleSave() {
    const w = parseFloat(input);
    if (isNaN(w) || w < 20 || w > 300) return;
    addWeight({ date: TODAY, weight: w });
    if (profile) setProfile({ ...profile, weight: w });
  }

  const recent = weightEntries.slice(-30);
  const bmi = profile ? calcBMI(profile.weight, profile.height) : null;
  const bmiStatus = bmi ? getBMIStatus(bmi) : null;
  const diff = profile ? parseFloat((profile.weight - profile.targetWeight).toFixed(1)) : null;

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-5">体重管理</h1>

      {/* 入力 */}
      <div className="bg-white rounded-2xl p-6 mb-5 shadow-sm">
        <p className="text-sm text-gray-400 mb-3">今日の体重</p>
        <div className="flex items-end gap-3 mb-5">
          <input
            className="text-5xl font-bold text-gray-900 w-40 border-b-2 border-blue-500 focus:outline-none bg-transparent pb-1"
            type="number" step="0.1" value={input} onChange={e => setInput(e.target.value)}
            placeholder="00.0"
          />
          <span className="text-xl text-gray-400 pb-2">kg</span>
        </div>
        <button onClick={handleSave} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition">
          記録する
        </button>
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
