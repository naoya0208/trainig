'use client';
import { useEffect, useState } from 'react';
import { useStore, FoodEntry, SavedFood } from '@/lib/store';

const TODAY = new Date().toISOString().split('T')[0];
const MEAL_LABELS: Record<string, string> = { breakfast: '朝食', lunch: '昼食', dinner: '夕食', snack: '間食' };

interface Ingredient { name: string; grams: number; calories: number; protein: number; fat: number; carbs: number; }
interface AIFood { name: string; note?: string; ingredients: Ingredient[]; }

function calcPer100g(ing: Ingredient) {
  if (ing.grams === 0) return { calories: 0, protein: 0, fat: 0, carbs: 0 };
  const r = 100 / ing.grams;
  return {
    calories: Math.round(ing.calories * r),
    protein: Math.round(ing.protein * r * 10) / 10,
    fat: Math.round(ing.fat * r * 10) / 10,
    carbs: Math.round(ing.carbs * r * 10) / 10,
  };
}

function scaleIngredient(ing: Ingredient, newGrams: number): Ingredient {
  if (ing.grams === 0) return { ...ing, grams: newGrams };
  const r = newGrams / ing.grams;
  return {
    ...ing, grams: newGrams,
    calories: Math.round(ing.calories * r),
    protein: Math.round(ing.protein * r * 10) / 10,
    fat: Math.round(ing.fat * r * 10) / 10,
    carbs: Math.round(ing.carbs * r * 10) / 10,
  };
}

function sumIngredients(ings: Ingredient[]) {
  return ings.reduce((acc, i) => ({
    calories: acc.calories + i.calories,
    protein: Math.round((acc.protein + i.protein) * 10) / 10,
    fat: Math.round((acc.fat + i.fat) * 10) / 10,
    carbs: Math.round((acc.carbs + i.carbs) * 10) / 10,
    grams: acc.grams + i.grams,
  }), { calories: 0, protein: 0, fat: 0, carbs: 0, grams: 0 });
}

function EditableFoodCard({
  food, meal, onAdd
}: {
  food: AIFood;
  meal: string;
  onAdd: (food: AIFood, ingredients: Ingredient[]) => void;
}) {
  const [ingredients, setIngredients] = useState<Ingredient[]>(food.ingredients);
  const [newIngName, setNewIngName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const totals = sumIngredients(ingredients);

  function updateGrams(idx: number, val: string) {
    const g = parseFloat(val);
    if (isNaN(g) || g < 0) return;
    setIngredients(prev => prev.map((ing, i) => i === idx ? scaleIngredient(ing, g) : ing));
  }

  function removeIngredient(idx: number) {
    setIngredients(prev => prev.filter((_, i) => i !== idx));
  }

  function addIngredient() {
    if (!newIngName.trim()) return;
    setIngredients(prev => [...prev, { name: newIngName, grams: 100, calories: 0, protein: 0, fat: 0, carbs: 0 }]);
    setNewIngName('');
    setShowAdd(false);
  }

  return (
    <div className="border border-gray-100 rounded-xl p-4 hover:border-blue-200 transition">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="font-semibold text-gray-900">{food.name}</p>
          {food.note && <p className="text-xs text-gray-400 mt-0.5">{food.note}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-gray-900">{totals.calories} kcal</p>
          <p className="text-xs text-gray-400">{totals.grams}g</p>
        </div>
      </div>

      {/* 具材リスト */}
      <div className="bg-gray-50 rounded-xl p-3 mb-3">
        <p className="text-xs font-semibold text-gray-500 mb-2">具材（gを編集可）</p>
        <div className="space-y-2">
          {ingredients.map((ing, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-sm text-gray-700 flex-1">{ing.name}</span>
              <input
                className="w-16 text-center text-sm bg-white border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                type="number" value={ing.grams}
                onChange={e => updateGrams(i, e.target.value)} />
              <span className="text-xs text-gray-400 w-4">g</span>
              <span className="text-xs text-gray-500 w-14 text-right">{ing.calories}kcal</span>
              <button onClick={() => removeIngredient(i)} className="text-gray-300 hover:text-red-400 transition text-sm">✕</button>
            </div>
          ))}
        </div>

        {/* 具材追加 */}
        {showAdd ? (
          <div className="flex gap-2 mt-2">
            <input className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
              placeholder="具材名" value={newIngName} onChange={e => setNewIngName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addIngredient()} autoFocus />
            <button onClick={addIngredient} className="text-xs bg-blue-600 text-white px-2 py-1 rounded-lg">追加</button>
            <button onClick={() => setShowAdd(false)} className="text-xs text-gray-400">✕</button>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)} className="mt-2 text-xs text-blue-600 font-semibold w-full text-center py-1">+ 具材を追加</button>
        )}
      </div>

      {/* PFC合計 */}
      <div className="flex gap-4 text-xs text-gray-500 mb-3">
        <span className="text-blue-600 font-semibold">P {totals.protein}g</span>
        <span className="text-yellow-600 font-semibold">F {totals.fat}g</span>
        <span className="text-green-600 font-semibold">C {totals.carbs}g</span>
      </div>

      <button onClick={() => onAdd(food, ingredients)}
        className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
        {MEAL_LABELS[meal]}に追加
      </button>
    </div>
  );
}

function calcNutrition(per100g: SavedFood['per100g'], grams: number) {
  const r = grams / 100;
  return {
    calories: Math.round(per100g.calories * r),
    protein: Math.round(per100g.protein * r * 10) / 10,
    fat: Math.round(per100g.fat * r * 10) / 10,
    carbs: Math.round(per100g.carbs * r * 10) / 10,
  };
}

function SavedFoodCard({ saved, meal, onAdd, onToggleFav }: {
  saved: SavedFood; meal: string;
  onAdd: (s: SavedFood, g: number) => void;
  onToggleFav: (id: string) => void;
}) {
  const [g, setG] = useState(String(saved.grams));
  const n = calcNutrition(saved.per100g, parseFloat(g) || saved.grams);
  return (
    <div className="border border-gray-100 rounded-xl p-4 transition">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2 flex-1">
          <p className="font-semibold text-gray-900 text-sm">{saved.foodName}</p>
          <button onClick={() => onToggleFav(saved.id)} className="text-lg">{saved.isFavorite ? '★' : '☆'}</button>
        </div>
        <p className="text-lg font-bold text-gray-900">{n.calories} kcal</p>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <input className="w-20 bg-gray-50 border border-gray-200 rounded-lg text-center text-sm py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
          type="number" value={g} onChange={e => setG(e.target.value)} />
        <span className="text-xs text-gray-400">g</span>
        <div className="flex gap-3 text-xs ml-2">
          <span className="text-blue-600">P {n.protein}g</span>
          <span className="text-yellow-600">F {n.fat}g</span>
          <span className="text-green-600">C {n.carbs}g</span>
        </div>
      </div>
      <button onClick={() => onAdd(saved, parseFloat(g) || saved.grams)}
        className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
        {MEAL_LABELS[meal]}に追加
      </button>
    </div>
  );
}

export default function FoodPage() {
  const { foodEntries, savedFoods, addFood, removeFood, saveFoodToHistory, toggleFavorite, hydrate } = useStore();
  const [tab, setTab] = useState<'ai' | 'favorites' | 'history'>('ai');
  const [query, setQuery] = useState('');
  const [meal, setMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');
  const [eatTime, setEatTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [results, setResults] = useState<AIFood[]>([]);
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
      if (data.foods) setResults(data.foods);
      else setError('取得に失敗しました');
    } catch { setError('エラーが発生しました'); }
    finally { setLoading(false); }
  }

  function handleAddFood(food: AIFood, ingredients: Ingredient[]) {
    const totals = sumIngredients(ingredients);
    const entry: FoodEntry = {
      id: Date.now().toString(), date: TODAY, time: eatTime, meal,
      foodName: food.name, grams: totals.grams,
      calories: totals.calories, protein: totals.protein,
      fat: totals.fat, carbs: totals.carbs,
    };
    addFood(entry);
    const per100g = totals.grams > 0 ? {
      calories: Math.round(totals.calories / totals.grams * 100),
      protein: Math.round(totals.protein / totals.grams * 100 * 10) / 10,
      fat: Math.round(totals.fat / totals.grams * 100 * 10) / 10,
      carbs: Math.round(totals.carbs / totals.grams * 100 * 10) / 10,
    } : { calories: 0, protein: 0, fat: 0, carbs: 0 };
    saveFoodToHistory({
      id: food.name, foodName: food.name, grams: totals.grams,
      per100g, note: food.note, isFavorite: false,
      lastUsed: TODAY, useCount: 1,
    });
    setResults([]); setQuery('');
  }

  function handleAddSaved(saved: SavedFood, grams: number) {
    const n = calcNutrition(saved.per100g, grams);
    addFood({ id: Date.now().toString(), date: TODAY, time: eatTime, meal, foodName: saved.foodName, grams, ...n });
    saveFoodToHistory({ ...saved, grams, lastUsed: TODAY, useCount: saved.useCount + 1 });
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">食事記録</h1>
      <div className="bg-white rounded-2xl px-5 py-3 mb-5 shadow-sm flex justify-between items-center">
        <span className="text-sm text-gray-400">今日の合計</span>
        <span className="text-xl font-bold">{totalCal.toLocaleString()} kcal</span>
      </div>

      {/* 食事タイミング＋時間 */}
      <div className="bg-white rounded-2xl px-4 py-3 mb-4 shadow-sm flex items-center gap-3">
        <div className="flex gap-2 flex-1">
          {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(m => (
            <button key={m} onClick={() => setMeal(m)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${meal === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {MEAL_LABELS[m]}
            </button>
          ))}
        </div>
        <input type="time" value={eatTime} onChange={e => setEatTime(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
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

      {/* AI検索 */}
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
              <p className="text-sm font-semibold text-gray-500">検索結果（具材のg・追加・削除が可能）</p>
              {results.map((food, i) => (
                <EditableFoodCard key={i} food={food} meal={meal} onAdd={handleAddFood} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* お気に入り */}
      {tab === 'favorites' && (
        <div className="space-y-3 mb-5">
          {favorites.length === 0
            ? <p className="text-center text-gray-300 py-12">お気に入りがありません<br/><span className="text-sm">履歴の☆をタップで追加</span></p>
            : favorites.map(f => <SavedFoodCard key={f.id} saved={f} meal={meal} onAdd={handleAddSaved} onToggleFav={toggleFavorite} />)}
        </div>
      )}

      {/* 履歴 */}
      {tab === 'history' && (
        <div className="space-y-3 mb-5">
          {history.length === 0
            ? <p className="text-center text-gray-300 py-12">履歴がありません</p>
            : history.map(f => <SavedFoodCard key={f.id} saved={f} meal={meal} onAdd={handleAddSaved} onToggleFav={toggleFavorite} />)}
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
                <span className="flex-1 text-sm text-gray-700">
                  {e.time && <span className="text-xs text-gray-400 mr-1">{e.time}</span>}
                  {e.foodName}（{e.grams}g）
                </span>
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
