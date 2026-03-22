'use client';
import { create } from 'zustand';
import { Profile } from './calc';
import { supabase } from './supabase';

export interface MicroNutrients {
  fiber?: number;      // 食物繊維 g
  vitaminD?: number;   // ビタミンD μg
  vitaminB12?: number; // ビタミンB12 μg
  vitaminC?: number;   // ビタミンC mg
  iron?: number;       // 鉄分 mg
  calcium?: number;    // カルシウム mg
  zinc?: number;       // 亜鉛 mg
  omega3?: number;     // EPA+DHA g
  sodium?: number;     // ナトリウム mg
  // 美容向け
  vitaminE?: number;        // ビタミンE mg
  vitaminA?: number;        // ビタミンA μg
  biotin?: number;          // ビオチン μg
  vitaminB2?: number;       // ビタミンB2 mg
  niacin?: number;          // ナイアシン(B3) mg
  pantothenicAcid?: number; // パントテン酸(B5) mg
  magnesium?: number;       // マグネシウム mg
  selenium?: number;        // セレン μg
  vitaminK2?: number;       // ビタミンK2 μg（骨密度・血管健康）
}

export interface WaterEntry {
  date: string; // YYYY-MM-DD
  ml: number;   // その日の累計ml
}

export interface FoodEntry {
  id: string;
  date: string;
  time?: string; // HH:MM形式
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foodName: string;
  grams: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber?: number;   // 後方互換用（新規はmicros.fiberを使用）
  extras?: Record<string, number>; // 後方互換用
  micros?: MicroNutrients;
}

export interface SavedIngredient {
  name: string; grams: number; calories: number; protein: number; fat: number; carbs: number; micros?: MicroNutrients;
}

export interface SavedFood {
  id: string;
  foodName: string;
  grams: number; // デフォルトg（サプリの場合は gramsPerUnit × defaultCount）
  per100g: { calories: number; protein: number; fat: number; carbs: number };
  ingredients?: SavedIngredient[]; // 具材リスト
  note?: string;
  isFavorite: boolean;
  lastUsed: string;
  useCount: number;
  servingUnit?: string;   // "粒"/"錠"/"包" など（あればサプリとして粒数UIを表示）
  gramsPerUnit?: number;  // 1粒あたりのg
  category?: string;      // 食品カテゴリ
}

export interface FavoriteGroup {
  id: string;
  name: string;
  itemIds: string[]; // SavedFood.id の配列
  itemGrams?: Record<string, number>; // アイテムごとのg上書き
}

export interface WeightEntry {
  date: string;
  weight: number;
}

export interface WorkoutSet { reps: number; weightKg: number; }
export interface WorkoutExercise { name: string; bodyPart: string; sets: WorkoutSet[]; }
export interface WorkoutSession {
  id: string;
  date: string;
  name: string;
  durationMinutes: number;
  exercises: WorkoutExercise[];
  burnedCalories: number;
}

interface Store {
  profile: Profile | null;
  foodEntries: FoodEntry[];
  savedFoods: SavedFood[];
  favoriteGroups: FavoriteGroup[];
  customCategories: string[];
  weightEntries: WeightEntry[];
  workoutSessions: WorkoutSession[];
  waterEntries: WaterEntry[];
  syncCode: string;
  syncing: boolean;
  setProfile: (p: Profile) => void;
  addFood: (e: FoodEntry) => void;
  removeFood: (id: string) => void;
  updateFood: (id: string, updates: Partial<FoodEntry>) => void;
  addWeight: (e: WeightEntry) => void;
  addWorkout: (s: WorkoutSession) => void;
  removeWorkout: (id: string) => void;
  saveFoodToHistory: (food: SavedFood) => void;
  removeSavedFood: (id: string) => void;
  updateSavedFoodCategory: (id: string, category: string) => void;
  addCustomCategory: (name: string) => void;
  removeCustomCategory: (name: string) => void;
  toggleFavorite: (id: string) => void;
  addFavoriteGroup: (g: FavoriteGroup) => void;
  updateFavoriteGroup: (id: string, updates: Partial<FavoriteGroup>) => void;
  removeFavoriteGroup: (id: string) => void;
  addWater: (date: string, ml: number) => void;
  hydrate: () => void;
  setSyncCode: (code: string) => void;
  syncToCloud: () => Promise<void>;
  loadFromCloud: (code: string) => Promise<boolean>;
}

const KEYS = {
  profile: 'ct_profile', food: 'ct_food', weight: 'ct_weight',
  workout: 'ct_workout', syncCode: 'ct_sync_code', savedFoods: 'ct_saved_foods',
  favoriteGroups: 'ct_fav_groups', customCategories: 'ct_custom_cats',
  water: 'ct_water',
};

function save<T>(key: string, val: T) {
  if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(val));
}
function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

export const useStore = create<Store>((set, get) => ({
  profile: null,
  foodEntries: [],
  savedFoods: [],
  favoriteGroups: [],
  customCategories: [],
  weightEntries: [],
  workoutSessions: [],
  waterEntries: [],
  syncCode: '',
  syncing: false,

  setProfile: (p) => { set({ profile: p }); save(KEYS.profile, p); get().syncToCloud(); },
  addFood: (e) => {
    const next = [...get().foodEntries, e];
    set({ foodEntries: next }); save(KEYS.food, next); get().syncToCloud();
  },
  removeFood: (id) => {
    const next = get().foodEntries.filter(e => e.id !== id);
    set({ foodEntries: next }); save(KEYS.food, next); get().syncToCloud();
  },
  updateFood: (id, updates) => {
    const next = get().foodEntries.map(e => e.id === id ? { ...e, ...updates } : e);
    set({ foodEntries: next }); save(KEYS.food, next); get().syncToCloud();
  },
  addWeight: (e) => {
    const next = [...get().weightEntries.filter(w => w.date !== e.date), e].sort((a, b) => a.date.localeCompare(b.date));
    set({ weightEntries: next }); save(KEYS.weight, next); get().syncToCloud();
  },
  addWorkout: (s) => {
    const next = [...get().workoutSessions, s];
    set({ workoutSessions: next }); save(KEYS.workout, next); get().syncToCloud();
  },
  removeWorkout: (id) => {
    const next = get().workoutSessions.filter(s => s.id !== id);
    set({ workoutSessions: next }); save(KEYS.workout, next); get().syncToCloud();
  },

  saveFoodToHistory: (food) => {
    const existing = get().savedFoods;
    const idx = existing.findIndex(f => f.foodName === food.foodName);
    let next: SavedFood[];
    if (idx >= 0) {
      next = existing.map((f, i) => i === idx
        ? { ...f, useCount: f.useCount + 1, lastUsed: food.lastUsed, grams: food.grams, isFavorite: food.isFavorite ?? f.isFavorite, category: food.category ?? f.category }
        : f
      );
    } else {
      next = [...existing, food];
    }
    set({ savedFoods: next }); save(KEYS.savedFoods, next); get().syncToCloud();
  },

  removeSavedFood: (id) => {
    const next = get().savedFoods.filter(f => f.id !== id);
    set({ savedFoods: next }); save(KEYS.savedFoods, next); get().syncToCloud();
  },

  updateSavedFoodCategory: (id, category) => {
    const next = get().savedFoods.map(f => f.id === id ? { ...f, category } : f);
    set({ savedFoods: next }); save(KEYS.savedFoods, next); get().syncToCloud();
  },

  addCustomCategory: (name) => {
    const next = [...get().customCategories.filter(c => c !== name), name];
    set({ customCategories: next }); save(KEYS.customCategories, next);
  },

  removeCustomCategory: (name) => {
    // カテゴリ削除時、そのカテゴリの食品を「その他」に移動
    const foods = get().savedFoods.map(f => f.category === name ? { ...f, category: 'その他' } : f);
    const cats = get().customCategories.filter(c => c !== name);
    set({ savedFoods: foods, customCategories: cats });
    save(KEYS.savedFoods, foods); save(KEYS.customCategories, cats);
    get().syncToCloud();
  },

  addWater: (date, ml) => {
    const existing = get().waterEntries;
    const idx = existing.findIndex(w => w.date === date);
    const next = idx >= 0
      ? existing.map((w, i) => i === idx ? { ...w, ml: w.ml + ml } : w)
      : [...existing, { date, ml }];
    set({ waterEntries: next }); save(KEYS.water, next);
  },

  toggleFavorite: (id) => {
    const next = get().savedFoods.map(f => f.id === id ? { ...f, isFavorite: !f.isFavorite } : f);
    set({ savedFoods: next }); save(KEYS.savedFoods, next); get().syncToCloud();
  },

  addFavoriteGroup: (g) => {
    const next = [...get().favoriteGroups, g];
    set({ favoriteGroups: next }); save(KEYS.favoriteGroups, next); get().syncToCloud();
  },
  updateFavoriteGroup: (id, updates) => {
    const next = get().favoriteGroups.map(g => g.id === id ? { ...g, ...updates } : g);
    set({ favoriteGroups: next }); save(KEYS.favoriteGroups, next); get().syncToCloud();
  },
  removeFavoriteGroup: (id) => {
    const next = get().favoriteGroups.filter(g => g.id !== id);
    set({ favoriteGroups: next }); save(KEYS.favoriteGroups, next); get().syncToCloud();
  },

  setSyncCode: (code) => { set({ syncCode: code }); save(KEYS.syncCode, code); },

  syncToCloud: async () => {
    const { syncCode, profile, foodEntries, weightEntries, workoutSessions, savedFoods, favoriteGroups } = get();
    if (!syncCode || !profile) return;
    await supabase.from('user_data').upsert({
      sync_code: syncCode, profile, food_entries: foodEntries,
      weight_entries: weightEntries, workout_sessions: workoutSessions,
      saved_foods: savedFoods, favorite_groups: favoriteGroups,
      updated_at: new Date().toISOString(),
    });
  },

  loadFromCloud: async (code) => {
    const { data } = await supabase.from('user_data').select('*').eq('sync_code', code).single();
    if (!data) return false;
    const profile = data.profile as Profile;
    const foodEntries = data.food_entries as FoodEntry[];
    const weightEntries = data.weight_entries as WeightEntry[];
    const workoutSessions = data.workout_sessions as WorkoutSession[];
    const savedFoods = (data.saved_foods as SavedFood[]) ?? [];
    const favoriteGroups = (data.favorite_groups as FavoriteGroup[]) ?? [];
    set({ profile, foodEntries, weightEntries, workoutSessions, savedFoods, favoriteGroups, syncCode: code });
    save(KEYS.profile, profile); save(KEYS.food, foodEntries);
    save(KEYS.weight, weightEntries); save(KEYS.workout, workoutSessions);
    save(KEYS.savedFoods, savedFoods); save(KEYS.favoriteGroups, favoriteGroups);
    save(KEYS.syncCode, code);
    return true;
  },

  hydrate: () => {
    const syncCode = load<string>(KEYS.syncCode, '');
    set({
      profile: load(KEYS.profile, null),
      foodEntries: load(KEYS.food, []),
      savedFoods: load(KEYS.savedFoods, []),
      favoriteGroups: load(KEYS.favoriteGroups, []),
      customCategories: load(KEYS.customCategories, []),
      weightEntries: load(KEYS.weight, []),
      workoutSessions: load(KEYS.workout, []),
      waterEntries: load(KEYS.water, []),
      syncCode,
    });
    if (syncCode) get().loadFromCloud(syncCode);
  },
}));
