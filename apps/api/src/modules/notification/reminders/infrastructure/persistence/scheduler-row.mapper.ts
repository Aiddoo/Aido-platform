// where가 설정의 시간대로 거르므로 설정 없는 행은 오지 않는다
export function withPreferenceTimezone<
  TRow extends { readonly preference: { readonly timezone: string } | null },
>(rows: readonly TRow[]): Array<TRow & { readonly timezone: string }> {
  return rows.flatMap((row) =>
    row.preference == null ? [] : [{ ...row, timezone: row.preference.timezone }],
  );
}

// 구간 안 할 일마다 완료 여부 하나를 읽은 모양으로 바꾼다
export function toTodoCompletions(
  completions: readonly boolean[],
): Array<{ readonly completed: boolean }> {
  return completions.map((completed) => ({ completed }));
}

export function toReminderCountUser(row: {
  readonly id: string;
  readonly locale: string;
  readonly todoCount: number;
}) {
  return { id: row.id, preference: { locale: row.locale }, _count: { todos: row.todoCount } };
}

export function toEveningReminderUser(row: {
  readonly id: string;
  readonly completions: readonly boolean[];
  readonly currentStreak: number;
  readonly lastCompletedDate: Temporal.PlainDate | null;
  readonly locale: string;
  readonly timezone: string;
}) {
  const { id, completions, timezone, ...preference } = row;
  return {
    id,
    todos: toTodoCompletions(completions),
    preference: { ...preference, timezone },
    timezone,
  };
}
