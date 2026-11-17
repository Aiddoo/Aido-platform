// where가 설정의 시간대로 거르므로 설정 없는 행은 오지 않는다
export function withPreferenceTimezone<
  TRow extends { readonly preference: { readonly timezone: string } | null },
>(rows: readonly TRow[]): Array<TRow & { readonly timezone: string }> {
  return rows.flatMap((row) =>
    row.preference == null ? [] : [{ ...row, timezone: row.preference.timezone }],
  );
}
