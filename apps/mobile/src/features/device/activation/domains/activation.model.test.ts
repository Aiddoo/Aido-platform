import type { FeatureCampaignConfig } from '@src/features/app-config/feature-campaign/schemas/feature-campaign.schema';
import { toInstant } from '@src/shared/date/instant';

import type { ActivationProgress } from '../schemas/activation.schema';
import { ActivationPolicy } from './activation.model';

const LAUNCHED_AT = new Date('2026-08-01T00:00:00.000Z');

const createConfig = (
  overrides?: Partial<Extract<FeatureCampaignConfig, { enabled: true }>>,
): FeatureCampaignConfig => ({
  enabled: true,
  campaignId: 'feature-discovery-2026-08',
  minAppVersion: '1.8.0',
  launchedAt: toInstant(LAUNCHED_AT.toISOString()),
  autoOpen: true,
  ...overrides,
});

const createProgress = (overrides?: Partial<ActivationProgress>): ActivationProgress => ({
  todoCreatedAt: null,
  activatedAt: null,
  pushRegistrationUnlockedAt: null,
  ...overrides,
});

describe('shouldOfferChecklist', () => {
  const now = toInstant('2026-08-02T00:00:00.000Z');

  it('캠페인 시작 시각에 가입한 사용자를 신규 코호트로 분류한다', () => {
    // Given
    const user = { id: 'new-user', createdAt: toInstant('2026-08-01T00:00:00.000Z') };

    // When
    const result = ActivationPolicy.shouldOfferChecklist({
      config: createConfig(),
      user,
      progress: createProgress(),
      now,
    });

    // Then
    expect(result).toBe(true);
  });

  it('캠페인 시작 전에 가입한 기존 사용자는 신규 코호트가 아니다', () => {
    // Given
    const user = { id: 'existing-user', createdAt: toInstant('2026-07-31T23:59:59.999Z') };

    // When
    const result = ActivationPolicy.shouldOfferChecklist({
      config: createConfig(),
      user,
      progress: createProgress(),
      now,
    });

    // Then
    expect(result).toBe(false);
  });

  it('비활성 또는 알 수 없는 캠페인은 신규 코호트를 만들지 않는다', () => {
    // Given
    const user = { id: 'new-user', createdAt: toInstant(LAUNCHED_AT.toISOString()) };

    // When
    const disabled = ActivationPolicy.shouldOfferChecklist({
      config: { enabled: false },
      user,
      progress: createProgress(),
      now,
    });
    const unknown = ActivationPolicy.shouldOfferChecklist({
      config: createConfig({ campaignId: 'unknown-campaign' }),
      user,
      progress: createProgress(),
      now,
    });

    // Then
    expect(disabled).toBe(false);
    expect(unknown).toBe(false);
  });

  it('가입 후 7일 미만인 미활성 신규 사용자에게 체크리스트를 표시한다', () => {
    // Given
    const user = { id: 'new-user', createdAt: toInstant(LAUNCHED_AT.toISOString()) };
    const lastDay = toInstant('2026-08-07T23:59:59.999Z');

    // When
    const result = ActivationPolicy.shouldOfferChecklist({
      config: createConfig(),
      user,
      progress: createProgress(),
      now: lastDay,
    });

    // Then
    expect(result).toBe(true);
  });

  it('활성화됐거나 가입 후 7일이 지난 사용자는 체크리스트를 숨긴다', () => {
    // Given
    const user = { id: 'new-user', createdAt: toInstant(LAUNCHED_AT.toISOString()) };

    // When
    const activated = ActivationPolicy.shouldOfferChecklist({
      config: createConfig(),
      user,
      progress: createProgress({ activatedAt: toInstant('2026-08-02T00:00:00.000Z') }),
      now: toInstant('2026-08-02T00:00:01.000Z'),
    });
    const expired = ActivationPolicy.shouldOfferChecklist({
      config: createConfig(),
      user,
      progress: createProgress(),
      now: toInstant('2026-08-08T00:00:00.000Z'),
    });

    // Then
    expect(activated).toBe(false);
    expect(expired).toBe(false);
  });

  it('캠페인 설정을 읽지 못하면 신규 사용자에게도 체크리스트를 표시하지 않는다', () => {
    // Given
    const user = { id: 'new', createdAt: toInstant(LAUNCHED_AT.toISOString()) };

    // When
    const result = ActivationPolicy.shouldOfferChecklist({
      config: undefined,
      user,
      progress: createProgress(),
      now,
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

describe('shouldRegisterPushAutomatically', () => {
  it('기존 사용자와 활성화된 신규 사용자는 자동 등록한다', () => {
    // Given
    const config = createConfig();

    // When
    const existing = ActivationPolicy.shouldRegisterPushAutomatically({
      config,
      user: { id: 'existing', createdAt: toInstant('2026-07-01T00:00:00.000Z') },
      progress: createProgress(),
    });
    const activated = ActivationPolicy.shouldRegisterPushAutomatically({
      config,
      user: { id: 'new', createdAt: toInstant(LAUNCHED_AT.toISOString()) },
      progress: createProgress({ activatedAt: toInstant('2026-08-02T00:00:00.000Z') }),
    });

    // Then
    expect(existing).toBe(true);
    expect(activated).toBe(true);
  });

  it('미활성 신규 사용자는 자동 등록하지 않는다', () => {
    // Given
    const user = { id: 'new', createdAt: toInstant(LAUNCHED_AT.toISOString()) };

    // When
    const result = ActivationPolicy.shouldRegisterPushAutomatically({
      config: createConfig(),
      user,
      progress: createProgress(),
    });

    // Then
    expect(result).toBe(false);
  });

  it('설정에서 푸시를 명시적으로 켠 신규 사용자는 자동 등록한다', () => {
    // Given
    const user = { id: 'new', createdAt: toInstant(LAUNCHED_AT.toISOString()) };

    // When
    const result = ActivationPolicy.shouldRegisterPushAutomatically({
      config: createConfig(),
      user,
      progress: createProgress({
        pushRegistrationUnlockedAt: toInstant('2026-08-02T00:00:00.000Z'),
      }),
    });

    // Then
    expect(result).toBe(true);
  });

  it('캠페인 설정 조회가 실패해도 출시 전 기존 사용자는 자동 등록을 유지한다', () => {
    // Given
    const user = {
      id: 'existing',
      createdAt: toInstant('2026-07-31T23:59:59.999Z'),
    };

    // When
    const result = ActivationPolicy.shouldRegisterPushAutomatically({
      config: undefined,
      user,
      progress: createProgress(),
    });

    // Then
    expect(result).toBe(true);
  });

  it('캠페인 설정 조회 실패 중에도 출시 이후 신규 사용자는 권한 요청을 연기한다', () => {
    // Given
    const user = { id: 'new', createdAt: toInstant(LAUNCHED_AT.toISOString()) };

    // When
    const result = ActivationPolicy.shouldRegisterPushAutomatically({
      config: undefined,
      user,
      progress: createProgress(),
    });

    // Then
    expect(result).toBe(false);
  });
});

describe('findActivationIdentity', () => {
  it('캠페인 설정을 읽지 못하면 사용자의 활성화 식별자를 만들지 않는다', () => {
    // Given
    const user = { id: 'new', createdAt: toInstant(LAUNCHED_AT.toISOString()) };

    // When
    const identity = ActivationPolicy.findActivationIdentity(undefined, user);

    // Then
    expect(identity).toBeNull();
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
