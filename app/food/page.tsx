'use client';
import { useEffect, useRef, useState } from 'react';
import { useStore, FoodEntry, SavedFood, SavedIngredient, FavoriteGroup, MicroNutrients } from '@/lib/store';
import { MICRO_DEFS } from '@/lib/micros';
import { getRemainingCount, incrementUsage, getUserApiKey } from '@/lib/apiCounter';

const MEAL_LABELS: Record<string, string> = { breakfast: '朝食', lunch: '昼食', dinner: '夕食', snack: '間食' };

const FOOD_CATEGORIES = ['主食', '主菜', '副菜', '乳製品', '果物', '飲み物', 'お菓子・間食', 'サプリ', 'プロバイオティクス', 'その他'] as const;
type FoodCategory = typeof FOOD_CATEGORIES[number];

import { localDate, localDateOffset } from '@/lib/date';
function todayStr() { return localDate(); }
function tomorrowStr() { return localDateOffset(1); }

interface Ingredient { name: string; grams: number; calories: number; protein: number; fat: number; carbs: number; micros?: MicroNutrients; servingUnit?: string; }
interface AIFood { name: string; note?: string; ingredients: Ingredient[]; }

function scaleMicros(m: MicroNutrients | undefined, r: number): MicroNutrients | undefined {
  if (!m) return undefined;
  const s = (v?: number) => v != null ? Math.round(v * r * 10) / 10 : undefined;
  return { fiber: s(m.fiber), vitaminD: s(m.vitaminD), vitaminB12: s(m.vitaminB12), vitaminC: s(m.vitaminC), iron: s(m.iron), calcium: s(m.calcium), zinc: s(m.zinc), omega3: s(m.omega3), sodium: s(m.sodium), vitaminE: s(m.vitaminE), vitaminA: s(m.vitaminA), biotin: s(m.biotin), vitaminB2: s(m.vitaminB2), niacin: s(m.niacin), pantothenicAcid: s(m.pantothenicAcid), magnesium: s(m.magnesium), selenium: s(m.selenium), vitaminK2: s(m.vitaminK2), vitaminB6: s(m.vitaminB6), folate: s(m.folate) };
}
function addMicros(a: MicroNutrients, b: MicroNutrients | undefined): MicroNutrients {
  const add = (x?: number, y?: number) => x != null || y != null ? Math.round(((x ?? 0) + (y ?? 0)) * 10) / 10 : undefined;
  return { fiber: add(a.fiber, b?.fiber), vitaminD: add(a.vitaminD, b?.vitaminD), vitaminB12: add(a.vitaminB12, b?.vitaminB12), vitaminC: add(a.vitaminC, b?.vitaminC), iron: add(a.iron, b?.iron), calcium: add(a.calcium, b?.calcium), zinc: add(a.zinc, b?.zinc), omega3: add(a.omega3, b?.omega3), sodium: add(a.sodium, b?.sodium), vitaminE: add(a.vitaminE, b?.vitaminE), vitaminA: add(a.vitaminA, b?.vitaminA), biotin: add(a.biotin, b?.biotin), vitaminB2: add(a.vitaminB2, b?.vitaminB2), niacin: add(a.niacin, b?.niacin), pantothenicAcid: add(a.pantothenicAcid, b?.pantothenicAcid), magnesium: add(a.magnesium, b?.magnesium), selenium: add(a.selenium, b?.selenium), vitaminK2: add(a.vitaminK2, b?.vitaminK2), vitaminB6: add(a.vitaminB6, b?.vitaminB6), folate: add(a.folate, b?.folate) };
}
function scaleIngredient(ing: Ingredient, newGrams: number): Ingredient {
  if (ing.grams === 0) return { ...ing, grams: newGrams };
  const r = newGrams / ing.grams;
  return { ...ing, grams: newGrams, calories: Math.round(ing.calories * r), protein: Math.round(ing.protein * r * 10) / 10, fat: Math.round(ing.fat * r * 10) / 10, carbs: Math.round(ing.carbs * r * 10) / 10, micros: scaleMicros(ing.micros, r) };
}
function sumIngredients(ings: Ingredient[]) {
  return ings.reduce((acc, i) => ({
    calories: acc.calories + i.calories,
    protein: Math.round((acc.protein + i.protein) * 10) / 10,
    fat: Math.round((acc.fat + i.fat) * 10) / 10,
    carbs: Math.round((acc.carbs + i.carbs) * 10) / 10,
    grams: acc.grams + i.grams,
    micros: addMicros(acc.micros, i.micros),
  }), { calories: 0, protein: 0, fat: 0, carbs: 0, grams: 0, micros: {} as MicroNutrients });
}
function calcNutrition(per100g: SavedFood['per100g'], grams: number) {
  const r = grams / 100;
  return { calories: Math.round(per100g.calories * r), protein: Math.round(per100g.protein * r * 10) / 10, fat: Math.round(per100g.fat * r * 10) / 10, carbs: Math.round(per100g.carbs * r * 10) / 10 };
}
function calcFoodMicros(saved: SavedFood, grams: number): MicroNutrients {
  if (!saved.ingredients || saved.ingredients.length === 0 || saved.grams === 0) return {};
  const totalMicros = sumIngredients(saved.ingredients as Ingredient[]).micros;
  return scaleMicros(totalMicros, grams / saved.grams) ?? {};
}
function sumGroupNutrition(group: FavoriteGroup, savedFoods: SavedFood[]) {
  const items = group.itemIds.map(id => savedFoods.find(f => f.id === id)).filter(Boolean) as SavedFood[];
  return items.reduce((acc, f) => {
    const g = group.itemGrams?.[f.id] ?? f.grams;
    const n = calcNutrition(f.per100g, g);
    const m = calcFoodMicros(f, g);
    return {
      calories: acc.calories + n.calories,
      protein: Math.round((acc.protein + n.protein) * 10) / 10,
      fat: Math.round((acc.fat + n.fat) * 10) / 10,
      carbs: Math.round((acc.carbs + n.carbs) * 10) / 10,
      micros: addMicros(acc.micros, m),
    };
  }, { calories: 0, protein: 0, fat: 0, carbs: 0, micros: {} as MicroNutrients });
}

function SwipeToDelete({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
  const [offsetX, setOffsetX] = useState(0);
  const startXRef = useRef(0);
  const THRESHOLD = 60;
  const MAX = 80;

  function handleTouchStart(e: React.TouchEvent) {
    startXRef.current = e.touches[0].clientX;
  }
  function handleTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startXRef.current;
    if (dx < 0) setOffsetX(Math.max(dx, -MAX));
  }
  function handleTouchEnd() {
    if (offsetX < -THRESHOLD) setOffsetX(-MAX);
    else setOffsetX(0);
  }
  function handleReset() { setOffsetX(0); }

  return (
    <div className="relative overflow-hidden" onClick={offsetX < 0 ? handleReset : undefined}>
      {/* 削除ボタン（後ろ側） */}
      <div className="absolute right-0 top-0 h-full w-20 flex items-stretch">
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="w-full bg-red-500 text-white text-sm font-bold flex items-center justify-center active:bg-red-600">
          削除
        </button>
      </div>
      {/* スライドするコンテンツ */}
      <div
        style={{ transform: `translateX(${offsetX}px)`, transition: offsetX === 0 ? 'transform 0.25s' : 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative bg-white z-10">
        {children}
      </div>
    </div>
  );
}

function GramsInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [val, setVal] = useState(String(value));
  useEffect(() => setVal(String(value)), [value]);
  function apply() { const g = parseFloat(val); if (!isNaN(g) && g > 0) onChange(g); else setVal(String(value)); }
  return (
    <input className="w-16 text-center text-sm bg-white border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
      type="number" value={val} onChange={e => setVal(e.target.value)} onBlur={apply} onKeyDown={e => e.key === 'Enter' && apply()} />
  );
}

function NutrientInput({ label, value, unit, onChange }: { label: string; value: number; unit?: string; onChange: (v: number) => void }) {
  const [val, setVal] = useState(String(value));
  useEffect(() => setVal(String(value)), [value]);
  function apply() { const n = parseFloat(val); if (!isNaN(n) && n >= 0) onChange(n); else setVal(String(value)); }
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-0">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="flex items-center gap-0.5">
        <input className="w-14 text-center text-xs bg-white border border-gray-200 rounded-md py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
          type="number" min={0} value={val} onChange={e => setVal(e.target.value)} onBlur={apply} onKeyDown={e => e.key === 'Enter' && apply()} />
        {unit && <span className="text-xs text-gray-400">{unit}</span>}
      </div>
    </div>
  );
}

function CountInput({ value, onChange, unit }: { value: number; onChange: (v: number) => void; unit: string }) {
  const [val, setVal] = useState(String(value));
  useEffect(() => setVal(String(value)), [value]);
  function apply() { const n = parseFloat(val); if (!isNaN(n) && n > 0) onChange(n); else setVal(String(value)); }
  return (
    <div className="flex items-center gap-1">
      <input className="w-14 text-center text-sm bg-white border border-purple-200 rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-purple-400"
        type="number" min={1} step={1} value={val} onChange={e => setVal(e.target.value)} onBlur={apply} onKeyDown={e => e.key === 'Enter' && apply()} />
      <span className="text-xs text-gray-500">{unit}</span>
    </div>
  );
}

interface SupplementInfo { servingUnit: string; gramsPerUnit: number; }

function EditableFoodCard({ food, meal, onFavorite, onSave, onOnce, isSupplement, isAdded }: {
  food: AIFood; meal: string;
  onFavorite: (food: AIFood, ingredients: Ingredient[], suppInfo?: SupplementInfo, category?: string) => void;
  onSave: (food: AIFood, ingredients: Ingredient[], suppInfo?: SupplementInfo, category?: string) => void;
  onOnce: (food: AIFood, ingredients: Ingredient[], suppInfo?: SupplementInfo) => void;
  isSupplement?: boolean;
  isAdded?: boolean;
}) {
  const [ingredients, setIngredients] = useState<Ingredient[]>(food.ingredients);
  const [baseIngredients, setBaseIngredients] = useState<Ingredient[]>(food.ingredients);
  const [counts, setCounts] = useState<number[]>(food.ingredients.map(() => 1));
  const [newIngName, setNewIngName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [expandedIng, setExpandedIng] = useState<number | null>(null);
  const [loadingIng, setLoadingIng] = useState(false);
  const { customCategories: storeCustomCats, addCustomCategory: storeAddCat } = useStore();
  const editableCategories = storeCustomCats.length > 0 ? storeCustomCats : [...FOOD_CATEGORIES];
  const [category, setCategory] = useState<string>(isSupplement ? 'サプリ' : 'その他');
  const [newCatInput, setNewCatInput] = useState('');
  const [showCatAdd, setShowCatAdd] = useState(false);

  async function addIngredientWithAI() {
    const name = newIngName.trim();
    if (!name) return;
    setLoadingIng(true);
    try {
      const res = await fetch('/api/gemini/food', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `${name} 100g` }),
      });
      const data = await res.json();
      if (data.foods?.[0]) {
        const totals = sumIngredients(data.foods[0].ingredients as Ingredient[]);
        setIngredients(prev => [...prev, { name, grams: totals.grams || 100, calories: totals.calories, protein: totals.protein, fat: totals.fat, carbs: totals.carbs, micros: totals.micros }]);
      } else {
        setIngredients(prev => [...prev, { name, grams: 100, calories: 0, protein: 0, fat: 0, carbs: 0 }]);
      }
    } catch {
      setIngredients(prev => [...prev, { name, grams: 100, calories: 0, protein: 0, fat: 0, carbs: 0 }]);
    } finally {
      setLoadingIng(false); setNewIngName(''); setShowAdd(false);
    }
  }

  // サプリ: baseを粒数でスケール / 食品: ingredients直接
  const displayIngredients = isSupplement
    ? baseIngredients.map((ing, i) => {
        const c = counts[i] || 1;
        return c === 1 ? ing : scaleIngredient(ing, c * ing.grams);
      })
    : ingredients;
  const totals = sumIngredients(displayIngredients);

  function updateGrams(idx: number, g: number) {
    setIngredients(prev => prev.map((ing, i) => i === idx ? scaleIngredient(ing, g) : ing));
  }
  function updateCount(idx: number, c: number) {
    setCounts(prev => prev.map((v, i) => i === idx ? c : v));
  }
  function updateNutrient(idx: number, field: 'calories' | 'protein' | 'fat' | 'carbs', value: number) {
    if (isSupplement) {
      setBaseIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, [field]: value } : ing));
    } else {
      setIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, [field]: value } : ing));
    }
  }

  return (
    <div className={`border rounded-xl p-4 transition ${isSupplement ? 'border-purple-100 hover:border-purple-300' : 'border-gray-100 hover:border-blue-200'}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-semibold text-gray-900">{food.name}</p>
          {food.note && <p className={`text-xs mt-0.5 ${isSupplement ? 'text-purple-400' : 'text-gray-400'}`}>{food.note}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-gray-900">{totals.calories} kcal</p>
          {!isSupplement && <p className="text-xs text-gray-400">{totals.grams}g</p>}
        </div>
      </div>
      {/* カテゴリ選択 */}
      <div className="mb-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 flex-shrink-0">カテゴリ</span>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
            {editableCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={() => setShowCatAdd(!showCatAdd)}
            className="text-xs text-blue-500 hover:text-blue-600 px-1 shrink-0">＋追加</button>
        </div>
        {showCatAdd && (
          <div className="flex gap-1">
            <input value={newCatInput} onChange={e => setNewCatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const n = newCatInput.trim();
                  if (n && !editableCategories.includes(n)) { storeAddCat(n); setCategory(n); }
                  setNewCatInput(''); setShowCatAdd(false);
                }
              }}
              placeholder="新しいカテゴリ名..."
              className="flex-1 text-xs border border-blue-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400" />
            <button onClick={() => {
              const n = newCatInput.trim();
              if (n && !editableCategories.includes(n)) { storeAddCat(n); setCategory(n); }
              setNewCatInput(''); setShowCatAdd(false);
            }} className="text-xs bg-blue-500 text-white px-2 py-1 rounded-lg">OK</button>
          </div>
        )}
      </div>

      <div className="bg-gray-50 rounded-xl p-3 mb-3">
        <p className="text-xs font-semibold text-gray-500 mb-2">
          {isSupplement ? '服用量（粒数を変更できます）' : '具材（Enterまたはフォーカスを外して確定）'}
        </p>
        <div className="space-y-2">
          {(isSupplement ? baseIngredients : ingredients).map((ing, i) => {
            const disp = displayIngredients[i] ?? ing;
            const isExpanded = expandedIng === i;
            return (
              <div key={i}>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 flex-1 truncate">{ing.name}</span>
                  {isSupplement ? (
                    <CountInput value={counts[i] || 1} onChange={c => updateCount(i, c)} unit={ing.servingUnit || '粒'} />
                  ) : (
                    <>
                      <GramsInput value={ing.grams} onChange={g => updateGrams(i, g)} />
                      <span className="text-xs text-gray-400">g</span>
                    </>
                  )}
                  <span className="text-xs text-gray-500 w-14 text-right">{disp.calories}kcal</span>
                  <button onClick={() => setExpandedIng(isExpanded ? null : i)} className="text-gray-300 hover:text-blue-400 text-xs transition">{isExpanded ? '▲' : '▼'}</button>
                  {!isSupplement && (
                    <button onClick={() => setIngredients(prev => prev.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400 transition text-sm">✕</button>
                  )}
                </div>
                {isExpanded && (
                  <div className="mt-1.5 mb-1 ml-2 pl-2 border-l-2 border-blue-100 flex flex-wrap gap-2">
                    <NutrientInput label="kcal" value={ing.calories} onChange={v => updateNutrient(i, 'calories', v)} />
                    <NutrientInput label="P" unit="g" value={ing.protein} onChange={v => updateNutrient(i, 'protein', v)} />
                    <NutrientInput label="F" unit="g" value={ing.fat} onChange={v => updateNutrient(i, 'fat', v)} />
                    <NutrientInput label="C" unit="g" value={ing.carbs} onChange={v => updateNutrient(i, 'carbs', v)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {!isSupplement && (showAdd ? (
          <div className="flex gap-2 mt-2">
            <input className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
              placeholder="具材名を入力してAIが栄養素を取得" value={newIngName} onChange={e => setNewIngName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addIngredientWithAI()} autoFocus disabled={loadingIng} />
            <button onClick={addIngredientWithAI} disabled={loadingIng || !newIngName.trim()}
              className="text-xs bg-blue-600 text-white px-2 py-1 rounded-lg disabled:opacity-50 min-w-[3rem] text-center">
              {loadingIng ? '…' : '追加'}
            </button>
            <button onClick={() => { setShowAdd(false); setNewIngName(''); }} className="text-xs text-gray-400">✕</button>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)} className="mt-2 text-xs text-blue-600 font-semibold w-full text-center py-1">+ 具材を追加</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mb-3">
        {!isSupplement && <>
          <span className="text-blue-600 font-semibold">P {totals.protein}g</span>
          <span className="text-yellow-600 font-semibold">F {totals.fat}g</span>
          <span className="text-green-600 font-semibold">C {totals.carbs}g</span>
        </>}
        {MICRO_DEFS.map(d => { const v = totals.micros?.[d.key] ?? 0; return v > 0 ? <span key={d.key} className={`font-semibold ${isSupplement ? 'text-purple-600' : 'text-purple-500'}`}>{d.label} {v}{d.unit}</span> : null; })}
      </div>
      {(() => {
        const suppInfo: SupplementInfo | undefined = isSupplement && baseIngredients[0]
          ? { servingUnit: baseIngredients[0].servingUnit || '粒', gramsPerUnit: baseIngredients[0].grams || 1 }
          : undefined;
        return (
          <div className="flex gap-1.5">
            <button onClick={() => onFavorite(food, displayIngredients, suppInfo, category)}
              className="flex-1 bg-yellow-50 border border-yellow-200 text-yellow-700 py-2 rounded-lg text-xs font-semibold hover:bg-yellow-100 transition">
              ★ お気に入り
            </button>
            <button onClick={() => onSave(food, displayIngredients, suppInfo, category)}
              className="flex-1 bg-gray-50 border border-gray-200 text-gray-600 py-2 rounded-lg text-xs font-semibold hover:bg-gray-100 transition">
              📁 保存
            </button>
            <button onClick={() => onOnce(food, displayIngredients, suppInfo)}
              className={`flex-1 text-white py-2 rounded-lg text-xs font-semibold transition ${isAdded ? 'bg-green-500' : isSupplement ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {isAdded ? '✓ 追加済み' : '今回だけ'}
            </button>
          </div>
        );
      })()}
    </div>
  );
}

function SavedFoodCard({ saved, meal, onAdd, onToggleFav, allCategories, onCategoryChange }: {
  saved: SavedFood; meal: string;
  onAdd: (s: SavedFood, g: number) => void;
  onToggleFav: (id: string) => void;
  allCategories?: string[];
  onCategoryChange?: (id: string, category: string) => void;
}) {
  const isSupp = !!saved.servingUnit && !!saved.gramsPerUnit;
  const defaultCount = isSupp && saved.gramsPerUnit ? Math.max(1, Math.round(saved.grams / saved.gramsPerUnit)) : 1;
  const [grams, setGrams] = useState(saved.grams);
  const [count, setCount] = useState(defaultCount);
  const [open, setOpen] = useState(false);

  function handleCountChange(c: number) {
    setCount(c);
    if (saved.gramsPerUnit) setGrams(Math.round(c * saved.gramsPerUnit * 10) / 10);
  }

  const n = calcNutrition(saved.per100g, grams);

  return (
    <div className="border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2 py-2">
        <button onClick={() => onToggleFav(saved.id)} className="text-base flex-shrink-0">{saved.isFavorite ? '★' : '☆'}</button>
        <button onClick={() => setOpen(o => !o)} className="flex-1 text-left min-w-0">
          <span className="text-sm text-gray-800 truncate block">{saved.foodName}</span>
        </button>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isSupp ? (
            <CountInput value={count} onChange={handleCountChange} unit={saved.servingUnit!} />
          ) : (
            <>
              <GramsInput value={grams} onChange={setGrams} />
              <span className="text-xs text-gray-400">g</span>
            </>
          )}
        </div>
        <span className="text-xs font-semibold text-gray-700 w-16 text-right flex-shrink-0">{n.calories}kcal</span>
        <button onClick={() => setOpen(o => !o)} className="text-gray-400 text-xs flex-shrink-0">{open ? '▲' : '▼'}</button>
        <button onClick={() => onAdd(saved, grams)} className={`text-white text-xs px-2 py-1.5 rounded-lg font-semibold flex-shrink-0 ${isSupp ? 'bg-purple-600' : 'bg-blue-600'}`}>追加</button>
      </div>
      {open && (() => {
        const micros = calcFoodMicros(saved, grams);
        const hasMicros = MICRO_DEFS.some(d => (micros[d.key] ?? 0) > 0);
        return (
          <div className="bg-gray-50 rounded-xl mx-1 mb-2 px-3 py-2 text-xs text-gray-600 space-y-1.5">
            {saved.ingredients && saved.ingredients.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">具材</p>
                {saved.ingredients.map((ing, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-gray-600">{ing.name}</span>
                    <span className="text-gray-400">{ing.grams}g / {ing.calories}kcal</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 mt-1.5 pt-1.5">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <span className="font-semibold text-blue-600">P {n.protein}g</span>
                    <span className="font-semibold text-yellow-600">F {n.fat}g</span>
                    <span className="font-semibold text-green-600">C {n.carbs}g</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span className="font-semibold text-blue-600">P {n.protein}g</span>
                <span className="font-semibold text-yellow-600">F {n.fat}g</span>
                <span className="font-semibold text-green-600">C {n.carbs}g</span>
              </div>
            )}
            {hasMicros && (
              <div className="border-t border-gray-100 pt-1.5 flex flex-wrap gap-x-2 gap-y-1">
                {MICRO_DEFS.map(d => {
                  const v = micros[d.key] ?? 0;
                  return v > 0 ? (
                    <span key={d.key} className="text-purple-600 font-semibold">{d.label} {v}{d.unit}</span>
                  ) : null;
                })}
              </div>
            )}
            {saved.note && <p className="text-gray-400 pt-1 border-t border-gray-100">{saved.note}</p>}
            <p className="text-gray-300">最終使用: {saved.lastUsed} / {saved.useCount}回</p>
            {allCategories && onCategoryChange && (
              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                <span className="text-gray-400 flex-shrink-0">カテゴリ</span>
                <select
                  value={saved.category || 'その他'}
                  onChange={e => onCategoryChange(saved.id, e.target.value)}
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                  {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function TodayEntryRow({ entry, onRemove, onUpdate, isFav, onFav }: {
  entry: FoodEntry; onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<FoodEntry>) => void;
  isFav: boolean; onFav: () => void;
}) {
  function handleGramsChange(g: number) {
    if (g === entry.grams) return;
    const r = g / entry.grams;
    onUpdate(entry.id, { grams: g, calories: Math.round(entry.calories * r), protein: Math.round(entry.protein * r * 10) / 10, fat: Math.round(entry.fat * r * 10) / 10, carbs: Math.round(entry.carbs * r * 10) / 10, micros: entry.micros ? scaleMicros(entry.micros, r) : undefined });
  }
  return (
    <div className="py-2 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${entry.meal === 'breakfast' ? 'bg-orange-100 text-orange-600' : entry.meal === 'lunch' ? 'bg-green-100 text-green-600' : entry.meal === 'dinner' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>{MEAL_LABELS[entry.meal]}</span>
        <span className="flex-1 text-sm text-gray-700 truncate">
          {entry.time && <span className="text-xs text-gray-400 mr-1">{entry.time}</span>}
          {entry.foodName}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <GramsInput value={entry.grams} onChange={handleGramsChange} />
          <span className="text-xs text-gray-400">g</span>
        </div>
        <span className="text-sm font-semibold flex-shrink-0">{entry.calories}kcal</span>
        <button onClick={onFav} className="text-base leading-none flex-shrink-0">{isFav ? '★' : '☆'}</button>
        <button onClick={() => onRemove(entry.id)} className="text-gray-300 hover:text-red-400 flex-shrink-0">✕</button>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400 mt-0.5 ml-2 pl-14">
        <span>P {entry.protein}g</span><span>F {entry.fat}g</span><span>C {entry.carbs}g</span>
        {MICRO_DEFS.map(d => { const v = entry.micros?.[d.key] ?? (d.key === 'fiber' ? entry.fiber : undefined) ?? 0; return v > 0 ? <span key={d.key} className="text-purple-400">{d.label} {v}{d.unit}</span> : null; })}
      </div>
    </div>
  );
}

export default function FoodPage() {
  const { foodEntries, savedFoods, favoriteGroups, customCategories, addFood, removeFood, updateFood, saveFoodToHistory, removeSavedFood, updateSavedFoodCategory, addCustomCategory, removeCustomCategory, toggleFavorite, addFavoriteGroup, updateFavoriteGroup, removeFavoriteGroup, hydrate } = useStore();
  const [tab, setTab] = useState<'ai' | 'favorites' | 'history' | 'categories'>('ai');
  const [query, setQuery] = useState('');
  function mealFromTime(time: string): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
    const h = parseInt(time.split(':')[0]);
    if (h >= 5  && h < 10) return 'breakfast';
    if (h >= 10 && h < 15) return 'lunch';
    if (h >= 17 && h < 22) return 'dinner';
    return 'snack';
  }
  const [eatTime, setEatTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [meal, setMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(
    () => mealFromTime(new Date().toTimeString().slice(0, 5))
  );
  const [eatDate, setEatDate] = useState(() => todayStr());
  const [results, setResults] = useState<AIFood[]>([]);
  const [addedFoods, setAddedFoods] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(20);
  const [error, setError] = useState('');
  const [searchMode, setSearchMode] = useState<'food' | 'supplement'>('food');
  // グループ管理
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [editingCatName, setEditingCatName] = useState<{ original: string; value: string } | null>(null);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(['__favs__']));

  // customCategories のみを使用（初回は FOOD_CATEGORIES で初期化）
  const allCategories: string[] = customCategories.length > 0 ? customCategories : [...FOOD_CATEGORIES];
  function toggleCategory(cat: string) {
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  useEffect(() => {
    hydrate();
    setRemaining(getRemainingCount());
  }, []);

  // デフォルトカテゴリをストアに移行（v2: 既存フラグを無視して再実行）
  useEffect(() => {
    const migrated = localStorage.getItem('food_cats_migrated_v2');
    if (!migrated) {
      const stored = localStorage.getItem('ct_custom_cats');
      const existing: string[] = stored ? JSON.parse(stored) : [];
      FOOD_CATEGORIES.forEach(c => {
        if (!existing.includes(c)) addCustomCategory(c);
      });
      localStorage.setItem('food_cats_migrated_v2', '1');
    }
  }, []);

  const todayEntries = foodEntries.filter(e => e.date === eatDate);
  const totalCal = todayEntries.reduce((s, e) => s + e.calories, 0);
  const totalProtein = todayEntries.reduce((s, e) => s + e.protein, 0);
  const favorites = savedFoods.filter(f => f.isFavorite);
  const history = [...savedFoods].reverse();

  // 全保存食品をカテゴリ別に分類（フラット）
  const allByCategory: Record<string, SavedFood[]> = {};
  for (const f of savedFoods) {
    const cat = f.category || 'その他';
    if (!allByCategory[cat]) allByCategory[cat] = [];
    allByCategory[cat].push(f);
  }
  const displayCategoriesAll = [
    ...allCategories.filter(c => allByCategory[c]),
    ...Object.keys(allByCategory).filter(c => !(allCategories as string[]).includes(c)),
  ];

  const now = new Date(); const hour = now.getHours();
  const nextProteinTiming = hour < 10 ? { time: '朝食', suggestion: '朝食でタンパク質を摂りましょう' } : hour < 13 ? { time: '昼食', suggestion: '昼食でタンパク質を摂りましょう' } : hour < 16 ? { time: '間食（14〜16時）', suggestion: 'プロテインや乳製品で補給を' } : hour < 19 ? { time: '夕食', suggestion: '夕食でタンパク質を摂りましょう' } : hour < 22 ? { time: '夕食後間食', suggestion: 'カゼインプロテインや乳製品を' } : null;

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true); setError(''); setResults([]); setAddedFoods(new Set());
    try {
      const res = await fetch('/api/gemini/food', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, mode: searchMode, apiKey: getUserApiKey() }) });
      const data = await res.json();
      if (data.foods) {
        setResults(data.foods);
        const r = incrementUsage();
        setRemaining(Math.max(0, 20 - r.count));
      } else setError(data.detail || data.error || '取得に失敗しました');
    } catch (err: any) { setError(err?.message || 'エラーが発生しました'); }
    finally { setLoading(false); }
  }

  function buildEntry(name: string, totals: ReturnType<typeof sumIngredients>, note?: string): FoodEntry {
    return { id: Date.now().toString(), date: eatDate, time: eatTime, meal, foodName: name, grams: totals.grams, calories: totals.calories, protein: totals.protein, fat: totals.fat, carbs: totals.carbs, micros: totals.micros };
  }

  function buildSavedFood(food: AIFood, ingredients: Ingredient[], suppInfo?: SupplementInfo, category?: string): SavedFood {
    const totals = sumIngredients(ingredients);
    const per100g = totals.grams > 0 ? { calories: Math.round(totals.calories / totals.grams * 100), protein: Math.round(totals.protein / totals.grams * 100 * 10) / 10, fat: Math.round(totals.fat / totals.grams * 100 * 10) / 10, carbs: Math.round(totals.carbs / totals.grams * 100 * 10) / 10 } : { calories: 0, protein: 0, fat: 0, carbs: 0 };
    return { id: food.name, foodName: food.name, grams: totals.grams, per100g, ingredients: ingredients as SavedIngredient[], note: food.note, isFavorite: true, lastUsed: eatDate, useCount: 1, servingUnit: suppInfo?.servingUnit, gramsPerUnit: suppInfo?.gramsPerUnit, category };
  }

  // ★ お気に入り: ログ追加 + お気に入りとして保存
  function handleFavorite(food: AIFood, ingredients: Ingredient[], suppInfo?: SupplementInfo, category?: string) {
    const totals = sumIngredients(ingredients);
    addFood(buildEntry(food.name, totals, food.note));
    saveFoodToHistory({ ...buildSavedFood(food, ingredients, suppInfo, category), isFavorite: true });
    setAddedFoods(prev => new Set([...prev, food.name]));
  }

  // 📁 保存: ログ追加 + カテゴリ保存（お気に入りなし）
  function handleSave(food: AIFood, ingredients: Ingredient[], suppInfo?: SupplementInfo, category?: string) {
    const totals = sumIngredients(ingredients);
    addFood(buildEntry(food.name, totals, food.note));
    saveFoodToHistory({ ...buildSavedFood(food, ingredients, suppInfo, category), isFavorite: false });
    setAddedFoods(prev => new Set([...prev, food.name]));
  }

  // 今回だけ: ログ追加のみ（保存しない）
  function handleOnce(food: AIFood, ingredients: Ingredient[], suppInfo?: SupplementInfo) {
    const totals = sumIngredients(ingredients);
    addFood(buildEntry(food.name, totals, food.note));
    setAddedFoods(prev => new Set([...prev, food.name]));
  }

  function handleAddSaved(saved: SavedFood, grams: number) {
    const n = calcNutrition(saved.per100g, grams);
    const micros = calcFoodMicros(saved, grams);
    const microsField = Object.values(micros).some(v => v != null && v !== 0) ? micros : undefined;
    addFood({ id: Date.now().toString(), date: eatDate, time: eatTime, meal, foodName: saved.foodName, grams, ...n, micros: microsField });
    saveFoodToHistory({ ...saved, grams, lastUsed: eatDate, useCount: saved.useCount + 1 });
  }

  function handleAddGroup(group: FavoriteGroup) {
    const items = group.itemIds.map(id => savedFoods.find(f => f.id === id)).filter(Boolean) as SavedFood[];
    items.forEach(saved => handleAddSaved(saved, group.itemGrams?.[saved.id] ?? saved.grams));
  }

  function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    addFavoriteGroup({ id: Date.now().toString(), name: newGroupName.trim(), itemIds: [] });
    setNewGroupName('');
  }

  function toggleGroupItem(groupId: string, itemId: string) {
    const group = favoriteGroups.find(g => g.id === groupId);
    if (!group) return;
    const itemIds = group.itemIds.includes(itemId) ? group.itemIds.filter(i => i !== itemId) : [...group.itemIds, itemId];
    updateFavoriteGroup(groupId, { itemIds });
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">食事記録</h1>
      <div className="bg-white rounded-2xl px-5 py-3 mb-4 shadow-sm flex justify-between items-center">
        <span className="text-sm text-gray-400">合計</span>
        <span className="text-xl font-bold">{totalCal.toLocaleString()} kcal</span>
      </div>

      {/* 食事タイミング・時間・日付 */}
      <div className="bg-white rounded-2xl px-4 py-3 mb-4 shadow-sm space-y-2">
        <div className="flex gap-2 items-center">
          {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(m => (
            <button key={m} onClick={() => setMeal(m)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${meal === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {MEAL_LABELS[m]}
            </button>
          ))}
          <input type="time" value={eatTime} onChange={e => { setEatTime(e.target.value); setMeal(mealFromTime(e.target.value)); }}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 flex-shrink-0" />
        </div>
        {/* 日付選択 */}
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            {[{ label: '今日', val: todayStr() }, { label: '明日', val: tomorrowStr() }].map(({ label, val }) => (
              <button key={val} onClick={() => setEatDate(val)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${eatDate === val ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {label}
              </button>
            ))}
            <input type="date" value={eatDate} onChange={e => setEatDate(e.target.value)}
              className={`flex-1 border rounded-lg px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 transition
                ${eatDate !== todayStr() && eatDate !== tomorrowStr() ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`} />
          </div>
          {eatDate !== todayStr() && (
            <p className="text-xs text-blue-500 font-semibold pl-1">📅 {eatDate} に記録します</p>
          )}
        </div>
      </div>

      {/* タブ */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl">
        {([['ai', '✨ AI検索'], ['favorites', '★ お気に入り'], ['history', '🕐 履歴'], ['categories', '📂 カテゴリ']] as const).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${tab === t ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* AI検索 */}
      {tab === 'ai' && (
        <div className="bg-white rounded-2xl p-5 mb-5 shadow-sm">
          {/* 食品/サプリ切り替え */}
          <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-xl">
            <button onClick={() => { setSearchMode('food'); setResults([]); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${searchMode === 'food' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>
              🍚 食品・料理
            </button>
            <button onClick={() => { setSearchMode('supplement'); setResults([]); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${searchMode === 'supplement' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500'}`}>
              💊 サプリ
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            {searchMode === 'food'
              ? '例:「ラーメン大盛り」「サラダチキン1個」「トースト2枚と目玉焼き」'
              : '例:「ビタミンD」「魚油 EPA DHA」「マルチビタミン」「亜鉛サプリ」'}
          </p>
          <div className="flex gap-2">
            <input className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder={searchMode === 'food' ? '食品名・料理名・自然文で入力...' : 'サプリメント名で入力...'}
              value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            <button onClick={handleSearch} disabled={loading}
              className={`text-white px-5 py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition ${searchMode === 'supplement' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {loading ? '...' : '検索'}
            </button>
          </div>
          <div className="flex justify-end mt-1.5">
            <span className={`text-sm font-semibold px-2.5 py-1 rounded-lg ${remaining <= 5 ? 'bg-red-100 text-red-500' : remaining <= 10 ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'}`}>
              残り {remaining} 回 / 日
            </span>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          {results.length > 0 && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-500">検索結果（{results.length}件）</p>
                <button onClick={() => { setResults([]); setAddedFoods(new Set()); }}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg border border-gray-200">
                  ✕ クリア
                </button>
              </div>
              {results.map((food, i) => (
                <EditableFoodCard key={i} food={food} meal={meal} onFavorite={handleFavorite} onSave={handleSave} onOnce={handleOnce} isSupplement={searchMode === 'supplement'} isAdded={addedFoods.has(food.name)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* お気に入り */}
      {tab === 'favorites' && (
        <div className="space-y-4 mb-5">
          {/* グループセクション */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-600">グループ</p>
            </div>
            {favoriteGroups.length === 0 && <p className="text-xs text-gray-300 mb-3">グループを作成すると複数のメニューをまとめて追加できます</p>}
            <div className="space-y-3 mb-3">
              {favoriteGroups.map((group) => {
                const items = group.itemIds.map(id => savedFoods.find(f => f.id === id)).filter(Boolean) as SavedFood[];
                const totals = sumGroupNutrition(group, savedFoods);
                const hasMicros = MICRO_DEFS.some(d => (totals.micros[d.key] ?? 0) > 0);
                return (
                  <div key={group.id} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold flex-1">{group.name}</span>
                      <span className="text-xs text-gray-400">{items.length}品</span>
                      <button onClick={() => handleAddGroup(group)}
                        className="bg-blue-600 text-white text-xs px-2 py-1 rounded-lg font-semibold">一括追加</button>
                      <button onClick={() => setEditingGroup(editingGroup === group.id ? null : group.id)}
                        className="text-gray-400 text-xs px-1">{editingGroup === group.id ? '完了' : '編集'}</button>
                      <button onClick={() => removeFavoriteGroup(group.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                    </div>
                    {/* 合計PFC */}
                    {items.length > 0 && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2">
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                          <span className="font-bold text-gray-700">{totals.calories} kcal</span>
                          <span className="text-blue-600 font-semibold">P {totals.protein}g</span>
                          <span className="text-yellow-600 font-semibold">F {totals.fat}g</span>
                          <span className="text-green-600 font-semibold">C {totals.carbs}g</span>
                        </div>
                        {hasMicros && (
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                            {MICRO_DEFS.map(d => { const v = totals.micros[d.key] ?? 0; return v > 0 ? <span key={d.key} className="text-xs text-purple-500">{d.label} {v}{d.unit}</span> : null; })}
                          </div>
                        )}
                      </div>
                    )}
                    {/* グループ編集：お気に入りをトグルで追加/削除＋g編集 */}
                    {editingGroup === group.id ? (
                      <div className="border-t border-gray-100 pt-2 mt-1">
                        <p className="text-xs text-gray-400 mb-2">追加するお気に入りを選択・gを調整</p>
                        <div className="space-y-1 max-h-56 overflow-y-auto">
                          {favorites.map(f => {
                            const inGroup = group.itemIds.includes(f.id);
                            const g = group.itemGrams?.[f.id] ?? f.grams;
                            const n = calcNutrition(f.per100g, g);
                            return (
                              <div key={f.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition ${inGroup ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                                <button onClick={() => toggleGroupItem(group.id, f.id)} className={`flex-shrink-0 ${inGroup ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>{inGroup ? '✓' : '○'}</button>
                                <span className={`flex-1 truncate ${inGroup ? 'text-blue-700 font-semibold' : 'text-gray-600'}`}>{f.foodName}</span>
                                {inGroup ? (
                                  <>
                                    <GramsInput value={g} onChange={newG => updateFavoriteGroup(group.id, { itemGrams: { ...group.itemGrams, [f.id]: newG } })} />
                                    <span className="text-gray-400">g</span>
                                    <span className="text-gray-500 w-14 text-right">{n.calories}kcal</span>
                                  </>
                                ) : (
                                  <span className="text-gray-300">{f.grams}g</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      items.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {items.map(f => {
                            const g = group.itemGrams?.[f.id] ?? f.grams;
                            return <span key={f.id} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{f.foodName} {g}g</span>;
                          })}
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
            {/* グループ作成 */}
            <div className="flex gap-2">
              <input className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="新しいグループ名" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateGroup()} />
              <button onClick={handleCreateGroup} className="bg-gray-800 text-white px-3 py-2 rounded-xl text-sm font-semibold">作成</button>
            </div>
          </div>

          {/* ★ いいね（全カテゴリ横断） */}
          {(() => {
            const isOpen = openCategories.has('__favs__');
            return (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <button onClick={() => toggleCategory('__favs__')}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-yellow-50 transition">
                  <span className="text-sm font-semibold text-yellow-600">★ いいね</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{favorites.length}品</span>
                    <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="pb-3 border-t border-yellow-50">
                    {favorites.length === 0
                      ? <p className="text-center text-gray-300 py-4 text-sm">★をつけた食品がありません</p>
                      : favorites.map(f => (
                        <SwipeToDelete key={f.id} onDelete={() => removeSavedFood(f.id)}>
                          <div className="px-4"><SavedFoodCard saved={f} meal={meal} onAdd={handleAddSaved} onToggleFav={toggleFavorite} allCategories={allCategories} onCategoryChange={updateSavedFoodCategory} /></div>
                        </SwipeToDelete>
                      ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* カテゴリ別一覧（全保存食品・フラット） */}
          {savedFoods.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center text-gray-300">
              食品がありません<br/><span className="text-sm">AI検索から追加してください</span>
            </div>
          ) : displayCategoriesAll.map(cat => {
            const items = allByCategory[cat] ?? [];
            const isOpen = openCategories.has(cat);
            return (
              <div key={cat} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <button onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition">
                  <span className="text-sm font-semibold text-gray-700">{cat}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{items.length}品</span>
                    <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="pb-3 border-t border-gray-50 mt-0">
                    {items.map(f => (
                      <SwipeToDelete key={f.id} onDelete={() => removeSavedFood(f.id)}>
                        <div className="px-4"><SavedFoodCard saved={f} meal={meal} onAdd={handleAddSaved} onToggleFav={toggleFavorite} allCategories={allCategories} onCategoryChange={updateSavedFoodCategory} /></div>
                      </SwipeToDelete>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 履歴 */}
      {tab === 'history' && (
        <div className="bg-white rounded-2xl p-4 mb-5 shadow-sm">
          {history.length === 0
            ? <p className="text-center text-gray-300 py-12">履歴がありません</p>
            : history.map(f => (
              <SwipeToDelete key={f.id} onDelete={() => removeSavedFood(f.id)}>
                <SavedFoodCard saved={f} meal={meal} onAdd={handleAddSaved} onToggleFav={toggleFavorite} allCategories={allCategories} onCategoryChange={updateSavedFoodCategory} />
              </SwipeToDelete>
            ))}
        </div>
      )}

      {/* カテゴリ管理 */}
      {tab === 'categories' && (
        <div className="space-y-4 mb-5">
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <div>
              <p className="text-base font-bold text-gray-800">📂 カテゴリ管理</p>
              <p className="text-xs text-gray-400 mt-0.5">お気に入りで使うカテゴリを自由に追加・編集・削除できます</p>
            </div>

            {allCategories.length === 0 ? (
              <p className="text-sm text-gray-300 text-center py-4">カテゴリがありません</p>
            ) : (
              <div className="space-y-2">
                {allCategories.map(cat => {
                  const isEditing = editingCatName?.original === cat;
                  const count = (allByCategory[cat] ?? []).length;
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editingCatName.value}
                          onChange={e => setEditingCatName({ original: cat, value: e.target.value })}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const newName = editingCatName.value.trim();
                              if (newName && newName !== cat && !(allCategories as string[]).includes(newName)) {
                                removeCustomCategory(cat);
                                addCustomCategory(newName);
                              }
                              setEditingCatName(null);
                            }
                            if (e.key === 'Escape') setEditingCatName(null);
                          }}
                          onBlur={() => setEditingCatName(null)}
                          className="flex-1 px-3 py-2 text-sm border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      ) : (
                        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50">
                          <span className="text-sm text-gray-700 flex-1">{cat}</span>
                          {count > 0 && <span className="text-xs text-gray-400">{count}品</span>}
                        </div>
                      )}
                      {!isEditing && (
                        <button onClick={() => setEditingCatName({ original: cat, value: cat })}
                          className="text-gray-400 hover:text-blue-500 text-sm px-2 py-2 rounded-lg hover:bg-gray-50" title="編集">✏️</button>
                      )}
                      <button onClick={() => removeCustomCategory(cat)}
                        className="text-gray-300 hover:text-red-400 text-sm px-2 py-2 rounded-lg hover:bg-red-50" title="削除">✕</button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <input
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="新しいカテゴリ名"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newCatName.trim()) {
                    addCustomCategory(newCatName.trim());
                    setNewCatName('');
                  }
                }} />
              <button
                onClick={() => { if (newCatName.trim()) { addCustomCategory(newCatName.trim()); setNewCatName(''); } }}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold">
                ＋追加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 今日の記録 */}
      {todayEntries.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-500">
              {eatDate === todayStr() ? '今日' : eatDate === tomorrowStr() ? '明日' : eatDate}の記録
            </p>
            <div className="flex gap-3 text-xs text-gray-400">
              <span>P <strong className="text-gray-600">{totalProtein.toFixed(1)}g</strong></span>
            </div>
          </div>
          {nextProteinTiming && eatDate === todayStr() && (
            <div className="bg-blue-50 rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
              <span className="text-blue-500 text-sm">💪</span>
              <div>
                <span className="text-xs font-semibold text-blue-700">次のタンパク質補給: {nextProteinTiming.time}</span>
                <p className="text-xs text-blue-500">{nextProteinTiming.suggestion}</p>
              </div>
            </div>
          )}
          <div className="space-y-0">
            {todayEntries.map(e => {
              const isFav = savedFoods.some(f => f.foodName === e.foodName && f.isFavorite);
              return (
                <TodayEntryRow key={e.id} entry={e} onRemove={removeFood} onUpdate={updateFood} isFav={isFav}
                  onFav={() => saveFoodToHistory({ id: e.id, foodName: e.foodName, grams: e.grams, per100g: { calories: e.grams > 0 ? Math.round(e.calories / e.grams * 100) : 0, protein: e.grams > 0 ? Math.round(e.protein / e.grams * 100 * 10) / 10 : 0, fat: e.grams > 0 ? Math.round(e.fat / e.grams * 100 * 10) / 10 : 0, carbs: e.grams > 0 ? Math.round(e.carbs / e.grams * 100 * 10) / 10 : 0 }, isFavorite: true, lastUsed: e.date, useCount: 1 })}
                />
              );
            })}
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
