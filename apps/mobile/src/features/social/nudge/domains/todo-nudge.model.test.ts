import { createParentTodo } from '@src/features/planning/todo/__tests__/sub-todo.fixtures';
import { toInstant } from '@src/shared/date/instant';
import { createDateKey } from '@src/testing/date-key';

import {
  isMessageTooLong,
  type NudgeCooldownInfo,
  NudgeCooldownPolicy,
  normalizeMessage,
  TodoNudgePolicy,
} from './todo-nudge.model';

const TODAY_KEY = createDateKey('2026-02-25');
const NEXT_DAY_KEY = createDateKey('2026-02-26');

describe('canNudgeTodoOnDate', () => {
  it('미완료 + 오늘이면 true를 반환한다', () => {
    // Given
    const todo = createParentTodo({ completed: false });

    // When
    const result = TodoNudgePolicy.canNudgeTodoOnDate(todo, TODAY_KEY, TODAY_KEY);

    // Then
    expect(result).toBe(true);
  });

  it('완료된 할 일은 오늘이어도 false를 반환한다', () => {
    // Given
    const todo = createParentTodo({ completed: true });

    // When
    const result = TodoNudgePolicy.canNudgeTodoOnDate(todo, TODAY_KEY, TODAY_KEY);

    // Then
    expect(result).toBe(false);
  });

  it('미완료여도 오늘이 아니면 false를 반환한다', () => {
    // Given
    const todo = createParentTodo({ completed: false });

    // When
    const result = TodoNudgePolicy.canNudgeTodoOnDate(todo, NEXT_DAY_KEY, TODAY_KEY);

    // Then
    expect(result).toBe(false);
  });
});

describe('normalizeMessage', () => {
  it('메시지 칸이 없으면 undefined를 반환한다', () => {
    // Given
    const input = {};

    // When
    const result = normalizeMessage(input);

    // Then
    expect(result).toBeUndefined();
  });

  it.each(['', '   '])('공백뿐인 메시지 "%s"면 undefined를 반환한다', (message) => {
    // Given
    const input = { message };

    // When
    const result = normalizeMessage(input);

    // Then
    expect(result).toBeUndefined();
  });

  it('앞뒤 공백을 제거한 문자열을 반환한다', () => {
    // Given
    const input = { message: '  화이팅!  ' };

    // When
    const result = normalizeMessage(input);

    // Then
    expect(result).toBe('화이팅!');
  });
});

describe('isMessageTooLong', () => {
  it('200자 이하이면 false를 반환한다', () => {
    // Given
    const input = { message: 'a'.repeat(200) };

    // When
    const result = isMessageTooLong(input);

    // Then
    expect(result).toBe(false);
  });

  it('201자 이상이면 true를 반환한다', () => {
    // Given
    const input = { message: 'a'.repeat(201) };

    // When
    const result = isMessageTooLong(input);

    // Then
    expect(result).toBe(true);
  });

  it('메시지 칸이 없으면 false를 반환한다', () => {
    // Given
    const input = {};

    // When
    const result = isMessageTooLong(input);

    // Then
    expect(result).toBe(false);
  });

  it('공백 포함 200자 초과 시 trim 후 판단한다', () => {
    // Given
    // 앞뒤 공백 제거하면 200자
    const input = { message: ` ${'a'.repeat(200)} ` };

    // When
    const result = isMessageTooLong(input);

    // Then
    expect(result).toBe(false);
  });
});

describe('canNudgeAfterCooldown', () => {
  // 10:00Z에 끝나는 쿨다운을 받은 뒤 화면을 켜 두었다
  const COOLING_DOWN: NudgeCooldownInfo = {
    canNudge: false,
    cooldownEndsAt: toInstant('2026-11-18T10:00:00.000Z'),
    remainingSeconds: 3600,
  };

  it.each([
    { now: '2026-11-18T09:59:59.999Z', expected: false },
    { now: '2026-11-18T10:00:00.000Z', expected: true },
  ])('쿨다운이 10:00Z에 끝나면 $now에 찌를 수 있음은 $expected다', ({ now, expected }) => {
    // When
    const canNudge = NudgeCooldownPolicy.canNudgeAfterCooldown(COOLING_DOWN, toInstant(now));

    // Then
    expect(canNudge).toBe(expected);
  });

  it('서버가 찌를 수 있다고 했으면 쿨다운 끝 순간과 무관하게 찌를 수 있다', () => {
    // Given
    const available: NudgeCooldownInfo = {
      canNudge: true,
      cooldownEndsAt: null,
      remainingSeconds: null,
    };

    // When
    const canNudge = NudgeCooldownPolicy.canNudgeAfterCooldown(
      available,
      toInstant('2026-11-18T09:00:00.000Z'),
    );

    // Then
    expect(canNudge).toBe(true);
  });
});
