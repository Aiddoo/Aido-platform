import type { NotificationType } from "@/generated/prisma/client";

/**
 * 알림 메시지 템플릿
 *
 * 모든 알림 유형에 대한 제목과 본문 템플릿을 정의합니다.
 * 플레이스홀더는 {변수명} 형식으로 사용합니다.
 */

export interface NotificationTemplate {
	title: string;
	body: string;
	type: NotificationType;
	/** 기본 라우트 패턴 (동적 값은 빌더에서 설정) */
	defaultRoute?: string;
}

/**
 * 일정 기반 알림 템플릿
 *
 * 듀오링고 스타일: 짧고 임팩트 있게, 긴급성 + 성취감
 */
export const SCHEDULER_TEMPLATES = {
	TODO_REMINDER: {
		title: "1시간 남았어요",
		body: "{todoTitle}",
		type: "TODO_REMINDER" as NotificationType,
		defaultRoute: "/todos/{todoId}",
	},
	MORNING_REMINDER: {
		title: "오늘의 할일 {count}개",
		body: "지금 시작하면 오늘도 완벽해요",
		type: "MORNING_REMINDER" as NotificationType,
		defaultRoute: "/todos",
	},
	EVENING_COMPLETE: {
		title: "오늘 전부 해냈어요!",
		body: "내일도 이 기세로 가볼까요?",
		type: "EVENING_REMINDER" as NotificationType,
		defaultRoute: "/",
	},
	EVENING_PARTIAL: {
		title: "{remaining}개만 더!",
		body: "오늘 안에 끝낼 수 있어요",
		type: "EVENING_REMINDER" as NotificationType,
		defaultRoute: "/todos",
	},
	EVENING_NONE: {
		title: "하나만 해볼까요?",
		body: "5분이면 충분해요",
		type: "EVENING_REMINDER" as NotificationType,
		defaultRoute: "/todos",
	},
} as const;

/**
 * 친구 상호작용 알림 템플릿
 *
 * 듀오링고 스타일: 개인화 + 사회적 연결감
 */
export const SOCIAL_TEMPLATES = {
	FOLLOW_NEW: {
		title: "{senderName}님의 친구 요청",
		body: "함께 할일을 응원해요",
		type: "FOLLOW_NEW" as NotificationType,
		defaultRoute: "/friends/requests",
	},
	FOLLOW_ACCEPTED: {
		title: "{senderName}님과 친구가 됐어요",
		body: "서로의 할일을 확인해보세요",
		type: "FOLLOW_ACCEPTED" as NotificationType,
		defaultRoute: "/friends/{friendId}",
	},
	NUDGE_RECEIVED: {
		title: "{senderName}님이 콕!",
		body: "할일 끝내고 자랑해보세요",
		type: "NUDGE_RECEIVED" as NotificationType,
		defaultRoute: "/todos/{todoId}",
	},
	CHEER_RECEIVED: {
		title: "{senderName}님의 응원",
		body: "{message}",
		type: "CHEER_RECEIVED" as NotificationType,
		defaultRoute: "/friends/{friendId}",
	},
	CHEER_RECEIVED_NO_MESSAGE: {
		title: "{senderName}님이 응원해요",
		body: "답장으로 화답해볼까요?",
		type: "CHEER_RECEIVED" as NotificationType,
		defaultRoute: "/friends/{friendId}",
	},
	FRIEND_COMPLETED: {
		title: "{friendName}님이 오늘 다 해냈어요",
		body: "축하 메시지를 보내볼까요?",
		type: "FRIEND_COMPLETED" as NotificationType,
		defaultRoute: "/friends/{friendId}",
	},
} as const;

/**
 * 시스템 알림 템플릿
 */
export const SYSTEM_TEMPLATES = {
	WEEKLY_ACHIEVEMENT: {
		title: "이번 주 {completedCount}개 완료!",
		body: "다음 주도 기대돼요",
		type: "WEEKLY_ACHIEVEMENT" as NotificationType,
		defaultRoute: "/stats",
	},
	SYSTEM_NOTICE: {
		title: "Aido",
		body: "{message}",
		type: "SYSTEM_NOTICE" as NotificationType,
		defaultRoute: null,
	},
} as const;

/**
 * 템플릿 문자열에서 플레이스홀더를 치환합니다.
 *
 * @example
 * fillTemplate("{name}님 안녕하세요!", { name: "홍길동" })
 * // => "홍길동님 안녕하세요!"
 */
export function fillTemplate(
	template: string,
	variables: Record<string, string | number | undefined>,
): string {
	return template.replace(/\{(\w+)\}/g, (match, key) => {
		const value = variables[key];
		return value !== undefined ? String(value) : match;
	});
}

/**
 * 알림 메시지 빌더
 */
export class NotificationMessageBuilder {
	/**
	 * 팔로우 요청 알림 메시지 생성
	 */
	static followNew(senderName: string): { title: string; body: string } {
		return {
			title: fillTemplate(SOCIAL_TEMPLATES.FOLLOW_NEW.title, { senderName }),
			body: SOCIAL_TEMPLATES.FOLLOW_NEW.body,
		};
	}

	/**
	 * 맞팔로우 성립 알림 메시지 생성
	 */
	static followAccepted(senderName: string): { title: string; body: string } {
		return {
			title: fillTemplate(SOCIAL_TEMPLATES.FOLLOW_ACCEPTED.title, {
				senderName,
			}),
			body: SOCIAL_TEMPLATES.FOLLOW_ACCEPTED.body,
		};
	}

	/**
	 * Nudge 수신 알림 메시지 생성
	 */
	static nudgeReceived(senderName: string): { title: string; body: string } {
		return {
			title: fillTemplate(SOCIAL_TEMPLATES.NUDGE_RECEIVED.title, {
				senderName,
			}),
			body: SOCIAL_TEMPLATES.NUDGE_RECEIVED.body,
		};
	}

	/**
	 * Cheer 수신 알림 메시지 생성
	 */
	static cheerReceived(
		senderName: string,
		message?: string,
	): { title: string; body: string } {
		if (message) {
			return {
				title: fillTemplate(SOCIAL_TEMPLATES.CHEER_RECEIVED.title, {
					senderName,
				}),
				body: fillTemplate(SOCIAL_TEMPLATES.CHEER_RECEIVED.body, { message }),
			};
		}
		return {
			title: fillTemplate(SOCIAL_TEMPLATES.CHEER_RECEIVED_NO_MESSAGE.title, {
				senderName,
			}),
			body: SOCIAL_TEMPLATES.CHEER_RECEIVED_NO_MESSAGE.body,
		};
	}

	/**
	 * 친구 할일 완료 알림 메시지 생성
	 */
	static friendCompleted(friendName: string): { title: string; body: string } {
		return {
			title: fillTemplate(SOCIAL_TEMPLATES.FRIEND_COMPLETED.title, {
				friendName,
			}),
			body: SOCIAL_TEMPLATES.FRIEND_COMPLETED.body,
		};
	}

	/**
	 * 할일 리마인더 알림 메시지 생성
	 */
	static todoReminder(todoTitle: string): { title: string; body: string } {
		return {
			title: SCHEDULER_TEMPLATES.TODO_REMINDER.title,
			body: fillTemplate(SCHEDULER_TEMPLATES.TODO_REMINDER.body, { todoTitle }),
		};
	}

	/**
	 * 일일 완료 알림 메시지 생성
	 */
	static dailyComplete(_completedCount: number): {
		title: string;
		body: string;
	} {
		return {
			title: SCHEDULER_TEMPLATES.EVENING_COMPLETE.title,
			body: SCHEDULER_TEMPLATES.EVENING_COMPLETE.body,
		};
	}

	/**
	 * 아침 리마인더 알림 메시지 생성
	 */
	static morningReminder(count: number): { title: string; body: string } {
		return {
			title: SCHEDULER_TEMPLATES.MORNING_REMINDER.title,
			body: fillTemplate(SCHEDULER_TEMPLATES.MORNING_REMINDER.body, { count }),
		};
	}

	/**
	 * 저녁 리마인더 알림 메시지 생성
	 */
	static eveningReminder(
		completed: number,
		total: number,
	): { title: string; body: string } {
		if (completed === total && total > 0) {
			return {
				title: SCHEDULER_TEMPLATES.EVENING_COMPLETE.title,
				body: SCHEDULER_TEMPLATES.EVENING_COMPLETE.body,
			};
		}
		if (completed > 0) {
			const remaining = total - completed;
			return {
				title: SCHEDULER_TEMPLATES.EVENING_PARTIAL.title,
				body: fillTemplate(SCHEDULER_TEMPLATES.EVENING_PARTIAL.body, {
					remaining,
				}),
			};
		}
		return {
			title: SCHEDULER_TEMPLATES.EVENING_NONE.title,
			body: SCHEDULER_TEMPLATES.EVENING_NONE.body,
		};
	}
}
