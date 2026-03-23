'use client';
import { useState, useEffect, useRef } from 'react';
import { MICRO_DEFS } from '@/lib/micros';

const QUICK_CONDITIONS = ['低コスト', '残り物活用', '時短（15分以内）', '簡単', '作り置き'];

const BASE_NUTRIENTS = MICRO_DEFS.map((d) => d.label);

interface Dish {
  name: string;
  description: string;
  nutrients: string[];
  time: string;
  cost: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const STORAGE_KEY = 'recipe_custom_nutrients';

export default function RecipePage() {
  const [customNutrients, setCustomNutrients] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [newNutrient, setNewNutrient] = useState('');
  const [condition, setCondition] = useState('');
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [aiMessage, setAiMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [phase, setPhase] = useState<'select' | 'result'>('select');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setCustomNutrients(JSON.parse(saved));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const allNutrients = [...BASE_NUTRIENTS, ...customNutrients];

  function toggleNutrient(label: string) {
    setSelected((prev) =>
      prev.includes(label) ? prev.filter((n) => n !== label) : [...prev, label]
    );
  }

  function addCustomNutrient() {
    const name = newNutrient.trim();
    if (!name || allNutrients.includes(name)) return;
    const updated = [...customNutrients, name];
    setCustomNutrients(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setNewNutrient('');
  }

  function removeCustomNutrient(label: string) {
    const updated = customNutrients.filter((n) => n !== label);
    setCustomNutrients(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSelected((prev) => prev.filter((n) => n !== label));
  }

  function toggleQuickCondition(c: string) {
    if (condition.includes(c)) {
      setCondition(condition.replace(c, '').replace(/[、,]\s*/g, '、').replace(/^[、,]|[、,]$/g, '').trim());
    } else {
      setCondition((prev) => (prev ? `${prev}、${c}` : c));
    }
  }

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
      const intro = `${selected.join('・')}を補える料理を提案しました！${condition ? `（条件: ${condition}）` : ''}\n気になる料理や、他の条件があればチャットで教えてください。`;
      setMessages([{ role: 'assistant', content: intro }]);
    } catch {
      setAiMessage('エラーが発生しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setChatInput('');
    setChatLoading(true);

    const context = `【前提】不足栄養素: ${selected.join('、')}${condition ? ` / 条件: ${condition}` : ''}\n提案した料理: ${dishes.map((d) => d.name).join('、')}\n\n【ユーザーの質問】${text}`;
    const chatMessages = [
      { role: 'assistant', content: `栄養士AIとして料理提案のサポートをします。` },
      ...newMessages.slice(1).map((m) => ({ ...m, content: m === newMessages[newMessages.length - 1] ? context : m.content })),
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
      setMessages([...newMessages, { role: 'assistant', content: 'エラーが発生しました。もう一度お試しください。' }]);
    } finally {
      setChatLoading(false);
    }
  }

  const costColor: Record<string, string> = { 低: 'text-green-600', 中: 'text-yellow-600', 高: 'text-red-500' };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">🥗 栄養補給レシピ提案</h1>
        <p className="text-sm text-gray-500 mt-1">不足栄養素を選んで、AIに料理を提案してもらおう</p>
      </div>

      {/* 栄養素選択 */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-gray-700">① 不足している栄養素を選ぶ</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {allNutrients.map((label) => {
            const isCustom = customNutrients.includes(label);
            const isSelected = selected.includes(label);
            return (
              <div key={label} className="flex items-center gap-1">
                <button
                  onClick={() => toggleNutrient(label)}
                  className={`flex-1 text-left px-3 py-2 rounded-xl text-sm font-medium border transition-all
                    ${isSelected
                      ? 'bg-blue-50 border-blue-400 text-blue-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'}`}
                >
                  {isSelected ? '✓ ' : ''}{label}
                </button>
                {isCustom && (
                  <button
                    onClick={() => removeCustomNutrient(label)}
                    className="text-gray-300 hover:text-red-400 text-xs px-1"
                    title="削除"
                  >✕</button>
                )}
              </div>
            );
          })}
        </div>

        {/* 栄養素追加 */}
        <div className="flex gap-2 pt-1">
          <input
            value={newNutrient}
            onChange={(e) => setNewNutrient(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomNutrient()}
            placeholder="新しい栄養素を追加..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            onClick={addCustomNutrient}
            className="px-4 py-2 bg-blue-500 text-white text-sm rounded-xl hover:bg-blue-600 transition-colors"
          >
            ＋追加
          </button>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {selected.map((n) => (
              <span key={n} className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                {n}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 絞り込み条件 */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
        <h2 className="font-semibold text-gray-700">② 絞り込み条件（任意）</h2>
        <input
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          placeholder="例: 低コストで、残り物で、10分以内..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <div className="flex flex-wrap gap-2">
          {QUICK_CONDITIONS.map((c) => (
            <button
              key={c}
              onClick={() => toggleQuickCondition(c)}
              className={`px-3 py-1 text-xs rounded-full border transition-all
                ${condition.includes(c)
                  ? 'bg-green-50 border-green-400 text-green-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'}`}
            >
              {condition.includes(c) ? '✓ ' : ''}{c}
            </button>
          ))}
        </div>
      </section>

      {/* 提案ボタン */}
      <button
        onClick={propose}
        disabled={selected.length === 0 || loading}
        className="w-full py-3 bg-blue-500 text-white font-semibold rounded-2xl hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
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
                <div className="bg-blue-50 text-blue-800 text-sm px-4 py-3 rounded-2xl">
                  🤖 {aiMessage}
                </div>
              )}
              {dishes.map((dish, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">{dish.name}</h3>
                    <div className="flex gap-2 text-xs text-gray-400">
                      <span>⏱ {dish.time}</span>
                      <span className={costColor[dish.cost] ?? 'text-gray-500'}>
                        💴 コスト{dish.cost}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">{dish.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {dish.nutrients.map((n) => (
                      <span key={n} className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full">
                        {n}
                      </span>
                    ))}
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
                    <div
                      className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap
                        ${m.role === 'user'
                          ? 'bg-blue-500 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}
                    >
                      {m.role === 'assistant' && <span className="mr-1">🤖</span>}
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 text-gray-400 text-sm px-4 py-2 rounded-2xl rounded-bl-sm">
                      🤖 考えています...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
                  placeholder="和食がいい、簡単なものがいい..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button
                  onClick={sendChat}
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-4 py-2 bg-blue-500 text-white text-sm rounded-xl hover:bg-blue-600 disabled:opacity-40 transition-colors"
                >
                  送信
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
