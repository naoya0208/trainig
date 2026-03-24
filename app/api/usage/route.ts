import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DAILY_LIMIT = 20;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// APIキーをそのままキーとして使う（短縮してプライバシー配慮）
function makeKey(apiKey: string): string {
  if (!apiKey) return 'server_default';
  // 末尾8文字だけ使う
  return `key_${apiKey.slice(-8)}`;
}

// GET: 今日の使用回数を取得
export async function GET(req: NextRequest) {
  const apiKey = req.nextUrl.searchParams.get('apiKey') ?? '';
  const key = makeKey(apiKey);
  const today = todayStr();

  const { data } = await supabase
    .from('api_usage')
    .select('count')
    .eq('key_id', key)
    .eq('date', today)
    .single();

  const count = data?.count ?? 0;
  return NextResponse.json({ count, remaining: Math.max(0, DAILY_LIMIT - count), date: today });
}

// POST: 使用回数をインクリメント
export async function POST(req: NextRequest) {
  const { apiKey } = await req.json();
  const key = makeKey(apiKey ?? '');
  const today = todayStr();

  const { data: existing } = await supabase
    .from('api_usage')
    .select('count')
    .eq('key_id', key)
    .eq('date', today)
    .single();

  const newCount = (existing?.count ?? 0) + 1;

  await supabase.from('api_usage').upsert({
    key_id: key,
    date: today,
    count: newCount,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key_id,date' });

  return NextResponse.json({ count: newCount, remaining: Math.max(0, DAILY_LIMIT - newCount) });
}
