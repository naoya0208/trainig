const KEY = 'gemini_usage';
const DAILY_LIMIT = 20;

interface Usage {
  date: string;
  count: number;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function getUsage(): Usage {
  if (typeof window === 'undefined') return { date: todayStr(), count: 0 };
  const raw = localStorage.getItem(KEY);
  if (!raw) return { date: todayStr(), count: 0 };
  const usage: Usage = JSON.parse(raw);
  if (usage.date !== todayStr()) return { date: todayStr(), count: 0 };
  return usage;
}

export function incrementUsage() {
  const usage = getUsage();
  const next = { date: todayStr(), count: usage.count + 1 };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function getRemainingCount() {
  return Math.max(0, DAILY_LIMIT - getUsage().count);
}
