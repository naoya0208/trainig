'use client';
import { create } from 'zustand';
import { Profile } from './calc';
import { supabase } from './supabase';

export interface FoodEntry {
  id: string;
  date: string;
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foodName: string;
  grams: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
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
  weightEntries: WeightEntry[];
  workoutSessions: WorkoutSession[];
  syncCode: string;
  syncing: boolean;
  setProfile: (p: Profile) => void;
  addFood: (e: FoodEntry) => void;
  removeFood: (id: string) => void;
  addWeight: (e: WeightEntry) => void;
  addWorkout: (s: WorkoutSession) => void;
  removeWorkout: (id: string) => void;
  hydrate: () => void;
  setSyncCode: (code: string) => void;
  syncToCloud: () => Promise<void>;
  loadFromCloud: (code: string) => Promise<boolean>;
}

const KEYS = { profile: 'ct_profile', food: 'ct_food', weight: 'ct_weight', workout: 'ct_workout', syncCode: 'ct_sync_code' };

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
  weightEntries: [],
  workoutSessions: [],
  syncCode: '',
  syncing: false,

  setProfile: (p) => {
    set({ profile: p });
    save(KEYS.profile, p);
    get().syncToCloud();
  },
  addFood: (e) => {
    const next = [...get().foodEntries, e];
    set({ foodEntries: next });
    save(KEYS.food, next);
    get().syncToCloud();
  },
  removeFood: (id) => {
    const next = get().foodEntries.filter(e => e.id !== id);
    set({ foodEntries: next });
    save(KEYS.food, next);
    get().syncToCloud();
  },
  addWeight: (e) => {
    const next = [...get().weightEntries.filter(w => w.date !== e.date), e].sort((a, b) => a.date.localeCompare(b.date));
    set({ weightEntries: next });
    save(KEYS.weight, next);
    get().syncToCloud();
  },
  addWorkout: (s) => {
    const next = [...get().workoutSessions, s];
    set({ workoutSessions: next });
    save(KEYS.workout, next);
    get().syncToCloud();
  },
  removeWorkout: (id) => {
    const next = get().workoutSessions.filter(s => s.id !== id);
    set({ workoutSessions: next });
    save(KEYS.workout, next);
    get().syncToCloud();
  },

  setSyncCode: (code) => {
    set({ syncCode: code });
    save(KEYS.syncCode, code);
  },

  syncToCloud: async () => {
    const { syncCode, profile, foodEntries, weightEntries, workoutSessions } = get();
    if (!syncCode || !profile) return;
    await supabase.from('user_data').upsert({
      sync_code: syncCode,
      profile,
      food_entries: foodEntries,
      weight_entries: weightEntries,
      workout_sessions: workoutSessions,
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
    set({ profile, foodEntries, weightEntries, workoutSessions, syncCode: code });
    save(KEYS.profile, profile);
    save(KEYS.food, foodEntries);
    save(KEYS.weight, weightEntries);
    save(KEYS.workout, workoutSessions);
    save(KEYS.syncCode, code);
    return true;
  },

  hydrate: () => {
    const syncCode = load<string>(KEYS.syncCode, '');
    set({
      profile: load(KEYS.profile, null),
      foodEntries: load(KEYS.food, []),
      weightEntries: load(KEYS.weight, []),
      workoutSessions: load(KEYS.workout, []),
      syncCode,
    });
    // クラウドから最新データを取得
    if (syncCode) {
      get().loadFromCloud(syncCode);
    }
  },
}));
