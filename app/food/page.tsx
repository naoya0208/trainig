'use client';
import { useEffect, useState } from 'react';
import { useStore, FoodEntry, SavedFood } from '@/lib/store';

const TODAY = new Date().toISOString().split('T')[0];
const MEAL_LABELS: Record<string, string> = { breakfast: '朝食', lunch: '昼食', dinner: '夕食', snack: '間食' };

interface AIFood { name: string; grams: number; calories: number; protein: number; fat: number; carbs: number; note?: string; }

function calcNutrition(per100g: SavedFood['per100g'], grams: number) {
  const r = grams / 100;
  return {
    calories: Math.round(per100g.calories * r),
    protein: Math.round(per100g.protein * r * 10) / 10,
    fat: Math.round(per100g.fat * r * 10) / 10,
    carbs: Math.round(per100g.carbs * r * 10) / 10,
  };
}

function toPer100g(food: AIFood) {
  const r = 100 / food.grams;
  return {
    calories: Math.round(food.calories * r),
    protein: Math.round(food.protein * r * 10) / 10,
    fat: Math.round(food.fat * r * 10) / 10,
    carbs: Math.round(food.carbs * r * 10) / 10,
  };
}

export default function FoodPage() {
  const { foodEntries, savedFoods, addFood, removeFood, saveFoodToHistory, toggleFavorite, hydrate } = useStore();
  const [tab, setTab] = useState<'ai' | 'favorites' | 'history'>('ai');
  const [query, setQuery] = useState('');
  const [meal, setMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');
  const [results, setResults] = useState<AIFood[]>([]);
  const [editGrams, setEditGrams] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { hydrate(); }, []);

  const todayEntries = foodEntries.filter(e => e.date === TODAY);
  const totalCal = todayEntries.reduce((s, e) => s + e.calories, 0);
  const favorites = savedFoods.filter(f => f.isFavorite);
  const history = [...savedFoods].sort((a, b) => b.lastUsed.localeCompare(a.lastUsed));

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true); setError(''); setResults([]);
    try {
      const res = await fetch('/api/gemini/food', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (data.foods) {
        setResults(data.foods);
        const initGrams: Record<number, string> = {};
        data.foods.forEach((f: AIFood, i: number) => { initGrams[i] = String(f.grams); });
        setEditGrams(initGrams);
      } else setError('取得に失敗しました');
    } catch { setError('エラーが発生しました'); }
    finally { setLoading(false); }
  }

  function getAdjusted(food: AIFood, idx: number) {
    const g = parseFloat(editGrams[idx]) || food.grams;
    const per100g = toPer100g(food);
    const n = calcNutrition(per100g, g);
    return { ...n, grams: g, per100g };
  }

  function handleAdd(food: AIFood, idx: number) {
    const { grams, calories, protein, fat, carbs, per100g } = getAdjusted(food, idx);
    const entry: FoodEntry = {
      id: Date.now().toString(), date: TODAY, meal,
      foodName: food.name, grams, calories, protein, fat, carbs,
    };
    addFood(entry);
    saveFoodToHistory({
      id: food.name, foodName: food.name, grams, per100g,
      note: food.note, isFavorite: false,
      lastUsed: TODAY, useCount: 1,
    });
    setResults([]); setQuery('');
  }

  function handleAddSaved(saved: SavedFood) {
    const { calories, protein, fat, carbs } = calcNutrition(saved.per100g, saved.grams);
    addFood({
      id: Date.now().toString(), date: TODAY, meal,
      foodName: saved.foodName, grams: saved.grams, calories, protein, fat, carbs,
    });
    saveFoodToHistory({ ...saved, lastUsed: TODAY, useCount: saved.useCount + 1 });
  }

  function FoodCard({ saved }: { saved: SavedFood }) {
    const [g, setG] = useState(String(saved.grams));
    const n = calcNutrition(saved.per100g, parseFloat(g) || saved.grams);
    return (
      <div className="border border-gray-100 rounded-xl p-4 hover:border-blue-200 transition">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900 text-sm">{saved.foodName}</p>
              <button onClick={() => toggleFavorite(saved.id)} className="text-lg">
                {saved.isFavorite ? '★' : '☆'}
              </button>
            </div>
            {saved.note && <p className="text-xs text-gray-400">{saved.note}</p>}
          </div>
          <p className="text-lg font-bold text-gray-900">{n.calories} kcal</p>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <input
            className="w-20 bg-gray-50 border border-gray-200 rounded-lg text-center text-sm py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            type="number" value={g} onChange={e => setG(e.target.value)} />
          <span className="text-xs text-gray-400">g</span>
          <div className="flex gap-3 text-xs text-gray-500 ml-2">
            <span className="text-blue-600">P {n.protein}g</span>
            <span className="text-yellow-600">F {n.fat}g</span>
            <span className="text-green-600">C {n.carbs}g</span>
          </div>
        </div>
        <button onClick={() => handleAddSaved({ ...saved, grams: parseFloat(g) || saved.grams })}
          className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
          {MEAL_LABELS[meal]}に追加
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">食事記録</h1>
      <div className="bg-white rounded-2xl px-5 py-3 mb-5 shadow-sm flex justify-between items-center">
        <span className="text-sm text-gray-400">今日の合計</span>
        <span className="text-xl font-bold">{totalCal.toLocaleString()} kcal</span>
      </div>

      {/* 食事タイミング */}
      <div className="flex gap-2 mb-4">
        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(m => (
          <button key={m} onClick={() => setMeal(m)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${meal === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {MEAL_LABELS[m]}
          </button>
        ))}
      </div>

      {/* タブ */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl">
        {([['ai', '✨ AI検索'], ['favorites', '★ お気に入り'], ['history', '🕐 履歴']] as const).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${tab === t ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* AI検索タブ */}
      {tab === 'ai' && (
        <div className="bg-white rounded-2xl p-5 mb-5 shadow-sm">
          <p className="text-xs text-gray-400 mb-3">例:「ラーメン大盛り」「サラダチキン1個」「トースト2枚と目玉焼き」</p>
          <div className="flex gap-2">
            <input
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="食品名・料理名・自然文で入力..."
              value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            <button onClick={handleSearch} disabled={loading}
              className="bg-blue-600 text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
              {loading ? '...' : '検索'}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

          {results.length > 0 && (
            <div className="mt-4 space-y-4">
              <p className="text-sm font-semibold text-gray-500">検索結果（g編集可・タップで追加）</p>
              {results.map((food, i) => {
                const adj = getAdjusted(food, i);
                return (
                  <div key={i} className="border border-gray-100 rounded-xl p-4 hover:border-blue-200 transition">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">{food.name}</p>
                        {food.note && <p className="text-xs text-gray-400 mt-0.5">{food.note}</p>}
                      </div>
                      <p className="text-lg font-bold text-gray-900">{adj.calories} kcal</p>
                    </div>
                    {/* g編集 */}
                    <div className="flex items-center gap-2 mb-3 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-xs text-gray-500">グラム数を編集:</span>
                      <input
                        className="w-20 text-center text-sm font-bold bg-transparent focus:outline-none border-b border-blue-400"
                        type="number" value={editGrams[i] ?? food.grams}
                        onChange={e => setEditGrams(prev => ({ ...prev, [i]: e.target.value }))} />
                      <span className="text-xs text-gray-400">g</span>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500 mb-3">
                      <span className="text-blue-600 font-semibold">P {adj.protein}g</span>
                      <span className="text-yellow-600 font-semibold">F {adj.fat}g</span>
                      <span className="text-green-600 font-semibold">C {adj.carbs}g</span>
                    </div>
                    <button onClick={() => handleAdd(food, i)}
                      className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
                      {MEAL_LABELS[meal]}に追加
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* お気に入りタブ */}
      {tab === 'favorites' && (
        <div className="space-y-3 mb-5">
          {favorites.length === 0
            ? <p className="text-center text-gray-300 py-12">お気に入りがありません<br/><span className="text-sm">履歴の☆をタップで追加</span></p>
            : favorites.map(f => <FoodCard key={f.id} saved={f} />)}
        </div>
      )}

      {/* 履歴タブ */}
      {tab === 'history' && (
        <div className="space-y-3 mb-5">
          {history.length === 0
            ? <p className="text-center text-gray-300 py-12">履歴がありません</p>
            : history.map(f => <FoodCard key={f.id} saved={f} />)}
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
