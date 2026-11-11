import { createParentTodo } from '@src/features/planning/todo/__tests__/sub-todo.fixtures';
import { createTodoDetails } from '@src/features/planning/todo/__tests__/todo.fixtures';

import { createNudgeLimitInfo } from '../__tests__/todo-nudge.fixtures';
import {
  isMessageTooLong,
  normalizeMessage,
  NudgeLimitPolicy,
  TodoNudgePolicy,
} from './todo-nudge.model';

const TODAY_KEY = '2026-02-25';
const NEXT_DAY_KEY = '2026-02-26';

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

describe('canNudgeTodoInRange', () => {
  const createInput = ({
    canNudge = true,
    completed = false,
    startDate = '2026-08-17',
    endDate = null,
  }: {
    canNudge?: boolean;
    completed?: boolean;
    startDate?: string;
    endDate?: string | null;
  } = {}) =>
    createTodoDetails({
      todo: createParentTodo({ completed, startDate, endDate }),
      permissions: { canEdit: false, canComment: true, canNudge },
    });

  it('오늘이 친구의 미완료 할 일 범위 안이면 true를 반환한다', () => {
    // Given
    // 시작일보다 늦어도 종료일 전이면 서버의 기간 할 일 정책과 같다.
    const input = createInput({ startDate: '2026-08-16', endDate: '2026-08-18' });

    // When
    const result = TodoNudgePolicy.canNudgeTodoInRange(input, '2026-08-17');

    // Then
    expect(result).toBe(true);
  });

  it('서버 권한이 없으면 오늘의 미완료 할 일도 false를 반환한다', () => {
    // Given
    // 자기 할 일은 details.permissions.canNudge가 false다.
    const input = createInput({ canNudge: false });

    // When
    const result = TodoNudgePolicy.canNudgeTodoInRange(input, '2026-08-17');

    // Then
    expect(result).toBe(false);
  });

  it('완료한 할 일은 오늘 범위 안이어도 false를 반환한다', () => {
    // Given
    const input = createInput({ completed: true });

    // When
    const result = TodoNudgePolicy.canNudgeTodoInRange(input, '2026-08-17');

    // Then
    expect(result).toBe(false);
  });

  it('지난 단일 날짜 할 일은 false를 반환한다', () => {
    // Given
    // 8월 17일에 첨부 화면의 8월 16일 할 일을 보는 경우다.
    const input = createInput({ startDate: '2026-08-16', endDate: null });

    // When
    const result = TodoNudgePolicy.canNudgeTodoInRange(input, '2026-08-17');

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

describe('isLimitReached', () => {
  it('remainingToday가 0이면 true를 반환한다', () => {
    // Given
    const limitInfo = createNudgeLimitInfo({ remainingToday: 0 });

    // When
    const result = NudgeLimitPolicy.isLimitReached(limitInfo);

    // Then
    expect(result).toBe(true);
  });

  it('remainingToday가 양수이면 false를 반환한다', () => {
    // Given
    const limitInfo = createNudgeLimitInfo({ remainingToday: 2 });

    // When
    const result = NudgeLimitPolicy.isLimitReached(limitInfo);

    // Then
    expect(result).toBe(false);
  });

  it('remainingToday가 1이면 마지막 한 번이 남아 false를 반환한다', () => {
    // Given
    const limitInfo = createNudgeLimitInfo({ remainingToday: 1 });

    // When
    const result = NudgeLimitPolicy.isLimitReached(limitInfo);

    // Then
    expect(result).toBe(false);
  });

  it('remainingToday가 null (무제한)이면 false를 반환한다', () => {
    // Given
    const limitInfo = createNudgeLimitInfo({ remainingToday: null });

    // When
    const result = NudgeLimitPolicy.isLimitReached(limitInfo);

    // Then
    expect(result).toBe(false);
  });
});
