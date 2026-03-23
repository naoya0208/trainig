'use client';
import { useState, useEffect, useRef } from 'react';
import { MICRO_DEFS } from '@/lib/micros';

const QUICK_CONDITIONS = ['低コスト', '残り物活用', '時短（15分以内）', '簡単', '作り置き'];
const BASE_NUTRIENTS = ['タンパク質', '脂質', '炭水化物', ...MICRO_DEFS.map((d) => d.label)];
const DEFAULT_CATEGORIES = ['朝食', '昼食', '夕食', '作り置き', 'おやつ', 'その他'];

const STORAGE_NUTRIENTS = 'recipe_custom_nutrients';
const STORAGE_SAVED = 'recipe_saved';
const STORAGE_CATEGORIES = 'recipe_custom_categories';

interface Dish {
  name: string;
  description: string;
  nutrients: string[];
  time: string;
  cost: string;
}

interface DishDetail {
  ingredients: string[];
  steps: string[];
  tips: string;
  servings: string;
  searchUrl: string;
}

interface SavedRecipe extends Dish {
  id: string;
  category: string;
  savedAt: string;
  detail?: DishDetail;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function RecipePage() {
  const [tab, setTab] = useState<'propose' | 'saved'>('propose');

  // 栄養素
  const [customNutrients, setCustomNutrients] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [newNutrient, setNewNutrient] = useState('');
  const [condition, setCondition] = useState('');

  // 提案
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [aiMessage, setAiMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'select' | 'result'>('select');

  // チャット
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 詳細モーダル
  const [detailDish, setDetailDish] = useState<Dish | null>(null);
  const [detail, setDetail] = useState<DishDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 保存モーダル
  const [saveDish, setSaveDish] = useState<Dish | null>(null);
  const [saveCategory, setSaveCategory] = useState('');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');

  // 保存済みレシピ
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [savedDetailRecipe, setSavedDetailRecipe] = useState<SavedRecipe | null>(null);
  const [savedDetail, setSavedDetail] = useState<DishDetail | null>(null);
  const [savedDetailLoading, setSavedDetailLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('すべて');

  useEffect(() => {
    const n = localStorage.getItem(STORAGE_NUTRIENTS);
    if (n) setCustomNutrients(JSON.parse(n));
    const s = localStorage.getItem(STORAGE_SAVED);
    if (s) setSavedRecipes(JSON.parse(s));
    const c = localStorage.getItem(STORAGE_CATEGORIES);
    if (c) setCustomCategories(JSON.parse(c));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const allNutrients = [...BASE_NUTRIENTS, ...customNutrients];
  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];

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
    if (selected.length === 0) return;
    setLoading(true);
    setPhase('result');
    setDishes([]);
    setMessages([]);
    try {
      const res = await fetch('/api/gemini/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nutrients: selected, condition }),
      });
      const data = await res.json();
      setDishes(data.dishes ?? []);
      setAiMessage(data.message ?? '');
      setMessages([{ role: 'assistant', content: `${selected.join('・')}を補える料理を提案しました！${condition ? `（条件: ${condition}）` : ''}\n気になる料理や、他の条件があればチャットで教えてください。` }]);
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
      ...newMessages.slice(1).map((m, i) => ({
        ...m,
        content: i === newMessages.length - 2 ? context : m.content,
      })),
    ];
    try {
      const res = await fetch('/api/gemini/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nutrients: selected, condition, messages: chatMessages }),
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
  async function openDetail(dish: Dish) {
    setDetailDish(dish);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch('/api/gemini/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'detail', dishName: dish.name }),
      });
      const data = await res.json();
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }
  function closeDetail() { setDetailDish(null); setDetail(null); }

  // --- 保存 ---
  function openSave(dish: Dish) {
    setSaveDish(dish);
    setSaveCategory(allCategories[0]);
  }
  function addCustomCategory() {
    const name = newCategory.trim();
    if (!name || allCategories.includes(name)) return;
    const updated = [...customCategories, name];
    setCustomCategories(updated);
    localStorage.setItem(STORAGE_CATEGORIES, JSON.stringify(updated));
    setSaveCategory(name);
    setNewCategory('');
  }
  function saveRecipe() {
    if (!saveDish || !saveCategory) return;
    const recipe: SavedRecipe = {
      ...saveDish,
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      category: saveCategory,
      savedAt: new Date().toLocaleDateString('ja-JP'),
    };
    const updated = [recipe, ...savedRecipes];
    setSavedRecipes(updated);
    localStorage.setItem(STORAGE_SAVED, JSON.stringify(updated));
    setSaveDish(null);
  }
  function deleteSaved(id: string) {
    const updated = savedRecipes.filter((r) => r.id !== id);
    setSavedRecipes(updated);
    localStorage.setItem(STORAGE_SAVED, JSON.stringify(updated));
    if (savedDetailRecipe?.id === id) setSavedDetailRecipe(null);
  }

  // --- 保存済み詳細 ---
  async function openSavedDetail(recipe: SavedRecipe) {
    setSavedDetailRecipe(recipe);
    if (recipe.detail) { setSavedDetail(recipe.detail); return; }
    setSavedDetail(null);
    setSavedDetailLoading(true);
    try {
      const res = await fetch('/api/gemini/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'detail', dishName: recipe.name }),
      });
      const data = await res.json();
      setSavedDetail(data);
      const updatedRecipes = savedRecipes.map((r) => r.id === recipe.id ? { ...r, detail: data } : r);
      setSavedRecipes(updatedRecipes);
      localStorage.setItem(STORAGE_SAVED, JSON.stringify(updatedRecipes));
    } catch {
      setSavedDetail(null);
    } finally {
      setSavedDetailLoading(false);
    }
  }

  const costColor: Record<string, string> = { 低: 'text-green-600', 中: 'text-yellow-600', 高: 'text-red-500' };
  const savedCategories = ['すべて', ...Array.from(new Set(savedRecipes.map((r) => r.category)))];
  const filteredSaved = filterCategory === 'すべて' ? savedRecipes : savedRecipes.filter((r) => r.category === filterCategory);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">🥗 栄養補給レシピ提案</h1>
        <p className="text-sm text-gray-500 mt-1">不足栄養素を選んで、AIに料理を提案してもらおう</p>
      </div>

      {/* タブ */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        <button onClick={() => setTab('propose')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'propose' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
          🍳 提案する
        </button>
        <button onClick={() => setTab('saved')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'saved' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
          📌 保存済み {savedRecipes.length > 0 && <span className="ml-1 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">{savedRecipes.length}</span>}
        </button>
      </div>

      {/* ===== 提案タブ ===== */}
      {tab === 'propose' && (
        <>
          {/* 栄養素選択 */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
            <h2 className="font-semibold text-gray-700">① 不足している栄養素を選ぶ</h2>
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

          {/* 絞り込み条件 */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
            <h2 className="font-semibold text-gray-700">② 絞り込み条件（任意）</h2>
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

          {/* 提案ボタン */}
          <button onClick={propose} disabled={selected.length === 0 || loading}
            className="w-full py-3 bg-blue-500 text-white font-semibold rounded-2xl hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {loading ? '提案中...' : '🍳 料理を提案してもらう'}
          </button>

          {/* 提案結果 */}
          {phase === 'result' && (
            <>
              {loading ? (
                <div className="text-center py-10 text-gray-400 text-sm">AIが考えています...</div>
              ) : dishes.length > 0 ? (
                <section className="space-y-3">
                  {aiMessage && (
                    <div className="bg-blue-50 text-blue-800 text-sm px-4 py-3 rounded-2xl">🤖 {aiMessage}</div>
                  )}
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

              {/* チャット */}
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
          {savedRecipes.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              <div className="text-4xl mb-3">📌</div>
              <p>保存したレシピがありません</p>
              <p className="text-xs mt-1">提案された料理の「保存する」から追加できます</p>
            </div>
          ) : (
            <>
              {/* カテゴリフィルタ */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {savedCategories.map((cat) => (
                  <button key={cat} onClick={() => setFilterCategory(cat)}
                    className={`px-3 py-1.5 text-xs rounded-full border whitespace-nowrap transition-all
                      ${filterCategory === cat ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {cat}
                    {cat !== 'すべて' && (
                      <span className="ml-1 text-gray-400">({savedRecipes.filter((r) => r.category === cat).length})</span>
                    )}
                  </button>
                ))}
              </div>

              {/* 保存済みレシピ一覧 */}
              <div className="space-y-3">
                {filteredSaved.map((recipe) => (
                  <div key={recipe.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full mr-2">{recipe.category}</span>
                        <h3 className="font-semibold text-gray-800 mt-1">{recipe.name}</h3>
                      </div>
                      <button onClick={() => deleteSaved(recipe.id)}
                        className="text-gray-300 hover:text-red-400 text-sm shrink-0" title="削除">✕</button>
                    </div>
                    <p className="text-sm text-gray-500">{recipe.description}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>⏱ {recipe.time}</span>
                      <span className={costColor[recipe.cost] ?? 'text-gray-500'}>💴 コスト{recipe.cost}</span>
                      <span>📅 {recipe.savedAt}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {recipe.nutrients.map((n) => (
                        <span key={n} className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full">{n}</span>
                      ))}
                    </div>
                    <button onClick={() => openSavedDetail(recipe)}
                      className="w-full py-1.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
                      📖 詳細・URL を見る
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ===== 詳細モーダル（提案タブ用）===== */}
      {detailDish && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={closeDetail}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">{detailDish.name}</h2>
              <button onClick={closeDetail} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {detailLoading ? (
                <div className="text-center py-10 text-gray-400 text-sm">詳細を取得中...</div>
              ) : detail ? (
                <>
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
                    <div className="bg-yellow-50 rounded-xl px-4 py-3 text-sm text-yellow-800">
                      💡 {detail.tips}
                    </div>
                  )}
                  <a href={detail.searchUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 transition-colors">
                    🔗 クックパッドでレシピを探す
                  </a>
                </>
              ) : (
                <div className="text-center py-10 text-gray-400 text-sm">詳細の取得に失敗しました</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== 詳細モーダル（保存済みタブ用）===== */}
      {savedDetailRecipe && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setSavedDetailRecipe(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{savedDetailRecipe.category}</span>
                <h2 className="font-bold text-gray-800 mt-1">{savedDetailRecipe.name}</h2>
              </div>
              <button onClick={() => setSavedDetailRecipe(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {savedDetailLoading ? (
                <div className="text-center py-10 text-gray-400 text-sm">詳細を取得中...</div>
              ) : savedDetail ? (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">🧾 材料 ({savedDetail.servings})</h3>
                    <ul className="space-y-1">
                      {savedDetail.ingredients.map((ing, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="text-gray-300 mt-0.5">•</span>{ing}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">👨‍🍳 作り方</h3>
                    <ol className="space-y-2">
                      {savedDetail.steps.map((step, i) => (
                        <li key={i} className="text-sm text-gray-600 flex gap-3">
                          <span className="bg-blue-100 text-blue-600 rounded-full w-5 h-5 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  {savedDetail.tips && (
                    <div className="bg-yellow-50 rounded-xl px-4 py-3 text-sm text-yellow-800">
                      💡 {savedDetail.tips}
                    </div>
                  )}
                  <a href={savedDetail.searchUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 transition-colors">
                    🔗 クックパッドでレシピを探す
                  </a>
                </>
              ) : (
                <div className="text-center py-10 text-gray-400 text-sm">詳細の取得に失敗しました</div>
              )}
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
                <p className="text-xs font-medium text-gray-500 mb-2">カテゴリを選ぶ</p>
                <div className="grid grid-cols-3 gap-2">
                  {allCategories.map((cat) => (
                    <button key={cat} onClick={() => setSaveCategory(cat)}
                      className={`py-2 text-xs rounded-xl border transition-all
                        ${saveCategory === cat ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomCategory()}
                  placeholder="新しいカテゴリ..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <button onClick={addCustomCategory}
                  className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-xl hover:bg-gray-200 transition-colors">追加</button>
              </div>
              <button onClick={saveRecipe}
                className="w-full py-3 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors">
                保存する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
