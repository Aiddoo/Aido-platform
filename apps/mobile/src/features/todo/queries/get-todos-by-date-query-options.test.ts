import { shouldPersistTodosByDate } from './get-todos-by-date-query-options';

describe('shouldPersistTodosByDate', () => {
  const todayKey = '2026-11-03';

  it.each(['2026-11-02', '2026-11-03', '2026-11-04'])('%s 목록은 기기에 남긴다', (date) => {
    // Given · When · Then
    expect(shouldPersistTodosByDate({ date, todayKey })).toBe(true);
  });

  it.each(['2026-11-01', '2026-11-05', '2026-10-03'])('%s 목록은 남기지 않는다', (date) => {
    // Given · When · Then
    expect(shouldPersistTodosByDate({ date, todayKey })).toBe(false);
  });

  it('달이 바뀌는 날에도 앞뒤 하루를 남긴다', () => {
    // Given · When · Then
    expect(shouldPersistTodosByDate({ date: '2026-10-31', todayKey: '2026-11-01' })).toBe(true);
    expect(shouldPersistTodosByDate({ date: '2027-01-01', todayKey: '2026-12-31' })).toBe(true);
  });
});
