import { NIGHT_TIME_CONFIG } from "@aido/validators";

/**
 * 야간 시간대 확인 (KST 21:00-08:00)
 *
 * 야간 푸시 알림 동의가 없는 사용자에게는
 * 이 시간대에 푸시 알림을 발송하지 않습니다.
 *
 * @param date 확인할 시간 (기본값: 현재 시간)
 * @returns 야간 시간대 여부
 */
export function isNightTime(date: Date = new Date()): boolean {
	const kstHour = getKstHour(date);
	return (
		kstHour >= NIGHT_TIME_CONFIG.START_HOUR ||
		kstHour < NIGHT_TIME_CONFIG.END_HOUR
	);
}

/**
 * UTC 시간을 KST 시간(hour)으로 변환
 *
 * @param date UTC 시간
 * @returns KST 시간 (0-23)
 */
export function getKstHour(date: Date): number {
	const utcHour = date.getUTCHours();
	return (utcHour + NIGHT_TIME_CONFIG.KST_OFFSET_HOURS) % 24;
}

/**
 * 야간 시간대가 아닌지 확인 (편의 함수)
 *
 * @param date 확인할 시간 (기본값: 현재 시간)
 * @returns 주간 시간대 여부
 */
export function isDayTime(date: Date = new Date()): boolean {
	return !isNightTime(date);
}
