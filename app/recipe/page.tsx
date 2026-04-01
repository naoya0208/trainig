'use client';
import { useState, useEffect, useRef } from 'react';
import { MICRO_DEFS } from '@/lib/micros';
import { useStore } from '@/lib/store';
import { localDate } from '@/lib/date';
import type { Profile } from '@/lib/calc';
import InventoryTab, { InventoryItem } from './InventoryTab';
import { fetchRemaining, incrementUsage, getUserApiKey } from '@/lib/apiCounter';

const QUICK_CONDITIONS = ['低コスト', '残り物活用', '時短（15分以内）', '簡単', '作り置き'];
const BASE_NUTRIENTS = ['タンパク質', '脂質', '炭水化物', ...MICRO_DEFS.map((d) => d.label)];

const GOALS = [
  { id: 'diet',    label: '減量・ダイエット', icon: '🔥', desc: '低カロリー・高満足感' },
  { id: 'muscle',  label: '筋肉増量',          icon: '💪', desc: '高タンパク・栄養密度重視' },
  { id: 'beauty',  label: '美容・肌ケア',      icon: '✨', desc: 'コラーゲン・抗酸化栄養素' },
  { id: 'health',  label: '健康維持',          icon: '🌿', desc: 'バランス重視' },
  { id: 'fatigue', label: '疲労回復',          icon: '⚡', desc: 'ビタミンB群・鉄分' },
  { id: 'immune',  label: '免疫強化',          icon: '🛡️', desc: 'ビタミンC・亜鉛' },
] as const;
type GoalId = typeof GOALS[number]['id'];

const MEAL_OPTIONS = [
  { id: 'breakfast', label: '朝食' },
  { id: 'lunch',     label: '昼食' },
  { id: 'dinner',    label: '夕食' },
  { id: 'snack',     label: '間食' },
] as const;

function profileToGoal(profile: Profile | null): GoalId | null {
  if (!profile) return null;
  // goalType を最優先（減量中は目的に関わらずダイエット）
  if (profile.goalType === 'lose') return 'diet';
  if (profile.goalPurpose === 'beauty') return 'beauty';
  if (profile.goalPurpose === 'muscle' || profile.goalType === 'gain') return 'muscle';
  return 'health';
}

const DEFAULT_CATEGORIES = ['朝食', '昼食', '夕食', '作り置き', 'おやつ', 'その他'];
const STORAGE_NUTRIENTS  = 'recipe_custom_nutrients';
const STORAGE_SAVED      = 'recipe_saved';
const STORAGE_CATEGORIES = 'recipe_all_categories';

interface Nutrition { calories: number; protein: number; fat: number; carbs: number; }

interface Dish {
  name: string;
  description: string;
  nutrients: string[];
  time: string;
  cost: string;
  nutrition?: Nutrition;
}

interface Micros {
  fiber?: number; vitaminC?: number; vitaminD?: number; vitaminB12?: number;
  vitaminE?: number; vitaminA?: number; vitaminB6?: number; iron?: number;
  calcium?: number; zinc?: number; magnesium?: number; folate?: number; omega3?: number;
}

interface DishDetail {
  ingredients: string[];
  steps: string[];
  tips: string;
  servings: string;
  searchUrl: string;
  micros?: Micros;
}

const MICRO_DISPLAY: { key: keyof Micros; label: string; unit: string; daily: number }[] = [
  { key: 'vitaminC',   label: 'ビタミンC',   unit: 'mg', daily: 100  },
  { key: 'vitaminD',   label: 'ビタミンD',   unit: 'μg', daily: 8.5  },
  { key: 'vitaminE',   label: 'ビタミンE',   unit: 'mg', daily: 6.0  },
  { key: 'vitaminA',   label: 'ビタミンA',   unit: 'μg', daily: 700  },
  { key: 'vitaminB6',  label: 'ビタミンB6',  unit: 'mg', daily: 1.2  },
  { key: 'vitaminB12', label: 'ビタミンB12', unit: 'μg', daily: 2.4  },
  { key: 'iron',       label: '鉄分',        unit: 'mg', daily: 7.5  },
  { key: 'calcium',    label: 'カルシウム',  unit: 'mg', daily: 650  },
  { key: 'zinc',       label: '亜鉛',        unit: 'mg', daily: 10   },
  { key: 'magnesium',  label: 'マグネシウム', unit: 'mg', daily: 270  },
  { key: 'folate',     label: '葉酸',        unit: 'μg', daily: 240  },
  { key: 'fiber',      label: '食物繊維',    unit: 'g',  daily: 22   },
  { key: 'omega3',     label: 'EPA+DHA',     unit: 'g',  daily: 2.0  },
];

function MicrosDisplay({ micros }: { micros: Micros }) {
  const items = MICRO_DISPLAY
    .map((d) => ({ ...d, value: micros[d.key] ?? 0 }))
    .filter((d) => d.value > 0);
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">🔬 微量栄養素（1人前・日推奨量比）</h3>
      <div className="space-y-2">
        {items.map((d) => {
          const pct = Math.min(Math.round((d.value / d.daily) * 100), 100);
          const barColor = pct >= 50 ? 'bg-green-400' : pct >= 25 ? 'bg-yellow-400' : 'bg-blue-300';
          return (
            <div key={d.key}>
              <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                <span>{d.label}</span>
                <span>{d.value}{d.unit} <span className="text-gray-400">({pct}%)</span></span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface SavedRecipe extends Dish {
  id: string;
  categories: string[];
  savedAt: string;
  detail?: DishDetail;
}

interface Message { role: 'user' | 'assistant'; content: string; }

// 旧データ (category: string) を categories: string[] へ移行
function migrateRecipe(r: any): SavedRecipe {
  return {
    ...r,
    categories: r.categories ?? (r.category ? [r.category] : ['その他']),
  };
}

function NutritionBar({ n }: { n: Nutrition }) {
  return (
    <div className="grid grid-cols-4 gap-1 text-center bg-gray-50 rounded-xl px-2 py-2">
      {[
        { label: 'kcal', value: n.calories, color: 'text-orange-500' },
        { label: 'タンパク質', value: `${n.protein}g`, color: 'text-blue-500' },
        { label: '脂質',      value: `${n.fat}g`,     color: 'text-yellow-500' },
        { label: '炭水化物',  value: `${n.carbs}g`,   color: 'text-green-500' },
      ].map(({ label, value, color }) => (
        <div key={label}>
          <div className={`text-sm font-bold ${color}`}>{value}</div>
          <div className="text-xs text-gray-400">{label}</div>
        </div>
      ))}
    </div>
  );
}

function DetailContent({ detail }: { detail: DishDetail }) {
  return (
    <>
      {detail.micros && <MicrosDisplay micros={detail.micros} />}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">🧾 材料 ({detail.servings})</h3>
        <ul className="space-y-1">
          {detail.ingredients.map((ing, i) => (
            <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
              <span className="text-gray-300 mt-0.5">•</span>{ing}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">👨‍🍳 作り方</h3>
        <ol className="space-y-2">
          {detail.steps.map((step, i) => (
            <li key={i} className="text-sm text-gray-600 flex gap-3">
              <span className="bg-blue-100 text-blue-600 rounded-full w-5 h-5 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
      {detail.tips && (
        <div className="bg-yellow-50 rounded-xl px-4 py-3 text-sm text-yellow-800">💡 {detail.tips}</div>
      )}
      <a href={detail.searchUrl} target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 transition-colors">
        🔗 クックパッドでレシピを探す
      </a>
    </>
  );
}

const FOOD_DEFAULT_CATEGORIES = ['主食', '主菜', '副菜', '乳製品', '果物', '飲み物', 'お菓子・間食', 'サプリ', 'プロバイオティクス', 'その他'];

function parseIngredient(s: string): { name: string; grams: number } {
  const m = s.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*g/);
  if (m) return { name: m[1].trim(), grams: parseFloat(m[2]) };
  const m2 = s.match(/^(.+?)[（(].*?(\d+)\s*g/);
  if (m2) return { name: m2[1].trim(), grams: parseFloat(m2[2]) };
  return { name: s, grams: 0 };
}

export default function RecipePage() {
  const { profile, saveFoodToHistory, hydrate, customCategories } = useStore();
  const [tab, setTab] = useState<'propose' | 'saved' | 'inventory'>('propose');

  // 目的・栄養素
  const [goal, setGoal] = useState<GoalId | null>(null);
  const [goalIsManual, setGoalIsManual] = useState(false); // UI表示用
  const goalManualRef = useRef(false);                     // effect制御用（stateにするとeffectが再実行される）
  const [showGoalOverride, setShowGoalOverride] = useState(false);

  // 食事タブに保存モーダル
  const [saveToFoodRecipe, setSaveToFoodRecipe] = useState<SavedRecipe | null>(null);
  const [saveToFoodGrams, setSaveToFoodGrams] = useState(300);
  const [saveToFoodCategory, setSaveToFoodCategory] = useState('その他');
  const [saveToFoodIngredients, setSaveToFoodIngredients] = useState<{ name: string; grams: number }[]>([]);
  const [saveToFoodFavorite, setSaveToFoodFavorite] = useState(false);
  const [saveToFoodDone, setSaveToFoodDone] = useState(false);
  const [customNutrients, setCustomNutrients] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [newNutrient, setNewNutrient] = useState('');
  const [condition, setCondition] = useState('');
  const [useInventory, setUseInventory] = useState(false);
  const [inventoryOnly, setInventoryOnly] = useState(false);

  // 在庫から食材名一覧を取得
  function getInventoryNames(): string[] {
    try {
      const saved = localStorage.getItem('recipe_inventory');
      if (!saved) return [];
      const inv = JSON.parse(saved);
      return [...(inv.fridge ?? []), ...(inv.freezer ?? []), ...(inv.pantry ?? [])].map((i: { name: string }) => i.name);
    } catch { return []; }
  }

  // 提案
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [aiMessage, setAiMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'select' | 'result'>('select');
  const [remaining, setRemaining] = useState(20);
  useEffect(() => { fetchRemaining().then(setRemaining); }, []);

  // チャット
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 詳細モーダル
  const [detailDish, setDetailDish] = useState<(Dish | SavedRecipe) | null>(null);
  const [detail, setDetail] = useState<DishDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // カテゴリ
  const [allCategories, setAllCategories] = useState<string[]>(DEFAULT_CATEGORIES);

  // 保存モーダル
  const [saveDish, setSaveDish] = useState<Dish | null>(null);
  const [saveCategories, setSaveCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');

  // 保存済みレシピ
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [filterCategory, setFilterCategory] = useState('すべて');

  // カテゴリ管理モーダル
  const [showCatManager, setShowCatManager] = useState(false);
  const [editingCat, setEditingCat] = useState<{ index: number; value: string } | null>(null);

  useEffect(() => {
    hydrate();
    const n = localStorage.getItem(STORAGE_NUTRIENTS);
    if (n) setCustomNutrients(JSON.parse(n));
    const s = localStorage.getItem(STORAGE_SAVED);
    if (s) setSavedRecipes((JSON.parse(s) as any[]).map(migrateRecipe));
    const c = localStorage.getItem(STORAGE_CATEGORIES);
    setAllCategories(c ? JSON.parse(c) : DEFAULT_CATEGORIES);
  }, []);

  // プロフィールから目的を自動設定（手動変更済みなら上書きしない）
  useEffect(() => {
    if (!goalManualRef.current) {
      setGoal(profileToGoal(profile));
    }
  }, [profile]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function saveAllCategories(cats: string[]) {
    setAllCategories(cats);
    localStorage.setItem(STORAGE_CATEGORIES, JSON.stringify(cats));
  }
  function saveAllRecipes(recipes: SavedRecipe[]) {
    setSavedRecipes(recipes);
    localStorage.setItem(STORAGE_SAVED, JSON.stringify(recipes));
  }

  const allNutrients = [...BASE_NUTRIENTS, ...customNutrients];
  const costColor: Record<string, string> = { 低: 'text-green-600', 中: 'text-yellow-600', 高: 'text-red-500' };

  // --- 栄養素 ---
  function toggleNutrient(label: string) {
    setSelected((prev) => prev.includes(label) ? prev.filter((n) => n !== label) : [...prev, label]);
  }
  function addCustomNutrient() {
    const name = newNutrient.trim();
    if (!name || allNutrients.includes(name)) return;
    const updated = [...customNutrients, name];
    setCustomNutrients(updated);
    localStorage.setItem(STORAGE_NUTRIENTS, JSON.stringify(updated));
    setNewNutrient('');
  }
  function removeCustomNutrient(label: string) {
    const updated = customNutrients.filter((n) => n !== label);
    setCustomNutrients(updated);
    localStorage.setItem(STORAGE_NUTRIENTS, JSON.stringify(updated));
    setSelected((prev) => prev.filter((n) => n !== label));
  }
  function toggleQuickCondition(c: string) {
    if (condition.includes(c)) {
      setCondition(condition.replace(c, '').replace(/[、,]\s*/g, '、').replace(/^[、,]|[、,]$/g, '').trim());
    } else {
      setCondition((prev) => (prev ? `${prev}、${c}` : c));
    }
  }

  // --- 提案 ---
  async function propose() {
    if (selected.length === 0 && !goal) return;
    setLoading(true);
    setPhase('result');
    setDishes([]);
    setMessages([]);
    const inventoryNames = useInventory ? getInventoryNames() : [];
    let inventoryCondition = condition;
    if (inventoryNames.length > 0) {
      if (inventoryOnly) {
        inventoryCondition = `【厳守: 在庫のみ使用】次の食材リストにあるものだけを使って作れるレシピに限定してください。リストにない主要食材（肉、魚、卵、野菜など）は一切使わないこと。ただし、調味料、水、油、小麦粉などの常備品は使用しても構いません。: ${inventoryNames.join('、')}。${condition}`;
      } else {
        inventoryCondition = `【在庫活用】次の食材を優先的に使うこと: ${inventoryNames.join('、')}。${condition}`;
      }
    }
    try {
      const res = await fetch('/api/gemini/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nutrients: selected, condition: inventoryCondition, goal, apiKey: getUserApiKey() }),
      });
      const data = await res.json();
      setDishes(data.dishes ?? []);
      setAiMessage(data.message ?? '');
      const r = await incrementUsage();
      setRemaining(r.remaining);
      const goalLabel = GOALS.find((g) => g.id === goal)?.label;
      setMessages([{ role: 'assistant', content: `${goalLabel ? `【${goalLabel}】` : ''}${selected.length > 0 ? selected.join('・') + 'を補える' : ''}料理を提案しました！${condition ? `（条件: ${condition}）` : ''}\n気になる料理や、他の条件があればチャットで教えてください。` }]);
    } catch {
      setAiMessage('エラーが発生しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  }

  // --- チャット ---
  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setChatInput('');
    setChatLoading(true);
    const context = `【前提】不足栄養素: ${selected.join('、')}${condition ? ` / 条件: ${condition}` : ''}\n提案した料理: ${dishes.map((d) => d.name).join('、')}\n\n【ユーザーの質問】${text}`;
    const chatMessages = [
      { role: 'assistant', content: '栄養士AIとして料理提案のサポートをします。' },
      ...newMessages.slice(1).map((m, i) => ({ ...m, content: i === newMessages.length - 2 ? context : m.content })),
    ];
    try {
      const res = await fetch('/api/gemini/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nutrients: selected, condition, messages: chatMessages, apiKey: getUserApiKey() }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.reply ?? 'エラーが発生しました。' }]);
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'エラーが発生しました。' }]);
    } finally {
      setChatLoading(false);
    }
  }

  // --- 詳細 ---
  async function openDetail(dish: Dish | SavedRecipe) {
    const saved = 'categories' in dish ? dish as SavedRecipe : null;
    if (saved?.detail) { setDetailDish(dish); setDetail(saved.detail); setDetailError(null); return; }
    setDetailDish(dish);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch('/api/gemini/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'detail', dishName: dish.name, apiKey: getUserApiKey() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setDetailError(data.error ?? `HTTP ${res.status}`);
      } else {
        setDetail(data);
        if (saved) {
          const updated = savedRecipes.map((r) => r.id === saved.id ? { ...r, detail: data } : r);
          saveAllRecipes(updated);
        }
      }
    } catch (e: any) {
      setDetailError(e?.message ?? '通信エラー');
    } finally {
      setDetailLoading(false);
    }
  }

  // --- 保存 ---
  function openSave(dish: Dish) {
    setSaveDish(dish);
    setSaveCategories([allCategories[0]]);
    setNewCategory('');
  }
  function toggleSaveCategory(cat: string) {
    setSaveCategories((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]);
  }
  function addNewCategoryInSave() {
    const name = newCategory.trim();
    if (!name || allCategories.includes(name)) return;
    saveAllCategories([...allCategories, name]);
    setSaveCategories((prev) => [...prev, name]);
    setNewCategory('');
  }
  function saveRecipe() {
    if (!saveDish || saveCategories.length === 0) return;
    const recipe: SavedRecipe = {
      ...saveDish,
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      categories: saveCategories,
      savedAt: new Date().toLocaleDateString('ja-JP'),
    };
    saveAllRecipes([recipe, ...savedRecipes]);
    setSaveDish(null);
  }
  function deleteSaved(id: string) {
    saveAllRecipes(savedRecipes.filter((r) => r.id !== id));
    if ('id' in (detailDish ?? {}) && (detailDish as SavedRecipe)?.id === id) setDetailDish(null);
  }

  // --- 在庫からレシピ検索 ---
  function handleSearchFromInventory(items: InventoryItem[]) {
    setTab('propose');
    setCondition(items.map((i) => i.name).join('、') + 'を使って');
    setPhase('select');
    setDishes([]);
    setMessages([]);
  }

  // --- 食事タブに保存 ---
  function openSaveToFood(recipe: SavedRecipe) {
    const ings = recipe.detail?.ingredients?.map(parseIngredient) ?? [];
    setSaveToFoodRecipe(recipe);
    setSaveToFoodGrams(300);
    setSaveToFoodCategory('主菜');
    setSaveToFoodIngredients(ings);
    setSaveToFoodFavorite(false);
    setSaveToFoodDone(false);
  }

  function saveToFoodTab() {
    if (!saveToFoodRecipe) return;
    const recipe = saveToFoodRecipe;
    const n = recipe.nutrition;
    const grams = saveToFoodGrams;
    const today = localDate();
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const per100g = n ? {
      calories: Math.round((n.calories / (n.calories > 0 ? grams : 300)) * 100),
      protein:  Math.round((n.protein  / grams) * 100 * 10) / 10,
      fat:      Math.round((n.fat      / grams) * 100 * 10) / 10,
      carbs:    Math.round((n.carbs    / grams) * 100 * 10) / 10,
    } : { calories: 0, protein: 0, fat: 0, carbs: 0 };

    const totalIng = saveToFoodIngredients.reduce((s, i) => s + i.grams, 0);
    const ingredients = saveToFoodIngredients.map((i) => {
      const ratio = totalIng > 0 ? i.grams / totalIng : 0;
      return {
        name: i.name, grams: i.grams,
        calories: Math.round((n?.calories ?? 0) * ratio),
        protein:  Math.round((n?.protein  ?? 0) * ratio * 10) / 10,
        fat:      Math.round((n?.fat      ?? 0) * ratio * 10) / 10,
        carbs:    Math.round((n?.carbs    ?? 0) * ratio * 10) / 10,
      };
    });

    saveFoodToHistory({
      id,
      foodName: recipe.name,
      grams,
      per100g,
      ingredients: ingredients.length > 0 ? ingredients : undefined,
      isFavorite: saveToFoodFavorite,
      lastUsed: today,
      useCount: 1,
      category: saveToFoodCategory,
    });

    setSaveToFoodDone(true);
    setTimeout(() => { setSaveToFoodRecipe(null); setSaveToFoodDone(false); }, 1200);
  }

  // --- カテゴリ管理 ---
  function startEditCat(index: number) { setEditingCat({ index, value: allCategories[index] }); }
  function commitEditCat() {
    if (!editingCat) return;
    const oldName = allCategories[editingCat.index];
    const newName = editingCat.value.trim();
    if (!newName || (newName !== oldName && allCategories.includes(newName))) { setEditingCat(null); return; }
    const updatedCats = allCategories.map((c, i) => i === editingCat.index ? newName : c);
    saveAllCategories(updatedCats);
    const updatedRecipes = savedRecipes.map((r) => ({
      ...r,
      categories: r.categories.map((c) => c === oldName ? newName : c),
    }));
    saveAllRecipes(updatedRecipes);
    if (filterCategory === oldName) setFilterCategory(newName);
    setEditingCat(null);
  }
  function deleteCat(index: number) {
    const name = allCategories[index];
    saveAllCategories(allCategories.filter((_, i) => i !== index));
    const updatedRecipes = savedRecipes.map((r) => ({
      ...r,
      categories: r.categories.filter((c) => c !== name).length > 0
        ? r.categories.filter((c) => c !== name)
        : ['その他'],
    }));
    saveAllRecipes(updatedRecipes);
    if (filterCategory === name) setFilterCategory('すべて');
  }
  function addCatInManager() {
    const name = newCategory.trim();
    if (!name || allCategories.includes(name)) return;
    saveAllCategories([...allCategories, name]);
    setNewCategory('');
  }

  const usedCategories = Array.from(new Set(savedRecipes.flatMap((r) => r.categories)));
  const filterCats = ['すべて', ...usedCategories];
  const filteredSaved = filterCategory === 'すべて'
    ? savedRecipes
    : savedRecipes.filter((r) => r.categories.includes(filterCategory));

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">🥗 栄養補給レシピ提案</h1>
        <p className="text-sm text-gray-500 mt-1">不足栄養素を選んで、AIに料理を提案してもらおう</p>
      </div>

      {/* タブ */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        <button onClick={() => setTab('propose')}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${tab === 'propose' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
          🍳 提案する
        </button>
        <button onClick={() => setTab('saved')}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${tab === 'saved' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
          📌 保存済み{savedRecipes.length > 0 && <span className="ml-1 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">{savedRecipes.length}</span>}
        </button>
        <button onClick={() => setTab('inventory')}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${tab === 'inventory' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>
          📦 在庫
        </button>
      </div>

      {/* ===== 提案タブ ===== */}
      {tab === 'propose' && (
        <>
          {/* 目的（プロフィールから自動設定） */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">① 目的</h2>
              <button onClick={() => setShowGoalOverride(!showGoalOverride)}
                className="text-xs text-blue-500 hover:text-blue-600">
                {showGoalOverride ? '▲ 閉じる' : '✏️ 変更する'}
              </button>
            </div>
            {goal ? (
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${showGoalOverride ? 'border-gray-200 bg-gray-50' : 'border-orange-300 bg-orange-50'}`}>
                <span className="text-xl">{GOALS.find((g) => g.id === goal)?.icon}</span>
                <div>
                  <div className="text-sm font-medium text-gray-800">{GOALS.find((g) => g.id === goal)?.label}</div>
                  <div className="text-xs text-gray-400">{goalIsManual ? '手動設定' : '設定タブから自動設定'}</div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">設定タブで目標を設定すると自動で反映されます</p>
            )}
            {showGoalOverride && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {GOALS.map((g) => (
                  <button key={g.id} onClick={() => { setGoal(g.id); goalManualRef.current = true; setGoalIsManual(true); setShowGoalOverride(false); }}
                    className={`flex flex-col items-start px-3 py-2.5 rounded-xl border text-left transition-all
                      ${goal === g.id ? 'bg-orange-50 border-orange-400 text-orange-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    <span className="text-base">{g.icon} <span className="text-sm font-medium">{g.label}</span></span>
                    <span className="text-xs text-gray-400 mt-0.5">{g.desc}</span>
                  </button>
                ))}
                {goalIsManual && (
                  <button onClick={() => { goalManualRef.current = false; setGoalIsManual(false); setGoal(profileToGoal(profile)); setShowGoalOverride(false); }}
                    className="col-span-full text-xs text-blue-500 hover:text-blue-600 text-center py-1">
                    設定タブの目標に戻す
                  </button>
                )}
              </div>
            )}
          </section>

          {/* 栄養素 */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
            <h2 className="font-semibold text-gray-700">② 不足している栄養素を選ぶ</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {allNutrients.map((label) => {
                const isCustom = customNutrients.includes(label);
                const isSelected = selected.includes(label);
                return (
                  <div key={label} className="flex items-center gap-1">
                    <button onClick={() => toggleNutrient(label)}
                      className={`flex-1 text-left px-3 py-2 rounded-xl text-sm font-medium border transition-all
                        ${isSelected ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {isSelected ? '✓ ' : ''}{label}
                    </button>
                    {isCustom && (
                      <button onClick={() => removeCustomNutrient(label)} className="text-gray-300 hover:text-red-400 text-xs px-1" title="削除">✕</button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 pt-1">
              <input value={newNutrient} onChange={(e) => setNewNutrient(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomNutrient()}
                placeholder="新しい栄養素を追加..."
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <button onClick={addCustomNutrient}
                className="px-4 py-2 bg-blue-500 text-white text-sm rounded-xl hover:bg-blue-600 transition-colors">＋追加</button>
            </div>
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {selected.map((n) => (
                  <span key={n} className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">{n}</span>
                ))}
              </div>
            )}
          </section>

          {/* 在庫活用 */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-700">③ 在庫食材を活用する</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {useInventory
                    ? (() => { const names = getInventoryNames(); return names.length > 0 ? `対象: ${names.join('・')}` : '在庫に食材が登録されていません'; })()
                    : '在庫タブに登録した食材を優先的に使うレシピを提案'}
                </p>
              </div>
              <button
                onClick={() => setUseInventory(!useInventory)}
                className={`relative w-12 h-6 rounded-full transition-colors ${useInventory ? 'bg-green-500' : 'bg-gray-200'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${useInventory ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>
            {useInventory && (
              <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-700">在庫にある食材のみを使用</p>
                  <p className="text-xs text-gray-400 italic">※ リストにない主要食材を一切使いません</p>
                </div>
                <button
                  onClick={() => setInventoryOnly(!inventoryOnly)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${inventoryOnly ? 'bg-blue-500' : 'bg-gray-200'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${inventoryOnly ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            )}
          </section>

          {/* 絞り込み */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
            <h2 className="font-semibold text-gray-700">④ 絞り込み条件（任意）</h2>
            <input value={condition} onChange={(e) => setCondition(e.target.value)}
              placeholder="例: 低コストで、残り物で、10分以内..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <div className="flex flex-wrap gap-2">
              {QUICK_CONDITIONS.map((c) => (
                <button key={c} onClick={() => toggleQuickCondition(c)}
                  className={`px-3 py-1 text-xs rounded-full border transition-all
                    ${condition.includes(c) ? 'bg-green-50 border-green-400 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {condition.includes(c) ? '✓ ' : ''}{c}
                </button>
              ))}
            </div>
          </section>

          <div className="flex items-center gap-2">
            <button onClick={propose} disabled={(selected.length === 0 && !goal) || loading}
              className="flex-1 py-3 bg-blue-500 text-white font-semibold rounded-2xl hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {loading ? '提案中...' : '🍳 料理を提案してもらう'}
            </button>
            <span className={`text-sm font-semibold px-2.5 py-3 rounded-2xl whitespace-nowrap ${remaining <= 5 ? 'bg-red-100 text-red-500' : remaining <= 10 ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'}`}>
              残り {remaining} 回
            </span>
          </div>

          {phase === 'result' && (
            <>
              {loading ? (
                <div className="text-center py-10 text-gray-400 text-sm">AIが考えています...</div>
              ) : dishes.length > 0 ? (
                <section className="space-y-3">
                  {aiMessage && <div className="bg-blue-50 text-blue-800 text-sm px-4 py-3 rounded-2xl">🤖 {aiMessage}</div>}
                  {dishes.map((dish, i) => (
                    <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-gray-800">{dish.name}</h3>
                        <div className="flex gap-2 text-xs text-gray-400 shrink-0">
                          <span>⏱ {dish.time}</span>
                          <span className={costColor[dish.cost] ?? 'text-gray-500'}>💴 コスト{dish.cost}</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">{dish.description}</p>
                      {dish.nutrition && <NutritionBar n={dish.nutrition} />}
                      <div className="flex flex-wrap gap-1">
                        {dish.nutrients.map((n) => (
                          <span key={n} className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full">{n}</span>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => openDetail(dish)}
                          className="flex-1 py-1.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
                          📖 詳細・URL
                        </button>
                        <button onClick={() => openSave(dish)}
                          className="flex-1 py-1.5 text-sm border border-blue-200 rounded-xl text-blue-600 hover:bg-blue-50 transition-colors">
                          📌 保存する
                        </button>
                      </div>
                    </div>
                  ))}
                </section>
              ) : null}

              {messages.length > 0 && (
                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-700 text-sm">💬 さらに相談する</h2>
                  </div>
                  <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                    {messages.map((m, i) => (
                      <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap
                          ${m.role === 'user' ? 'bg-blue-500 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                          {m.role === 'assistant' && <span className="mr-1">🤖</span>}
                          {m.content}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 text-gray-400 text-sm px-4 py-2 rounded-2xl rounded-bl-sm">🤖 考えています...</div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
                    <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
                      placeholder="和食がいい、簡単なものがいい..."
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                      className="px-4 py-2 bg-blue-500 text-white text-sm rounded-xl hover:bg-blue-600 disabled:opacity-40 transition-colors">送信</button>
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      {/* ===== 保存済みタブ ===== */}
      {tab === 'saved' && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1 flex-1">
              {filterCats.map((cat) => (
                <button key={cat} onClick={() => setFilterCategory(cat)}
                  className={`px-3 py-1.5 text-xs rounded-full border whitespace-nowrap transition-all
                    ${filterCategory === cat ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {cat}
                  {cat !== 'すべて' && <span className="ml-1 text-gray-400">({savedRecipes.filter((r) => r.categories.includes(cat)).length})</span>}
                </button>
              ))}
            </div>
            <button onClick={() => { setShowCatManager(true); setNewCategory(''); setEditingCat(null); }}
              className="ml-2 px-3 py-1.5 text-xs border border-gray-200 rounded-full text-gray-500 hover:bg-gray-50 shrink-0 transition-colors">
              ✏️ 管理
            </button>
          </div>

          {filteredSaved.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              <div className="text-4xl mb-3">📌</div>
              <p>保存したレシピがありません</p>
              <p className="text-xs mt-1">提案された料理の「保存する」から追加できます</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSaved.map((recipe) => (
                <div key={recipe.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1 mb-1">
                        {recipe.categories.map((cat) => (
                          <span key={cat} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{cat}</span>
                        ))}
                      </div>
                      <h3 className="font-semibold text-gray-800">{recipe.name}</h3>
                    </div>
                    <button onClick={() => deleteSaved(recipe.id)} className="text-gray-300 hover:text-red-400 text-sm shrink-0" title="削除">✕</button>
                  </div>
                  <p className="text-sm text-gray-500">{recipe.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>⏱ {recipe.time}</span>
                    <span className={costColor[recipe.cost] ?? 'text-gray-500'}>💴 コスト{recipe.cost}</span>
                    <span>📅 {recipe.savedAt}</span>
                  </div>
                  {recipe.nutrition && <NutritionBar n={recipe.nutrition} />}
                  <div className="flex flex-wrap gap-1">
                    {recipe.nutrients.map((n) => (
                      <span key={n} className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full">{n}</span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openDetail(recipe)}
                      className="flex-1 py-1.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
                      📖 詳細・URL
                    </button>
                    <button onClick={() => openSaveToFood(recipe)}
                      className="flex-1 py-1.5 text-sm border border-green-200 rounded-xl text-green-600 hover:bg-green-50 transition-colors">
                      📥 食事タブに保存
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== 在庫タブ ===== */}
      {tab === 'inventory' && (
        <InventoryTab onSearchFromInventory={handleSearchFromInventory} />
      )}

      {/* ===== 詳細モーダル ===== */}
      {detailDish && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => { setDetailDish(null); setDetail(null); }}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">{detailDish.name}</h2>
              <button onClick={() => { setDetailDish(null); setDetail(null); }} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {detailDish.nutrition && <NutritionBar n={detailDish.nutrition} />}
              {detailLoading ? (
                <div className="text-center py-10 text-gray-400 text-sm">詳細を取得中...</div>
              ) : detail ? (
                <DetailContent detail={detail} />
              ) : detailError ? (
                <div className="space-y-3">
                  <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">
                    <p className="font-medium">取得に失敗しました</p>
                    <p className="text-xs mt-1 text-red-500 break-all">{detailError}</p>
                  </div>
                  <button onClick={() => detailDish && openDetail(detailDish)}
                    className="w-full py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
                    再試行
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ===== 保存モーダル ===== */}
      {saveDish && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setSaveDish(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">📌 レシピを保存</h2>
              <button onClick={() => setSaveDish(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">「{saveDish.name}」を保存します</p>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">カテゴリを選ぶ（複数可）</p>
                <div className="grid grid-cols-3 gap-2">
                  {allCategories.map((cat) => (
                    <button key={cat} onClick={() => toggleSaveCategory(cat)}
                      className={`py-2 text-xs rounded-xl border transition-all
                        ${saveCategories.includes(cat) ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {saveCategories.includes(cat) ? '✓ ' : ''}{cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addNewCategoryInSave()}
                  placeholder="新しいカテゴリ..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <button onClick={addNewCategoryInSave}
                  className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-xl hover:bg-gray-200 transition-colors">追加</button>
              </div>
              {saveCategories.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {saveCategories.map((c) => (
                    <span key={c} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">{c}</span>
                  ))}
                </div>
              )}
              <button onClick={saveRecipe} disabled={saveCategories.length === 0}
                className="w-full py-3 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-40 transition-colors">
                保存する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 食事タブに保存モーダル ===== */}
      {saveToFoodRecipe && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setSaveToFoodRecipe(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">📥 食事タブに保存</h2>
              <button onClick={() => setSaveToFoodRecipe(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm font-medium text-gray-700">「{saveToFoodRecipe.name}」</p>
              {saveToFoodRecipe.nutrition && <NutritionBar n={saveToFoodRecipe.nutrition} />}
              {!saveToFoodRecipe.nutrition && (
                <p className="text-xs text-yellow-600 bg-yellow-50 px-3 py-2 rounded-xl">※ 栄養情報がありません。詳細を取得してから保存すると正確になります。</p>
              )}

              {/* お気に入り */}
              <button
                onClick={() => setSaveToFoodFavorite(!saveToFoodFavorite)}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all ${saveToFoodFavorite ? 'bg-yellow-50 border-yellow-400 text-yellow-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
              >
                <span className="text-lg">{saveToFoodFavorite ? '★' : '☆'}</span>
                <span className="text-sm font-semibold">お気に入りに追加する</span>
              </button>

              {/* g入力 */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">総量（g）</p>
                <input type="number" min={1} value={saveToFoodGrams}
                  onChange={(e) => setSaveToFoodGrams(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>

              {/* カテゴリ */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">食事タブのカテゴリ</p>
                <div className="flex flex-wrap gap-2">
                  {[...FOOD_DEFAULT_CATEGORIES, ...customCategories].map((cat) => (
                    <button key={cat} onClick={() => setSaveToFoodCategory(cat)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-all
                        ${saveToFoodCategory === cat ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {saveToFoodCategory === cat ? '✓ ' : ''}{cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* 内訳編集 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-500">内訳（材料）</p>
                  <button onClick={() => setSaveToFoodIngredients([...saveToFoodIngredients, { name: '', grams: 0 }])}
                    className="text-xs text-blue-500 hover:text-blue-600">＋ 追加</button>
                </div>
                {saveToFoodIngredients.length === 0 && (
                  <p className="text-xs text-gray-400 py-2">材料がありません。詳細を取得すると自動で反映されます。</p>
                )}
                <div className="space-y-2">
                  {saveToFoodIngredients.map((ing, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input value={ing.name} placeholder="材料名"
                        onChange={(e) => {
                          const next = [...saveToFoodIngredients];
                          next[i] = { ...next[i], name: e.target.value };
                          setSaveToFoodIngredients(next);
                        }}
                        className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-300" />
                      <input type="number" min={0} value={ing.grams || ''} placeholder="g"
                        onChange={(e) => {
                          const next = [...saveToFoodIngredients];
                          next[i] = { ...next[i], grams: Number(e.target.value) };
                          setSaveToFoodIngredients(next);
                        }}
                        className="w-16 px-2 py-1.5 text-sm border border-gray-200 rounded-xl text-right focus:outline-none focus:ring-1 focus:ring-blue-300" />
                      <span className="text-xs text-gray-400">g</span>
                      <button onClick={() => setSaveToFoodIngredients(saveToFoodIngredients.filter((_, j) => j !== i))}
                        className="text-gray-300 hover:text-red-400 text-sm">✕</button>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={saveToFoodTab} disabled={saveToFoodDone}
                className={`w-full py-3 font-semibold rounded-xl transition-colors ${saveToFoodDone ? 'bg-green-500 text-white' : 'bg-green-500 text-white hover:bg-green-600'}`}>
                {saveToFoodDone ? '✓ 保存しました！' : '食事タブに保存する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== カテゴリ管理モーダル ===== */}
      {showCatManager && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowCatManager(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">✏️ カテゴリ管理</h2>
              <button onClick={() => setShowCatManager(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-5 space-y-3">
              {allCategories.map((cat, i) => (
                <div key={i} className="flex items-center gap-2">
                  {editingCat?.index === i ? (
                    <input
                      autoFocus
                      value={editingCat.value}
                      onChange={(e) => setEditingCat({ index: i, value: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEditCat(); if (e.key === 'Escape') setEditingCat(null); }}
                      onBlur={commitEditCat}
                      className="flex-1 px-3 py-1.5 text-sm border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  ) : (
                    <span className="flex-1 text-sm text-gray-700 px-3 py-1.5 bg-gray-50 rounded-xl">{cat}</span>
                  )}
                  <button onClick={() => startEditCat(i)}
                    className="text-gray-400 hover:text-blue-500 text-sm px-2" title="編集">✏️</button>
                  <button onClick={() => deleteCat(i)}
                    className="text-gray-300 hover:text-red-400 text-sm px-1" title="削除">✕</button>
                </div>
              ))}
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCatInManager()}
                  placeholder="新しいカテゴリ..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <button onClick={addCatInManager}
                  className="px-3 py-2 bg-blue-500 text-white text-sm rounded-xl hover:bg-blue-600 transition-colors">追加</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
