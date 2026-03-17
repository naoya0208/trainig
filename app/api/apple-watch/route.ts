import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const calories = req.nextUrl.searchParams.get('calories');
  if (!calories || isNaN(Number(calories))) {
    return new Response('<html><body><p>エラー: calories が必要です</p></body></html>', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  const kcal = Math.round(parseFloat(calories));

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Apple Watch 連携</title>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f0f9ff; }
    .card { background: white; border-radius: 20px; padding: 40px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 320px; width: 90%; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    .kcal { font-size: 36px; font-weight: bold; color: #2563eb; }
    .label { color: #9ca3af; font-size: 14px; margin-top: 4px; }
    .msg { color: #16a34a; font-weight: bold; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⌚</div>
    <div class="kcal">${kcal.toLocaleString()} kcal</div>
    <div class="label">Apple Watch 消費カロリー</div>
    <div class="msg" id="msg">保存中...</div>
  </div>
  <script>
    try {
      var stored = localStorage.getItem('ct_profile');
      if (stored) {
        var profile = JSON.parse(stored);
        profile.appleWatchCalories = ${kcal};
        localStorage.setItem('ct_profile', JSON.stringify(profile));
        document.getElementById('msg').textContent = '✓ 保存しました';
      } else {
        document.getElementById('msg').textContent = '⚠️ プロフィールを先に設定してください';
      }
    } catch(e) {
      document.getElementById('msg').textContent = 'エラーが発生しました';
    }
    setTimeout(function() { window.location.href = '/'; }, 2000);
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
