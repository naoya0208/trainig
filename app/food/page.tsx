'use client';
import { useEffect, useState } from 'react';
import { useStore, FoodEntry } from '@/lib/store';

const TODAY = new Date().toISOString().split('T')[0];
const MEAL_LABELS: Record<string, string> = { breakfast: '朝食', lunch: '昼食', dinner: '夕食', snack: '間食' };

interface AIFood { name: string; grams: number; calories: number; protein: number; fat: number; carbs: number; note?: string; }

export default function FoodPage() {
  const { foodEntries, addFood, removeFood, hydrate } = useStore();
  const [query, setQuery] = useState('');
  const [meal, setMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');
  const [results, setResults] = useState<AIFood[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { hydrate(); }, []);

  const todayEntries = foodEntries.filter(e => e.date === TODAY);
  const totalCal = todayEntries.reduce((s, e) => s + e.calories, 0);

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setResults([]);
    try {
      const res = await fetch('/api/gemini/food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (data.foods) setResults(data.foods);
      else setError('取得に失敗しました');
    } catch {
      setError('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  function handleAdd(food: AIFood) {
    addFood({
      id: Date.now().toString(),
      date: TODAY, meal,
      foodName: food.name,
      grams: food.grams,
      calories: food.calories,
      protein: food.protein,
      fat: food.fat,
      carbs: food.carbs,
    });
    setResults([]);
    setQuery('');
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">食事記録</h1>
      <div className="bg-white rounded-2xl px-5 py-3 mb-5 shadow-sm flex justify-between items-center">
        <span className="text-sm text-gray-400">今日の合計</span>
        <span className="text-xl font-bold">{totalCal.toLocaleString()} kcal</span>
      </div>

      {/* AI検索 */}
      <div className="bg-white rounded-2xl p-5 mb-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">✨ AI</span>
          <p className="text-sm font-semibold text-gray-600">何でも自然文で入力できます</p>
        </div>
        <p className="text-xs text-gray-400 mb-3">例:「ラーメン大盛り」「サラダチキン1個」「今日の朝ご飯はトースト2枚と目玉焼き」</p>

        {/* 食事タイミング */}
        <div className="flex gap-2 mb-3">
          {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(m => (
            <button key={m} onClick={() => setMeal(m)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${meal === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {MEAL_LABELS[m]}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="食品名・料理名・自然文で入力..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} disabled={loading}
            className="bg-blue-600 text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
            {loading ? '...' : '検索'}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {/* AI検索結果 */}
      {results.length > 0 && (
        <div className="bg-white rounded-2xl p-5 mb-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-500 mb-3">検索結果（タップで追加）</p>
          <div className="space-y-3">
            {results.map((food, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-4 hover:border-blue-200 hover:bg-blue-50 transition">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">{food.name}</p>
                    {food.note && <p className="text-xs text-gray-400 mt-0.5">{food.note}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">{food.calories} kcal</p>
                    <p className="text-xs text-gray-400">{food.grams}g</p>
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-gray-500 mb-3">
                  <span className="text-blue-600 font-semibold">P {food.protein}g</span>
                  <span className="text-yellow-600 font-semibold">F {food.fat}g</span>
                  <span className="text-green-600 font-semibold">C {food.carbs}g</span>
                </div>
                <button onClick={() => handleAdd(food)}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
                  {MEAL_LABELS[meal]}に追加
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 今日の記録 */}
      {todayEntries.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-500 mb-3">今日の記録</p>
          <div className="space-y-2">
            {todayEntries.map(e => (
              <div key={e.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  e.meal === 'breakfast' ? 'bg-orange-100 text-orange-600' :
                  e.meal === 'lunch' ? 'bg-green-100 text-green-600' :
                  e.meal === 'dinner' ? 'bg-blue-100 text-blue-600' :
                  'bg-purple-100 text-purple-600'}`}>
                  {MEAL_LABELS[e.meal]}
                </span>
                <span className="flex-1 text-sm text-gray-700">{e.foodName}（{e.grams}g）</span>
                <span className="text-sm font-semibold">{e.calories}kcal</span>
                <button onClick={() => removeFood(e.id)} className="text-gray-300 hover:text-red-400 transition">✕</button>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
            <span className="text-gray-400">合計</span>
            <span className="font-bold">{totalCal.toLocaleString()} kcal</span>
          </div>
        </div>
      )}
    </div>
  );
}
