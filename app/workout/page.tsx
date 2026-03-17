'use client';
import { useEffect, useState } from 'react';
import { useStore, WorkoutSession, WorkoutExercise } from '@/lib/store';

const TODAY = new Date().toISOString().split('T')[0];
const EXERCISES = [
  { name: 'ベンチプレス', part: '胸', met: 6 }, { name: 'ダンベルフライ', part: '胸', met: 5 }, { name: 'プッシュアップ', part: '胸', met: 5 },
  { name: 'デッドリフト', part: '背中', met: 8 }, { name: 'ラットプルダウン', part: '背中', met: 6 }, { name: '懸垂', part: '背中', met: 6 },
  { name: 'スクワット', part: '脚', met: 8 }, { name: 'レッグプレス', part: '脚', met: 6 }, { name: 'ランジ', part: '脚', met: 6 },
  { name: 'ショルダープレス', part: '肩', met: 6 }, { name: 'サイドレイズ', part: '肩', met: 5 },
  { name: 'バーベルカール', part: '二頭筋', met: 5 }, { name: 'ダンベルカール', part: '二頭筋', met: 5 },
  { name: 'トライセップスプッシュダウン', part: '三頭筋', met: 5 },
  { name: 'クランチ', part: '腹筋', met: 3.5 }, { name: 'プランク', part: '腹筋', met: 3.5 }, { name: 'レッグレイズ', part: '腹筋', met: 3.5 },
];
const PARTS = ['胸', '背中', '脚', '肩', '二頭筋', '三頭筋', '腹筋'];

export default function WorkoutPage() {
  const { profile, workoutSessions, addWorkout, removeWorkout, hydrate } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('60');
  const [selectedExercises, setSelectedExercises] = useState<Array<{ name: string; part: string; met: number; sets: Array<{ reps: string; weight: string }> }>>([]);
  const [filterPart, setFilterPart] = useState<string | null>(null);
  const [exQuery, setExQuery] = useState('');

  useEffect(() => { hydrate(); }, []);

  const todayBurned = workoutSessions.filter(s => s.date === TODAY).reduce((s, w) => s + w.burnedCalories, 0);

  function addExercise(ex: typeof EXERCISES[0]) {
    setSelectedExercises(prev => [...prev, { ...ex, sets: [{ reps: '10', weight: '' }] }]);
  }
  function addSet(i: number) {
    setSelectedExercises(prev => { const n = [...prev]; const last = n[i].sets.at(-1)!; n[i] = { ...n[i], sets: [...n[i].sets, { ...last }] }; return n; });
  }
  function updateSet(ei: number, si: number, field: 'reps' | 'weight', val: string) {
    setSelectedExercises(prev => { const n = [...prev]; n[ei].sets[si] = { ...n[ei].sets[si], [field]: val }; return n; });
  }

  function handleSave() {
    if (selectedExercises.length === 0) return;
    const min = parseInt(duration) || selectedExercises.reduce((s, e) => s + e.sets.length * 2, 0);
    const bw = profile?.weight ?? 70;
    const avgMet = selectedExercises.reduce((s, e) => s + e.met, 0) / selectedExercises.length;
    const burnedCalories = Math.round(avgMet * bw * (min / 60));
    const exercises: WorkoutExercise[] = selectedExercises.map(e => ({
      name: e.name, bodyPart: e.part,
      sets: e.sets.map(s => ({ reps: parseInt(s.reps) || 0, weightKg: parseFloat(s.weight) || 0 })),
    }));
    addWorkout({ id: Date.now().toString(), date: TODAY, name: name || 'トレーニング', durationMinutes: min, exercises, burnedCalories });
    setShowForm(false); setSelectedExercises([]); setName(''); setDuration('60');
  }

  const filtered = EXERCISES.filter(e =>
    (!filterPart || e.part === filterPart) &&
    (!exQuery || e.name.includes(exQuery) || e.part.includes(exQuery))
  );

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold">トレーニング</h1>
          <p className="text-sm text-blue-600 mt-0.5">今日の消費: {todayBurned.toLocaleString()} kcal</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">
          + 記録する
        </button>
      </div>

      {/* 記録フォーム */}
      {showForm && (
        <div className="bg-white rounded-2xl p-5 mb-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-gray-800">新しいセッション</h2>
            <button onClick={() => { setShowForm(false); setSelectedExercises([]); }} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          <div className="flex gap-3 mb-4">
            <input className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="セッション名（例: 胸の日）" value={name} onChange={e => setName(e.target.value)} />
            <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-3">
              <input className="w-14 text-lg font-bold focus:outline-none" type="number" value={duration} onChange={e => setDuration(e.target.value)} />
              <span className="text-sm text-gray-400">分</span>
            </div>
          </div>

          {/* 追加済み種目 */}
          {selectedExercises.map((ex, ei) => (
            <div key={ei} className="border border-gray-100 rounded-xl p-3 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">{ex.part}</span>
                <span className="font-semibold text-sm flex-1">{ex.name}</span>
                <button onClick={() => setSelectedExercises(p => p.filter((_, i) => i !== ei))} className="text-red-400 text-sm">✕</button>
              </div>
              <div className="grid grid-cols-3 gap-1 text-xs text-gray-400 mb-2 px-1">
                <span>セット</span><span className="text-center">重量 (kg)</span><span className="text-center">回数</span>
              </div>
              {ex.sets.map((s, si) => (
                <div key={si} className="grid grid-cols-3 gap-2 mb-2 items-center">
                  <span className="text-center text-sm font-bold text-gray-500">{si + 1}</span>
                  <input className="bg-gray-50 rounded-lg text-center text-sm py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    type="number" placeholder="kg" value={s.weight} onChange={e => updateSet(ei, si, 'weight', e.target.value)} />
                  <input className="bg-gray-50 rounded-lg text-center text-sm py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    type="number" value={s.reps} onChange={e => updateSet(ei, si, 'reps', e.target.value)} />
                </div>
              ))}
              <button onClick={() => addSet(ei)} className="text-blue-600 text-xs font-semibold w-full text-center py-1">+ セット追加</button>
            </div>
          ))}

          {/* 種目選択 */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-semibold text-gray-500 mb-3">種目を追加</p>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="種目名で検索" value={exQuery} onChange={e => setExQuery(e.target.value)} />
            <div className="flex gap-2 flex-wrap mb-3">
              {[null, ...PARTS].map(p => (
                <button key={String(p)} onClick={() => setFilterPart(p)}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold transition ${filterPart === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {p ?? 'すべて'}
                </button>
              ))}
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filtered.map(ex => (
                <button key={ex.name} onClick={() => addExercise(ex)}
                  className="w-full flex justify-between items-center bg-gray-50 hover:bg-blue-50 rounded-xl px-4 py-3 text-sm transition">
                  <div className="text-left">
                    <span className="font-semibold text-gray-800">{ex.name}</span>
                    <span className="text-gray-400 ml-2">· {ex.part}</span>
                  </div>
                  <span className="text-blue-600 font-bold text-lg">+</span>
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleSave} className="mt-4 w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition">
            保存する
          </button>
        </div>
      )}

      {/* 履歴 */}
      <div className="space-y-3">
        {[...workoutSessions].reverse().map(s => (
          <div key={s.id} className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-xs text-gray-400">{s.date}</p>
                <p className="font-bold text-gray-900">{s.name}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-blue-600">−{s.burnedCalories.toLocaleString()} kcal</p>
                <p className="text-xs text-gray-400">{s.durationMinutes}分</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {s.exercises.map((ex, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">{ex.bodyPart}</span>
                  <span className="text-gray-700 flex-1">{ex.name}</span>
                  <span className="text-gray-400">{ex.sets.length}セット</span>
                </div>
              ))}
            </div>
            <button onClick={() => removeWorkout(s.id)} className="mt-3 text-xs text-gray-300 hover:text-red-400 transition">削除</button>
          </div>
        ))}
        {workoutSessions.length === 0 && <p className="text-center text-gray-300 py-12">トレーニング記録がありません</p>}
      </div>
    </div>
  );
}
