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
 */
export const SCHEDULER_TEMPLATES = {
	TODO_REMINDER: {
		title: "할일 알림",
		body: '"{todoTitle}" 마감이 1시간 남았어요!',
		type: "TODO_REMINDER" as NotificationType,
		defaultRoute: "/todos/{todoId}",
	},
	MORNING_REMINDER: {
		title: "좋은 아침이에요!",
		body: "오늘 {count}개의 할일이 기다리고 있어요 💪",
		type: "MORNING_REMINDER" as NotificationType,
		defaultRoute: "/todos",
	},
	EVENING_COMPLETE: {
		title: "완벽한 하루였어요!",
		body: "오늘 할일을 모두 완료했어요 🎉",
		type: "EVENING_REMINDER" as NotificationType,
		defaultRoute: "/",
	},
	EVENING_PARTIAL: {
		title: "조금만 더 힘내요!",
		body: "{remaining}개만 더 완료하면 돼요. 할 수 있어요!",
		type: "EVENING_REMINDER" as NotificationType,
		defaultRoute: "/todos",
	},
	EVENING_NONE: {
		title: "아직 늦지 않았어요",
		body: "지금 시작해볼까요? 작은 것부터 하나씩!",
		type: "EVENING_REMINDER" as NotificationType,
		defaultRoute: "/todos",
	},
} as const;

/**
 * 친구 상호작용 알림 템플릿
 */
export const SOCIAL_TEMPLATES = {
	FOLLOW_NEW: {
		title: "새로운 친구 요청",
		body: "{senderName}님이 친구가 되고 싶어해요",
		type: "FOLLOW_NEW" as NotificationType,
		defaultRoute: "/friends/requests",
	},
	FOLLOW_ACCEPTED: {
		title: "친구가 되었어요!",
		body: "{senderName}님과 이제 서로의 할일을 응원할 수 있어요",
		type: "FOLLOW_ACCEPTED" as NotificationType,
		defaultRoute: "/friends/{friendId}",
	},
	NUDGE_RECEIVED: {
		title: "친구의 응원이 도착했어요!",
		body: "{senderName}님이 당신의 할일을 응원하고 있어요 💪",
		type: "NUDGE_RECEIVED" as NotificationType,
		defaultRoute: "/todos/{todoId}",
	},
	CHEER_RECEIVED: {
		title: "축하 메시지가 도착했어요!",
		body: '{senderName}님이 "{message}" 라고 응원을 보냈어요 🎉',
		type: "CHEER_RECEIVED" as NotificationType,
		defaultRoute: "/friends/{friendId}",
	},
	CHEER_RECEIVED_NO_MESSAGE: {
		title: "축하 메시지가 도착했어요!",
		body: "{senderName}님이 응원을 보냈어요 🎉",
		type: "CHEER_RECEIVED" as NotificationType,
		defaultRoute: "/friends/{friendId}",
	},
	FRIEND_COMPLETED: {
		title: "{friendName}님 대단해요!",
		body: "오늘 할일을 모두 완료했어요. 축하해주세요!",
		type: "FRIEND_COMPLETED" as NotificationType,
		defaultRoute: "/friends/{friendId}",
	},
} as const;

/**
 * 시스템 알림 템플릿
 */
export const SYSTEM_TEMPLATES = {
	WEEKLY_ACHIEVEMENT: {
		title: "주간 달성 리포트",
		body: "이번 주 {completedCount}개의 할일을 완료했어요!",
		type: "WEEKLY_ACHIEVEMENT" as NotificationType,
		defaultRoute: "/stats",
	},
	SYSTEM_NOTICE: {
		title: "공지사항",
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
			title: SOCIAL_TEMPLATES.FOLLOW_NEW.title,
			body: fillTemplate(SOCIAL_TEMPLATES.FOLLOW_NEW.body, { senderName }),
		};
	}

	/**
	 * 맞팔로우 성립 알림 메시지 생성
	 */
	static followAccepted(senderName: string): { title: string; body: string } {
		return {
			title: SOCIAL_TEMPLATES.FOLLOW_ACCEPTED.title,
			body: fillTemplate(SOCIAL_TEMPLATES.FOLLOW_ACCEPTED.body, { senderName }),
		};
	}

	/**
	 * Nudge 수신 알림 메시지 생성
	 */
	static nudgeReceived(senderName: string): { title: string; body: string } {
		return {
			title: SOCIAL_TEMPLATES.NUDGE_RECEIVED.title,
			body: fillTemplate(SOCIAL_TEMPLATES.NUDGE_RECEIVED.body, { senderName }),
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
				title: SOCIAL_TEMPLATES.CHEER_RECEIVED.title,
				body: fillTemplate(SOCIAL_TEMPLATES.CHEER_RECEIVED.body, {
					senderName,
					message,
				}),
			};
		}
		return {
			title: SOCIAL_TEMPLATES.CHEER_RECEIVED_NO_MESSAGE.title,
			body: fillTemplate(SOCIAL_TEMPLATES.CHEER_RECEIVED_NO_MESSAGE.body, {
				senderName,
			}),
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
