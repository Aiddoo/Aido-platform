export type HapticImpact = 'light' | 'medium';
export type HapticNotification = 'success' | 'error' | 'warning';

/** 햅틱은 꾸밈이라 실패해도 앱 흐름을 막지 않는다. 구현은 오류를 삼킨다 */
export interface HapticsGateway {
  selection(): void;
  impact(style: HapticImpact): void;
  notify(type: HapticNotification): void;
}
