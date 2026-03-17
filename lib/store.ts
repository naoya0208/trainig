'use client';
import { create } from 'zustand';
import { Profile } from './calc';

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
  setProfile: (p: Profile) => void;
  addFood: (e: FoodEntry) => void;
  removeFood: (id: string) => void;
  addWeight: (e: WeightEntry) => void;
  addWorkout: (s: WorkoutSession) => void;
  removeWorkout: (id: string) => void;
  hydrate: () => void;
}

const KEYS = { profile: 'ct_profile', food: 'ct_food', weight: 'ct_weight', workout: 'ct_workout' };

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

  setProfile: (p) => { set({ profile: p }); save(KEYS.profile, p); },
  addFood: (e) => { const next = [...get().foodEntries, e]; set({ foodEntries: next }); save(KEYS.food, next); },
  removeFood: (id) => { const next = get().foodEntries.filter(e => e.id !== id); set({ foodEntries: next }); save(KEYS.food, next); },
  addWeight: (e) => {
    const next = [...get().weightEntries.filter(w => w.date !== e.date), e].sort((a, b) => a.date.localeCompare(b.date));
    set({ weightEntries: next }); save(KEYS.weight, next);
  },
  addWorkout: (s) => { const next = [...get().workoutSessions, s]; set({ workoutSessions: next }); save(KEYS.workout, next); },
  removeWorkout: (id) => { const next = get().workoutSessions.filter(s => s.id !== id); set({ workoutSessions: next }); save(KEYS.workout, next); },
  hydrate: () => {
    set({
      profile: load(KEYS.profile, null),
      foodEntries: load(KEYS.food, []),
      weightEntries: load(KEYS.weight, []),
      workoutSessions: load(KEYS.workout, []),
    });
  },
}));
