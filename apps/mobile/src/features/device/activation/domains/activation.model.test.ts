import { toInstant } from '@src/shared/date/instant';

import type { ActivationProgress } from './activation.model';
import { ActivationPolicy } from './activation.model';

const createProgress = (overrides?: Partial<ActivationProgress>): ActivationProgress => ({
  todoCreatedAt: null,
  activatedAt: null,
  ...overrides,
});

describe('canActivate', () => {
  it.each([
    { title: '이 기기에서 만든 기록이 없으면 활성화로 세지 않는다', progress: {}, expected: false },
    {
      title: '만든 뒤 아직 활성화하지 않았으면 센다',
      progress: { todoCreatedAt: toInstant('2026-08-02T10:00:00.000Z') },
      expected: true,
    },
    {
      title: '이미 활성화했으면 다시 세지 않는다',
      progress: {
        todoCreatedAt: toInstant('2026-08-02T10:00:00.000Z'),
        activatedAt: toInstant('2026-08-02T12:00:00.000Z'),
      },
      expected: false,
    },
  ])('$title', ({ progress, expected }) => {
    // When
    const result = ActivationPolicy.canActivate(createProgress(progress));

    // Then
    expect(result).toBe(expected);
  });
});

describe('withTodoCreated', () => {
  it('처음 만든 시각을 덮어쓰지 않는다', () => {
    // Given
    const progress = createProgress({ todoCreatedAt: toInstant('2026-08-02T10:00:00.000Z') });

    // When
    const result = ActivationPolicy.withTodoCreated(
      progress,
      toInstant('2026-08-03T10:00:00.000Z'),
    );

    // Then
    expect(result).toBe(progress);
  });
});

describe('shouldOfferChecklist', () => {
  const user = { id: 'new-user', createdAt: toInstant('2026-08-01T09:00:00.000Z') };

  // 서버 캠페인·출시 시각과 상관없이 가입 시각만 본다
  it.each([
    ['가입한 순간(0일)', '2026-08-01T09:00:00.000Z', true],
    ['7일이 되기 1ms 전(6.99일)', '2026-08-08T08:59:59.999Z', true],
    ['7일이 되는 순간', '2026-08-08T09:00:00.000Z', false],
    ['기기 시계가 가입보다 앞섬', '2026-08-01T08:59:59.999Z', false],
  ])('아직 활성화하지 않은 계정은 %s에 보이는지 %s다', (_label, now, expected) => {
    // When
    const result = ActivationPolicy.shouldOfferChecklist(user, {
      progress: createProgress(),
      now: toInstant(now),
    });

    // Then
    expect(result).toBe(expected);
  });

  it('가입 7일 안이어도 활성화한 계정에는 보이지 않는다', () => {
    // When
    const result = ActivationPolicy.shouldOfferChecklist(user, {
      progress: createProgress({
        todoCreatedAt: toInstant('2026-08-02T00:00:00.000Z'),
        activatedAt: toInstant('2026-08-02T00:01:00.000Z'),
      }),
      now: toInstant('2026-08-02T00:02:00.000Z'),
    });

    // Then
    expect(result).toBe(false);
  });
});

describe('hasFinishedRequiredSteps', () => {
  it('할 일을 만들고 완료하면 친구 초대를 하지 않았어도 필수 단계를 끝낸 것이다', () => {
    // Given
    const steps = { hasCreatedTodo: true, hasCompletedTodo: true };

    // When
    const result = ActivationPolicy.hasFinishedRequiredSteps(steps);

    // Then
    expect(result).toBe(true);
  });

  it('완료한 할 일이 없으면 필수 단계가 남아 있다', () => {
    // Given
    const steps = { hasCreatedTodo: true, hasCompletedTodo: false };

    // When
    const result = ActivationPolicy.hasFinishedRequiredSteps(steps);

    // Then
    expect(result).toBe(false);
  });
});

describe('getChecklistSteps', () => {
  it('이 기기 기록이 없어도 서버에 할 일·완료한 할 일이 있으면 단계를 끝낸다', () => {
    // Given
    const progress = createProgress();

    // When
    const created = ActivationPolicy.getChecklistSteps(progress, {
      hasTodo: true,
      hasCompletedTodo: false,
    });
    const completed = ActivationPolicy.getChecklistSteps(progress, {
      hasTodo: true,
      hasCompletedTodo: true,
    });

    // Then
    expect(created).toEqual({ hasCreatedTodo: true, hasCompletedTodo: false });
    expect(completed).toEqual({ hasCreatedTodo: true, hasCompletedTodo: true });
  });

  it('서버 기록을 못 읽었으면 이 기기 기록으로 판단한다', () => {
    // Given
    const progress = createProgress({ todoCreatedAt: toInstant('2026-08-02T00:00:00.000Z') });

    // When
    const result = ActivationPolicy.getChecklistSteps(progress, undefined);

    // Then
    expect(result).toEqual({ hasCreatedTodo: true, hasCompletedTodo: false });
  });

  it('서버에서 할 일을 지워도 이 기기에서 끝낸 단계는 되돌리지 않는다', () => {
    // Given
    const progress = createProgress({
      todoCreatedAt: toInstant('2026-08-02T00:00:00.000Z'),
      activatedAt: toInstant('2026-08-02T00:01:00.000Z'),
    });

    // When
    const result = ActivationPolicy.getChecklistSteps(progress, {
      hasTodo: false,
      hasCompletedTodo: false,
    });

    // Then
    expect(result).toEqual({ hasCreatedTodo: true, hasCompletedTodo: true });
  });
});

describe('getDaysSinceSignup', () => {
  const user = { id: 'new', createdAt: toInstant('2026-08-01T09:00:00.000Z') };

  it('가입한 순간에는 0일이다', () => {
    // When
    const days = ActivationPolicy.getDaysSinceSignup(user, user.createdAt);

    // Then
    expect(days).toBe(0);
  });

  it('24시간이 되기 1ms 전까지는 0일이다', () => {
    // Given
    const now = toInstant('2026-08-02T08:59:59.999Z');

    // When
    const days = ActivationPolicy.getDaysSinceSignup(user, now);

    // Then
    // 23:59:59.999 / 24h → 내림 0일
    expect(days).toBe(0);
  });

  it('24시간이 되면 1일이다', () => {
    // Given
    const now = toInstant('2026-08-02T09:00:00.000Z');

    // When
    const days = ActivationPolicy.getDaysSinceSignup(user, now);

    // Then
    expect(days).toBe(1);
  });

  it('달력 날짜가 아니라 지난 시간으로 센다', () => {
    // Given
    const now = toInstant('2026-08-08T08:59:59.999Z');

    // When
    const days = ActivationPolicy.getDaysSinceSignup(user, now);

    // Then
    // 7일 - 1ms → 내림 6일
    expect(days).toBe(6);
  });

  it('기기 시계가 가입보다 앞서도 음수가 아니라 0일이다', () => {
    // Given
    const now = toInstant('2026-08-01T08:00:00.000Z');

    // When
    const days = ActivationPolicy.getDaysSinceSignup(user, now);

    // Then
    expect(days).toBe(0);
  });
});
