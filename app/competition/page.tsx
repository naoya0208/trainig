'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { sumMicros } from '@/lib/micros';
import { localDate } from '@/lib/date';

function getToday() { return localDate(); }

function daysDiff(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
}

// ─── プロトコル目標値計算 ───────────────────────────────────────────

/** ウォーターローディング: 大会まで何日かで今日の水分目標(ml)を返す */
function waterTarget(daysLeft: number): { ml: number; phase: string } {
  if (daysLeft >= 6) return { ml: 8000, phase: '増水期（最大化）' };
  if (daysLeft === 5) return { ml: 7000, phase: '増水期' };
  if (daysLeft === 4) return { ml: 5000, phase: '移行期' };
  if (daysLeft === 3) return { ml: 3000, phase: '減水開始' };
  if (daysLeft === 2) return { ml: 1500, phase: '減水期' };
  if (daysLeft === 1) return { ml: 500,  phase: '断水前日' };
  if (daysLeft === 0) return { ml: 200,  phase: '大会当日' };
  return { ml: 0, phase: '大会終了' };
}

/** 塩抜き: 今日のナトリウム上限(mg) */
function sodiumTarget(daysLeft: number): { mg: number; phase: string } {
  if (daysLeft >= 7) return { mg: 2000, phase: '通常期（加工食品回避）' };
  if (daysLeft >= 4) return { mg: 1000, phase: '減塩期' };
  if (daysLeft >= 2) return { mg: 400,  phase: '塩抜き本番' };
  if (daysLeft === 1) return { mg: 200,  phase: '完全塩抜き' };
  if (daysLeft === 0) return { mg: 100,  phase: '大会当日' };
  return { mg: 2000, phase: '大会終了' };
}

/** カーボディプリート: 今日の炭水化物上限(g) */
function carbDepTarget(daysLeft: number, bodyWeight: number): { g: number; phase: string } {
  if (daysLeft >= 7) return { g: Math.round(bodyWeight * 3),  phase: '通常期' };
  if (daysLeft >= 4) return { g: 50,                           phase: 'ディプリート開始' };
  if (daysLeft >= 2) return { g: 30,                           phase: 'ディプリート本番' };
  return { g: 50, phase: 'カーボアップ期（移行）' };
}

/** カーボアップ: 今日の炭水化物目標(g) */
function carbLoadTarget(daysLeft: number, bodyWeight: number): { g: number; phase: string } {
  if (daysLeft > 2)  return { g: Math.round(bodyWeight * 3),  phase: 'ディプリート期（待機）' };
  if (daysLeft === 2) return { g: Math.round(bodyWeight * 8),  phase: 'カーボアップ1日目' };
  if (daysLeft === 1) return { g: Math.round(bodyWeight * 10), phase: 'カーボアップ2日目（最大化）' };
  if (daysLeft === 0) return { g: Math.round(bodyWeight * 4),  phase: '大会当日（維持）' };
  return { g: Math.round(bodyWeight * 3), phase: '大会終了' };
}

// ─── UI部品 ────────────────────────────────────────────────────────

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-200'}`}>
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-7' : 'translate-x-1'}`} />
    </button>
  );
}

function ProgressBar({ value, max, color = 'bg-blue-500' }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.round(value / max * 100));
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-1">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── メインページ ──────────────────────────────────────────────────

export default function CompetitionPage() {
  const { profile, foodEntries, waterEntries, competitionSettings, setCompetitionSettings, hydrate } = useStore();

  useEffect(() => { hydrate(); }, []);

  const today = getToday();
  const [compDate, setCompDate] = useState(competitionSettings?.date ?? '');

  const settings = competitionSettings ?? {
    date: '', waterLoading: false, sodiumCut: false, carbDepletion: false, carbLoad: false,
  };

  function toggle(key: 'waterLoading' | 'sodiumCut' | 'carbDepletion' | 'carbLoad') {
    setCompetitionSettings({ ...settings, date: compDate || settings.date, [key]: !settings[key] });
  }

  function handleDateChange(date: string) {
    setCompDate(date);
    setCompetitionSettings({ ...settings, date });
  }

  const daysLeft = compDate ? daysDiff(today, compDate) : null;
  const bodyWeight = profile?.weight ?? 70;

  // 今日の食事データ
  const todayFoods = foodEntries.filter(e => e.date === today);
  const micros = sumMicros(todayFoods);
  const todayCarbs = Math.round(todayFoods.reduce((s, e) => s + e.carbs, 0) * 10) / 10;
  const todaySodium = Math.round(micros.sodium ?? 0);
  const todayPotassium = Math.round(micros.potassium ?? 0);
  const todayDrinkMl = waterEntries.find(e => e.date === today)?.ml ?? 0;
  const todayFoodWaterMl = Math.round(sumMicros(todayFoods).water ?? 0);
  const todayWaterMl = todayDrinkMl + todayFoodWaterMl;

  // Na:K比
  const naKRatio = todayPotassium > 0 ? Math.round((todaySodium / todayPotassium) * 100) / 100 : null;
  const naKOk = naKRatio !== null && naKRatio <= 1.0;

  // 各プロトコル目標
  const wTarget = daysLeft !== null ? waterTarget(daysLeft) : null;
  const sTarget = daysLeft !== null ? sodiumTarget(daysLeft) : null;
  const cdTarget = daysLeft !== null ? carbDepTarget(daysLeft, bodyWeight) : null;
  const clTarget = daysLeft !== null ? carbLoadTarget(daysLeft, bodyWeight) : null;

  const daysLabel = daysLeft === null ? '未設定' : daysLeft > 0 ? `あと${daysLeft}日` : daysLeft === 0 ? '本日大会！' : `大会から${-daysLeft}日後`;

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">大会準備</h1>
      <p className="text-sm text-gray-400 mb-5">コンテスト・大会に向けたプロトコル管理</p>

      {/* 大会日設定 */}
      <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-500 mb-3">大会日</p>
        <div className="flex items-center gap-3">
          <input type="date" value={compDate} onChange={e => handleDateChange(e.target.value)}
            min={today}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {daysLeft !== null && (
            <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${daysLeft > 0 ? 'bg-blue-50 text-blue-600' : daysLeft === 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'}`}>
              {daysLabel}
            </span>
          )}
        </div>
      </div>

      {/* Na/K バランス */}
      <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-500">塩分・カリウムバランス（今日）</p>
          {naKRatio !== null && (
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${naKOk ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
              Na:K = {naKRatio} {naKOk ? '良好' : '塩分過多'}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-red-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">ナトリウム (Na)</p>
            <p className="text-xl font-bold text-red-500">{todaySodium}<span className="text-xs font-normal text-gray-400 ml-1">mg</span></p>
            <ProgressBar value={todaySodium} max={2000} color={todaySodium > 2000 ? 'bg-red-500' : 'bg-amber-400'} />
            <p className="text-xs text-gray-400 mt-1">上限 2000mg</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">カリウム (K)</p>
            <p className="text-xl font-bold text-emerald-600">{todayPotassium}<span className="text-xs font-normal text-gray-400 ml-1">mg</span></p>
            <ProgressBar value={todayPotassium} max={3500} color="bg-emerald-400" />
            <p className="text-xs text-gray-400 mt-1">目標 3500mg</p>
          </div>
        </div>
        {naKRatio === null ? (
          <p className="text-xs text-gray-300 text-center py-2">食事を記録するとNa:K比が表示されます</p>
        ) : (
          <div className={`rounded-xl p-3 text-sm ${naKOk ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            <p className={`font-semibold ${naKOk ? 'text-emerald-700' : 'text-amber-700'}`}>
              {naKOk ? '✓ バランス良好' : '⚠ カリウムを増やしましょう'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {naKOk ? 'Na:K比が1.0以下で、むくみ・高血圧リスクが低い状態です。' : `理想はNa:K≤1.0。バナナ・アボカド・納豆・ほうれん草などでカリウムを補給してください。`}
            </p>
          </div>
        )}
      </div>

      {/* プロトコルカード群 */}
      {[
        {
          key: 'waterLoading' as const,
          label: 'ウォーターローディング',
          desc: '大会前に水分を一時的に増やしてADHを抑制し、直前に水抜きすることで絞りを出す手法',
          icon: '💧',
          enabled: settings.waterLoading,
          target: wTarget ? `今日の目標: ${(wTarget.ml / 1000).toFixed(1)}L` : null,
          phase: wTarget?.phase,
          current: todayWaterMl,
          max: wTarget?.ml ?? 0,
          unit: 'ml',
          color: 'bg-blue-500',
          tip: wTarget && daysLeft !== null && daysLeft <= 1 ? '⚠ 水分を急激に制限中。脱水に注意してください。' : null,
          rows: wTarget ? [
            { label: '飲料', value: `${todayDrinkMl} ml` },
            { label: '食品', value: `${todayFoodWaterMl} ml` },
            { label: '合計', value: `${todayWaterMl} ml` },
            { label: '目標', value: `${wTarget.ml} ml` },
            { label: '達成率', value: `${Math.min(100, Math.round(todayWaterMl / wTarget.ml * 100))}%` },
          ] : [],
        },
        {
          key: 'sodiumCut' as const,
          label: '塩抜き',
          desc: '大会前にナトリウムを制限し、皮下水分を減らして筋肉の境界線を際立たせる',
          icon: '🧂',
          enabled: settings.sodiumCut,
          target: sTarget ? `今日の上限: ${sTarget.mg}mg` : null,
          phase: sTarget?.phase,
          current: todaySodium,
          max: sTarget?.mg ?? 2000,
          unit: 'mg',
          color: todaySodium > (sTarget?.mg ?? 2000) ? 'bg-red-500' : 'bg-amber-400',
          tip: sTarget && todaySodium > sTarget.mg ? `⚠ 上限 ${sTarget.mg}mg を超過しています。加工食品・調味料を避けてください。` : null,
          rows: sTarget ? [
            { label: '摂取量', value: `${todaySodium} mg` },
            { label: '上限', value: `${sTarget.mg} mg` },
            { label: '残り', value: `${Math.max(0, sTarget.mg - todaySodium)} mg` },
          ] : [],
        },
        {
          key: 'carbDepletion' as const,
          label: 'カーボディプリート',
          desc: '大会数日前に糖質を極限まで制限し、グリコーゲンを枯渇させてカーボアップの効果を最大化する',
          icon: '📉',
          enabled: settings.carbDepletion,
          target: cdTarget ? `今日の上限: ${cdTarget.g}g` : null,
          phase: cdTarget?.phase,
          current: todayCarbs,
          max: cdTarget?.g ?? 50,
          unit: 'g',
          color: todayCarbs > (cdTarget?.g ?? 50) ? 'bg-red-500' : 'bg-purple-400',
          tip: cdTarget && todayCarbs > cdTarget.g ? `⚠ 上限 ${cdTarget.g}g を超過。白米・パン・麺類を避けてください。` : null,
          rows: cdTarget ? [
            { label: '摂取量', value: `${todayCarbs} g` },
            { label: '上限', value: `${cdTarget.g} g` },
            { label: '残り', value: `${Math.max(0, cdTarget.g - todayCarbs)} g` },
          ] : [],
        },
        {
          key: 'carbLoad' as const,
          label: 'カーボアップ',
          desc: '大会直前に大量の糖質を摂取し、枯渇したグリコーゲンを超回復させて筋肉を最大限に張らせる',
          icon: '📈',
          enabled: settings.carbLoad,
          target: clTarget ? `今日の目標: ${clTarget.g}g（体重×${daysLeft === 1 ? 10 : 8}g）` : null,
          phase: clTarget?.phase,
          current: todayCarbs,
          max: clTarget?.g ?? 1,
          unit: 'g',
          color: 'bg-green-500',
          tip: clTarget && daysLeft !== null && daysLeft <= 2 && todayCarbs < clTarget.g * 0.8 ? `まだ${clTarget.g - todayCarbs}g不足しています。白米・うどん・バナナなどで補給してください。` : null,
          rows: clTarget ? [
            { label: '摂取量', value: `${todayCarbs} g` },
            { label: '目標', value: `${clTarget.g} g` },
            { label: '達成率', value: `${Math.min(100, Math.round(todayCarbs / clTarget.g * 100))}%` },
          ] : [],
        },
      ].map(proto => (
        <div key={proto.key} className={`bg-white rounded-2xl p-5 mb-4 shadow-sm ${!proto.enabled ? 'opacity-60' : ''}`}>
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{proto.icon}</span>
              <div>
                <p className="font-semibold text-gray-800">{proto.label}</p>
                {proto.enabled && proto.phase && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{proto.phase}</span>
                )}
              </div>
            </div>
            <Toggle enabled={proto.enabled} onToggle={() => toggle(proto.key)} />
          </div>
          <p className="text-xs text-gray-400 mb-3">{proto.desc}</p>

          {proto.enabled && daysLeft !== null ? (
            <>
              {proto.target && (
                <p className="text-sm font-bold text-gray-700 mb-2">{proto.target}</p>
              )}
              <ProgressBar value={proto.current} max={proto.max} color={proto.color} />
              <div className="grid grid-cols-3 gap-2 mt-3">
                {proto.rows.map(r => (
                  <div key={r.label} className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-gray-400">{r.label}</p>
                    <p className="text-sm font-bold text-gray-700">{r.value}</p>
                  </div>
                ))}
              </div>
              {proto.tip && (
                <div className="mt-3 bg-amber-50 rounded-xl px-3 py-2 text-xs text-amber-700">{proto.tip}</div>
              )}
            </>
          ) : proto.enabled && daysLeft === null ? (
            <p className="text-xs text-gray-300 text-center py-2">大会日を設定すると目標が表示されます</p>
          ) : null}
        </div>
      ))}

      {/* タイムライン */}
      {daysLeft !== null && daysLeft > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-500 mb-4">大会前プロトコル推奨スケジュール</p>
          {[
            { day: 7, label: 'D-7〜D-5', items: ['ウォーターローディング開始（7〜8L/日）', 'ナトリウム制限開始（加工食品回避）'] },
            { day: 4, label: 'D-4〜D-3', items: ['カーボディプリート開始（50g以下）', '水分を徐々に減らす（5L→3L）', 'ナトリウム1000mg以下'] },
            { day: 2, label: 'D-2〜D-1', items: ['カーボアップ開始（体重×8〜10g）', '水分1.5L以下', 'ナトリウム400mg以下'] },
            { day: 0, label: '大会当日', items: ['水分最小限（200ml程度）', '塩分ほぼゼロ', '軽い糖質補給（ゼリーなど）'] },
          ].map(phase => (
            <div key={phase.day} className={`flex gap-3 mb-4 last:mb-0 ${daysLeft > phase.day + 2 ? 'opacity-30' : daysLeft <= phase.day ? 'opacity-100' : 'opacity-70'}`}>
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full mt-0.5 ${daysLeft <= phase.day ? 'bg-blue-600' : 'bg-gray-200'}`} />
                <div className="w-0.5 bg-gray-100 flex-1 mt-1" />
              </div>
              <div className="pb-4">
                <p className={`text-sm font-bold mb-1 ${daysLeft <= phase.day ? 'text-blue-600' : 'text-gray-400'}`}>{phase.label}</p>
                {phase.items.map(item => (
                  <p key={item} className="text-xs text-gray-500">• {item}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
