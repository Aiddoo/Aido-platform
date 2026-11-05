import type { UserPropertyMap } from '@src/shared/observability/telemetry-keys';

export type AnalyticsEventParams = Record<string, unknown>;

export interface Analytics {
  trackEvent(eventName: string, params?: AnalyticsEventParams): void;
  trackScreenView(screenName: string, params?: AnalyticsEventParams): void;
  setUserId(userId: string | null): void;
  setUserProperties(properties: UserPropertyMap): void;
  /** 로그아웃: 사용자 id와 모든 사용자 속성을 지워 다음 계정에 남지 않게 한다 */
  clearUser(): void;
  resetData(): void;
  getAnalyticsId(): Promise<string | null>;
}
