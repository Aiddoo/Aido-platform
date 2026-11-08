import { TodoChangePolicy } from './todo-change.model';

describe('hasTodoUpdateChanges', () => {
  it.each([
    ['바뀐 칸이 없으면', { input: {} }, false],
    ['제목이 바뀌면', { input: { title: '달리기' } }, true],
    ['반복을 끝내면(repeat null)', { input: {}, repeat: null }, true],
  ] as const)('%s %s다', (_label, changes, expected) => {
    // When
    const result = TodoChangePolicy.hasTodoUpdateChanges(changes);

    // Then
    expect(result).toBe(expected);
  });
});

describe('hasOnlyDateChanges', () => {
  it.each([
    ['시작일만 바뀌면', { input: { startDate: '2026-11-06' } }, true],
    [
      '시작일과 종료일만 바뀌면',
      { input: { startDate: '2026-11-06', endDate: '2026-11-07' } },
      true,
    ],
    ['바뀐 칸이 없으면', { input: {} }, false],
    ['날짜와 제목이 함께 바뀌면', { input: { startDate: '2026-11-06', title: '달리기' } }, false],
    ['날짜와 함께 반복을 끝내면', { input: { startDate: '2026-11-06' }, repeat: null }, false],
  ] as const)('%s %s다', (_label, changes, expected) => {
    // When
    const result = TodoChangePolicy.hasOnlyDateChanges(changes);

    // Then
    expect(result).toBe(expected);
  });
});
