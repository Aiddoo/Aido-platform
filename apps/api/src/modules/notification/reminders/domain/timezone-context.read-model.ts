/**
 * 타임존 리마인더 실행 컨텍스트 (도메인 값 타입).
 *
 * 오케스트레이터가 매분 스윕에서 현지 시각이 같은 타임존을 묶어 채우고,
 * 각 Strategy는 이 컨텍스트만 받아 발송 여부를 판단한다(프레임워크·DB 비의존).
 */
export interface TimezoneContext {
  /** 이 분에 현지 날짜·시·분이 같은 IANA 타임존들 (예: ["Asia/Seoul", "Asia/Tokyo"]) */
  readonly timezones: readonly string[];
  /** 로컬 시(0-23) */
  readonly localHour: number;
  /** 로컬 분(0-59) */
  readonly localMinute: number;
  /** 로컬 요일 (0=일, 1=월, ...) */
  readonly dayOfWeek: number;
  /** 로컬 오늘 */
  readonly today: Temporal.PlainDate;
  /** 로컬 내일 */
  readonly tomorrow: Temporal.PlainDate;
  /** catch-up 발송 시 특정 유저만 대상 (없으면 전체 스윕) */
  readonly userId?: string;
}
