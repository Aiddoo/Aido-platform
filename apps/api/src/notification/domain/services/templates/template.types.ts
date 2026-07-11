import type { NotificationType } from "../../types/notification-type";

/**
 * 알림 메시지 템플릿 (듀오링고 스타일: 짧고 위트있게, 살짝 찔리지만 웃기게)
 *
 * 플레이스홀더:
 * - {변수명}        — 단순 치환
 * - {변수명:이/가}  — 치환 후 받침에 맞는 조사 자동 부착 (es-hangul, en 템플릿은 미사용)
 */
export interface NotificationTemplate {
	title: string;
	body: string;
	type: NotificationType;
	/** 기본 라우트 패턴 (동적 값은 빌더에서 설정, null이면 라우트 없음) */
	defaultRoute?: string | null;
	/** 랜덤 문구 풀. 비어있으면 title/body를 fallback으로 사용 */
	variants?: ReadonlyArray<{ readonly title: string; readonly body: string }>;
}

/** 로케일별 템플릿 번들이 공통으로 제공해야 하는 형태 */
export interface WeatherFallbackTemplates {
	MORNING: { title: string; body: string };
	EVENING: { title: string; body: string };
}
