'use client';
import { useState, useEffect } from 'react';

export interface InventoryItem { id: string; name: string; }
export interface Inventory {
  fridge:  InventoryItem[];
  freezer: InventoryItem[];
  pantry:  InventoryItem[];
}

const STORAGE_KEY = 'recipe_inventory';
const EMPTY: Inventory = { fridge: [], freezer: [], pantry: [] };

const SECTIONS = [
  {
    key: 'fridge'  as const,
    label: '冷蔵庫',
    icon: '🧊',
    color: 'bg-blue-50 border-blue-200',
    headerColor: 'bg-blue-100 text-blue-700',
    badgeColor: 'bg-blue-200 text-blue-700',
  },
  {
    key: 'freezer' as const,
    label: '冷凍庫',
    icon: '❄️',
    color: 'bg-cyan-50 border-cyan-200',
    headerColor: 'bg-cyan-100 text-cyan-700',
    badgeColor: 'bg-cyan-200 text-cyan-700',
  },
  {
    key: 'pantry'  as const,
    label: '常温',
    icon: '🏠',
    color: 'bg-amber-50 border-amber-200',
    headerColor: 'bg-amber-100 text-amber-700',
    badgeColor: 'bg-amber-200 text-amber-700',
  },
] as const;

interface Props {
  onSearchFromInventory: (items: InventoryItem[]) => void;
}

export default function InventoryTab({ onSearchFromInventory }: Props) {
  const [inventory, setInventory] = useState<Inventory>(EMPTY);
  const [inputs, setInputs] = useState({ fridge: '', freezer: '', pantry: '' });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setInventory(JSON.parse(saved));
  }, []);

  function save(next: Inventory) {
    setInventory(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function addItem(section: keyof Inventory) {
    const name = inputs[section].trim();
    if (!name) return;
    const item: InventoryItem = { id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, name };
    save({ ...inventory, [section]: [...inventory[section], item] });
    setInputs((prev) => ({ ...prev, [section]: '' }));
  }

  function removeItem(section: keyof Inventory, id: string) {
    save({ ...inventory, [section]: inventory[section].filter((i) => i.id !== id) });
  }

  const allItems = [...inventory.fridge, ...inventory.freezer, ...inventory.pantry];
  const totalCount = allItems.length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-800">📦 食材在庫管理</h2>
        <p className="text-sm text-gray-500 mt-0.5">冷蔵庫・冷凍庫・常温の食材を登録してレシピ検索に活用しよう</p>
      </div>

      {/* 概要バッジ */}
      <div className="grid grid-cols-3 gap-3">
        {SECTIONS.map((s) => (
          <div key={s.key} className={`rounded-2xl border p-4 text-center ${s.color}`}>
            <div className="text-3xl mb-1">{s.icon}</div>
            <div className="text-xs font-medium text-gray-600">{s.label}</div>
            <div className={`text-lg font-bold mt-1 px-2 py-0.5 rounded-full inline-block ${s.badgeColor}`}>
              {inventory[s.key].length}品
            </div>
          </div>
        ))}
      </div>

      {/* 各セクション */}
      {SECTIONS.map((s) => (
        <div key={s.key} className={`rounded-2xl border-2 overflow-hidden ${s.color}`}>
          {/* ヘッダー */}
          <div className={`flex items-center gap-2 px-4 py-3 ${s.headerColor}`}>
            <span className="text-2xl">{s.icon}</span>
            <span className="font-bold text-base">{s.label}</span>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${s.badgeColor}`}>
              {inventory[s.key].length}品
            </span>
          </div>

          {/* 食材リスト */}
          <div className="px-4 py-3 space-y-2">
            {inventory[s.key].length === 0 ? (
              <p className="text-sm text-gray-400 py-2 text-center">食材がありません</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {inventory[s.key].map((item) => (
                  <div key={item.id}
                    className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm">
                    <span className="text-sm text-gray-700">{item.name}</span>
                    <button onClick={() => removeItem(s.key, item.id)}
                      className="text-gray-300 hover:text-red-400 ml-0.5 text-xs leading-none">✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* 追加入力 */}
            <div className="flex gap-2 pt-1">
              <input
                value={inputs[s.key]}
                onChange={(e) => setInputs((prev) => ({ ...prev, [s.key]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && addItem(s.key)}
                placeholder={`${s.label}の食材を追加...`}
                className="flex-1 px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <button onClick={() => addItem(s.key)}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors">
                ＋追加
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* レシピ検索ボタン */}
      <button
        onClick={() => onSearchFromInventory(allItems)}
        disabled={totalCount === 0}
        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-base rounded-2xl hover:from-green-600 hover:to-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
      >
        🔍 在庫（{totalCount}品）からレシピを検索
      </button>

      {totalCount > 0 && (
        <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-500">
          検索対象:&nbsp;
          {allItems.map((i) => i.name).join('・')}
        </div>
      )}
    </div>
  );
}
