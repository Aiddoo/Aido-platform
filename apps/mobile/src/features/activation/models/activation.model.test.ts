import type { FeatureDiscoveryConfig } from '@src/features/feature-discovery/models/feature-discovery.model';
import { ActivationPolicy, type ActivationProgress } from './activation.model';

const LAUNCHED_AT = new Date('2026-08-01T00:00:00.000Z');

const createConfig = (
  overrides?: Partial<Extract<FeatureDiscoveryConfig, { enabled: true }>>,
): FeatureDiscoveryConfig => ({
  enabled: true,
  campaignId: 'feature-discovery-2026-08',
  minAppVersion: '1.8.0',
  launchedAt: LAUNCHED_AT,
  autoOpen: true,
  ...overrides,
});

const createProgress = (overrides?: Partial<ActivationProgress>): ActivationProgress => ({
  todoCreatedAt: null,
  activatedAt: null,
  pushRegistrationUnlockedAt: null,
  ...overrides,
});

describe('ActivationPolicy', () => {
  describe('isNewUserCohort', () => {
    it('캠페인 시작 시각에 가입한 사용자를 신규 코호트로 분류한다', () => {
      // Given
      const user = { id: 'new-user', createdAt: new Date('2026-08-01T00:00:00.000Z') };

      // When
      const result = ActivationPolicy.isNewUserCohort(createConfig(), user);

      // Then
      expect(result).toBe(true);
    });

    it('캠페인 시작 전에 가입한 기존 사용자는 신규 코호트가 아니다', () => {
      // Given
      const user = { id: 'existing-user', createdAt: new Date('2026-07-31T23:59:59.999Z') };

      // When
      const result = ActivationPolicy.isNewUserCohort(createConfig(), user);

      // Then
      expect(result).toBe(false);
    });

    it('비활성 또는 알 수 없는 캠페인은 신규 코호트를 만들지 않는다', () => {
      // Given
      const user = { id: 'new-user', createdAt: LAUNCHED_AT };

      // When
      const disabled = ActivationPolicy.isNewUserCohort({ enabled: false }, user);
      const unknown = ActivationPolicy.isNewUserCohort(
        createConfig({ campaignId: 'unknown-campaign' }),
        user,
      );

      // Then
      expect(disabled).toBe(false);
      expect(unknown).toBe(false);
    });
  });

  describe('isChecklistVisible', () => {
    it('가입 후 7일 미만인 미활성 신규 사용자에게 체크리스트를 표시한다', () => {
      // Given
      const user = { id: 'new-user', createdAt: LAUNCHED_AT };
      const now = new Date('2026-08-07T23:59:59.999Z');

      // When
      const result = ActivationPolicy.isChecklistVisible({
        config: createConfig(),
        user,
        progress: createProgress(),
        now,
      });

      // Then
      expect(result).toBe(true);
    });

    it('활성화됐거나 가입 후 7일이 지난 사용자는 체크리스트를 숨긴다', () => {
      // Given
      const user = { id: 'new-user', createdAt: LAUNCHED_AT };

      // When
      const activated = ActivationPolicy.isChecklistVisible({
        config: createConfig(),
        user,
        progress: createProgress({ activatedAt: new Date('2026-08-02T00:00:00.000Z') }),
        now: new Date('2026-08-02T00:00:01.000Z'),
      });
      const expired = ActivationPolicy.isChecklistVisible({
        config: createConfig(),
        user,
        progress: createProgress(),
        now: new Date('2026-08-08T00:00:00.000Z'),
      });

      // Then
      expect(activated).toBe(false);
      expect(expired).toBe(false);
    });
  });

  describe('shouldRegisterPushAutomatically', () => {
    it('기존 사용자와 활성화된 신규 사용자는 자동 등록한다', () => {
      // Given
      const config = createConfig();

      // When
      const existing = ActivationPolicy.shouldRegisterPushAutomatically({
        config,
        user: { id: 'existing', createdAt: new Date('2026-07-01T00:00:00.000Z') },
        progress: createProgress(),
      });
      const activated = ActivationPolicy.shouldRegisterPushAutomatically({
        config,
        user: { id: 'new', createdAt: LAUNCHED_AT },
        progress: createProgress({ activatedAt: new Date('2026-08-02T00:00:00.000Z') }),
      });

      // Then
      expect(existing).toBe(true);
      expect(activated).toBe(true);
    });

    it('미활성 신규 사용자는 자동 등록하지 않는다', () => {
      // Given
      const user = { id: 'new', createdAt: LAUNCHED_AT };

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
      const user = { id: 'new', createdAt: LAUNCHED_AT };

      // When
      const result = ActivationPolicy.shouldRegisterPushAutomatically({
        config: createConfig(),
        user,
        progress: createProgress({
          pushRegistrationUnlockedAt: new Date('2026-08-02T00:00:00.000Z'),
        }),
      });

      // Then
      expect(result).toBe(true);
    });

    it('캠페인 설정 조회가 실패해도 출시 전 기존 사용자는 자동 등록을 유지한다', () => {
      // Given
      const user = {
        id: 'existing',
        createdAt: new Date('2026-07-31T23:59:59.999Z'),
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
      const user = { id: 'new', createdAt: LAUNCHED_AT };

      // When
      const result = ActivationPolicy.shouldRegisterPushAutomatically({
        config: undefined,
        user,
        progress: createProgress(),
      });

      // Then
      expect(result).toBe(false);
      expect(ActivationPolicy.activationIdentity(undefined, user)).toBeNull();
      expect(
        ActivationPolicy.isChecklistVisible({
          config: undefined,
          user,
          progress: createProgress(),
          now: new Date('2026-08-02T00:00:00.000Z'),
        }),
      ).toBe(false);
    });
  });
});
