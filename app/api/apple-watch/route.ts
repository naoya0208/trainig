import { NextRequest, NextResponse } from 'next/server';

// Apple Watch Shortcuts連携: GET /api/apple-watch?calories=2500&token=xxx
export async function GET(req: NextRequest) {
  const calories = req.nextUrl.searchParams.get('calories');
  if (!calories || isNaN(Number(calories))) {
    return NextResponse.json({ error: 'calories param required' }, { status: 400 });
  }
  // クライアントサイドのlocalStorageに書き込めないため、
  // クッキーに一時保存してページ側で読み取る
  const res = NextResponse.redirect(new URL(`/profile?aw=${calories}`, req.url));
  res.cookies.set('aw_calories', calories, { maxAge: 60 * 60 * 24, path: '/' });
  return res;
}
