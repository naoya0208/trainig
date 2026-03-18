export type Gender = 'male' | 'female' | 'other';
export type ActivityLevel = 1.2 | 1.375 | 1.55 | 1.725 | 1.9;
export type GoalType = 'lose' | 'maintain' | 'gain';

export interface Profile {
  gender: Gender;
  age: number;
  height: number;
  weight: number;
  targetWeight: number;
  bodyFatPercent?: number;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  targetDate?: string;
  appleWatchCalories?: number; // Apple Watch手動入力
}

export function calcBMR(p: Profile): number {
  if (p.bodyFatPercent != null) {
    const lbm = p.weight * (1 - p.bodyFatPercent / 100);
    return Math.round(370 + 21.6 * lbm);
  }
  const base = 10 * p.weight + 6.25 * p.height - 5 * p.age;
  if (p.gender === 'male') return Math.round(base + 5);
  if (p.gender === 'female') return Math.round(base - 161);
  return Math.round(base - 78);
}

export function calcTDEE(p: Profile): number {
  // Apple Watch実測値があれば優先
  if (p.appleWatchCalories && p.appleWatchCalories > 0) {
    return p.appleWatchCalories;
  }
  return Math.round(calcBMR(p) * p.activityLevel);
}

export function calcTargetCalories(p: Profile): {
  targetCalories: number;
  weeklyChange: number;
  daysLeft: number | null;
  isUnsafe: boolean;
} {
  const tdee = calcTDEE(p);
  const minCal = p.gender === 'female' ? 1200 : 1500;
  if (p.goalType === 'maintain' || !p.targetDate) {
    return { targetCalories: tdee, weeklyChange: 0, daysLeft: null, isUnsafe: false };
  }
  const daysLeft = Math.max(1, Math.round((new Date(p.targetDate).getTime() - Date.now()) / 86400000));
  const weeklyChange = (p.targetWeight - p.weight) / (daysLeft / 7);
  const isUnsafe = Math.abs(weeklyChange) > 1.0;
  const safe = isUnsafe ? Math.sign(weeklyChange) * 1.0 : weeklyChange;
  let targetCalories = Math.round(tdee + (safe * 7200) / 7);
  if (targetCalories < minCal) targetCalories = minCal;
  return { targetCalories, weeklyChange: safe, daysLeft, isUnsafe };
}

export interface CalorieLimits {
  min: number;     // 最低限度（これ未満は危険）
  max: number;     // 上限（これを超えると目標に逆行）
  target: number;  // 推奨摂取量
  minLabel: string;
  maxLabel: string;
}

export function calcCalorieLimits(p: Profile): CalorieLimits {
  const tdee = calcTDEE(p);
  const bmr = calcBMR(p);

  if (p.goalType === 'lose') {
    // 最低限度 = BMR（臓器維持に必要な最低カロリー）
    // 上限 = TDEE（これ以上食べると減量しない）
    return {
      min: bmr,
      max: tdee,
      target: calcTargetCalories(p).targetCalories,
      minLabel: `基礎代謝 ${bmr.toLocaleString()}kcal`,
      maxLabel: `TDEE ${tdee.toLocaleString()}kcal`,
    };
  }
  if (p.goalType === 'gain') {
    // 最低限度 = TDEE + 100（余剰がないと筋肉が増えない）
    // 上限 = TDEE + 500（それ以上は脂肪になりやすい）
    return {
      min: tdee + 100,
      max: tdee + 500,
      target: calcTargetCalories(p).targetCalories,
      minLabel: `TDEE+100 ${(tdee + 100).toLocaleString()}kcal`,
      maxLabel: `TDEE+500 ${(tdee + 500).toLocaleString()}kcal`,
    };
  }
  // maintain: TDEE ± 200kcal
  return {
    min: tdee - 200,
    max: tdee + 200,
    target: tdee,
    minLabel: `TDEE-200 ${(tdee - 200).toLocaleString()}kcal`,
    maxLabel: `TDEE+200 ${(tdee + 200).toLocaleString()}kcal`,
  };
}

export function calcBMI(weight: number, height: number): number {
  return parseFloat((weight / Math.pow(height / 100, 2)).toFixed(1));
}

export function getBMIStatus(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: '低体重', color: 'text-blue-500' };
  if (bmi < 25)   return { label: '普通体重', color: 'text-green-500' };
  if (bmi < 30)   return { label: '過体重', color: 'text-yellow-500' };
  return { label: '肥満', color: 'text-red-500' };
}

/** 標準体重・適正体重の目安を返す */
export function calcIdealWeight(height: number): {
  standard: number;  // 身長²×22（標準体重）
  lower: number;     // BMI 18.5
  upper: number;     // BMI 24.9
} {
  const h = height / 100;
  return {
    standard: parseFloat((h * h * 22).toFixed(1)),
    lower: parseFloat((h * h * 18.5).toFixed(1)),
    upper: parseFloat((h * h * 24.9).toFixed(1)),
  };
}
