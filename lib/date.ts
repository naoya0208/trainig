/** ローカル日付文字列 YYYY-MM-DD（UTCではなく端末のタイムゾーン基準） */
export function localDate(d = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export function localDateOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return localDate(d);
}
