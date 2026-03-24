export const USER_API_KEY_STORAGE = 'user_gemini_api_key';
export const DAILY_LIMIT = 20;

export function getUserApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(USER_API_KEY_STORAGE) ?? '';
}

// サーバーから残り回数を取得
export async function fetchRemaining(): Promise<number> {
  try {
    const apiKey = getUserApiKey();
    const res = await fetch(`/api/usage?apiKey=${encodeURIComponent(apiKey)}`);
    const data = await res.json();
    return data.remaining ?? DAILY_LIMIT;
  } catch {
    return DAILY_LIMIT;
  }
}

// サーバーに使用回数をインクリメント、残り回数を返す
export async function incrementUsage(): Promise<{ count: number; remaining: number }> {
  try {
    const apiKey = getUserApiKey();
    const res = await fetch('/api/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    return await res.json();
  } catch {
    return { count: 0, remaining: DAILY_LIMIT };
  }
}
