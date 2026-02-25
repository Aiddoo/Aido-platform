import type { NotificationType } from "@/generated/prisma/client";

/**
 * 알림 메시지 템플릿 (듀오링고 스타일: 짧고 강렬하게, 죄책감 + 사회적 압박)
 *
 * 듀오링고 스타일: 짧고 강렬하게, 죄책감 + 사회적 압박으로 작성된 알림 템플릿입니다.
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
 * 듀오링고 스타일: 짧고 강렬하게, 죄책감 + 사회적 압박
 */
export const SCHEDULER_TEMPLATES = {
	TODO_REMINDER: {
		title: "{todoTitle}, 1시간 남음",
		body: "지금 안 하면 진짜 못 한다",
		type: "TODO_REMINDER" as NotificationType,
		defaultRoute: "/todos/{todoId}",
	},
	TODO_REMINDER_60MIN: {
		title: "{todoTitle}, 1시간 남음",
		body: "지금 안 하면 진짜 못 한다",
		type: "TODO_REMINDER" as NotificationType,
		defaultRoute: "/todos/{todoId}",
	},
	TODO_REMINDER_10MIN: {
		title: "{todoTitle}, 10분 남음",
		body: "진짜 마지막이다. 지금 당장!",
		type: "TODO_REMINDER" as NotificationType,
		defaultRoute: "/todos/{todoId}",
	},
	TODO_REMINDER_IMMEDIATE: {
		title: "{todoTitle}, 곧 시작",
		body: "아직 시간 있어. 지금 바로 시작해",
		type: "TODO_REMINDER" as NotificationType,
		defaultRoute: "/todos/{todoId}",
	},
	MORNING_REMINDER: {
		title: "오늘 할일 {count}개",
		body: "미루면 저녁의 내가 울어",
		type: "MORNING_REMINDER" as NotificationType,
		defaultRoute: "/todos",
	},
	EVENING_COMPLETE: {
		title: "다 했다. 진짜 대단한데?",
		body: "오늘 너 좀 멋있었어",
		type: "EVENING_REMINDER" as NotificationType,
		defaultRoute: "/",
	},
	EVENING_PARTIAL: {
		title: "{remaining}개 남았는데 자려고?",
		body: "조금만 더 하면 끝이야",
		type: "EVENING_REMINDER" as NotificationType,
		defaultRoute: "/todos",
	},
	EVENING_NONE: {
		title: "오늘 하나도 안 했어",
		body: "한 개만. 딱 한 개만 해보자",
		type: "EVENING_REMINDER" as NotificationType,
		defaultRoute: "/todos",
	},
	MORNING_NO_TODO: {
		title: "할일이 하나도 없다",
		body: "한가한 거 맞아? 뭐라도 적어봐",
	},
} as const;

/**
 * 친구 상호작용 알림 템플릿
 *
 * 듀오링고 스타일: 짧고 강렬하게, 죄책감 + 사회적 압박
 */
export const SOCIAL_TEMPLATES = {
	FOLLOW_NEW: {
		title: "{senderName}의 친구 요청",
		body: "수락하면 서로 감시 시작",
		type: "FOLLOW_NEW" as NotificationType,
		defaultRoute: "/friends/requests",
	},
	FOLLOW_ACCEPTED: {
		title: "{senderName}, 이제 친구다",
		body: "서로 할일이 다 보여. 각오해",
		type: "FOLLOW_ACCEPTED" as NotificationType,
		defaultRoute: "/friends/{friendId}",
	},
	NUDGE_RECEIVED: {
		title: "콕! {senderName}",
		body: "뭐 하고 있었는지 다 보인다",
		type: "NUDGE_RECEIVED" as NotificationType,
		defaultRoute: "/todos/{todoId}",
	},
	NUDGE_RECEIVED_WITH_MESSAGE: {
		title: "콕! {senderName}",
		body: "{message}",
		type: "NUDGE_RECEIVED" as NotificationType,
		defaultRoute: "/todos/{todoId}",
	},
	CHEER_RECEIVED: {
		title: "{senderName}의 한마디",
		body: "{message}",
		type: "CHEER_RECEIVED" as NotificationType,
		defaultRoute: "/friends/{friendId}",
	},
	CHEER_RECEIVED_NO_MESSAGE: {
		title: "{senderName}, 보고 있다",
		body: "네가 잘하는 거 알고 있어",
		type: "CHEER_RECEIVED" as NotificationType,
		defaultRoute: "/friends/{friendId}",
	},
	FRIEND_COMPLETED: {
		title: "{friendName}, 오늘 다 끝냈대",
		body: "너는?",
		type: "FRIEND_COMPLETED" as NotificationType,
		defaultRoute: "/friends/{friendId}",
	},
} as const;

/**
 * 시스템 알림 템플릿
 */
export const SYSTEM_TEMPLATES = {
	WEEKLY_ACHIEVEMENT: {
		title: "이번 주 {completedCount}개 클리어",
		body: "다음 주엔 더 할 수 있잖아",
		type: "WEEKLY_ACHIEVEMENT" as NotificationType,
		defaultRoute: "/stats",
	},
	SYSTEM_NOTICE: {
		title: "Aido",
		body: "{message}",
		type: "SYSTEM_NOTICE" as NotificationType,
		defaultRoute: null,
	},
	BILLING_ISSUE: {
		title: "결제 문제가 발생했어요",
		body: "결제 수단을 확인해주세요. 구독이 중단될 수 있습니다.",
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
	static nudgeReceived(
		senderName: string,
		message?: string,
	): { title: string; body: string } {
		if (message) {
			return {
				title: fillTemplate(
					SOCIAL_TEMPLATES.NUDGE_RECEIVED_WITH_MESSAGE.title,
					{
						senderName,
					},
				),
				body: fillTemplate(SOCIAL_TEMPLATES.NUDGE_RECEIVED_WITH_MESSAGE.body, {
					message,
				}),
			};
		}
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
	 * 할일 리마인더 알림 메시지 생성 (단계별)
	 *
	 * @param todoTitle 투두 제목
	 * @param stageLabel 리마인더 단계 ('60min' | '10min' | 'immediate')
	 */
	static todoReminder(
		todoTitle: string,
		stageLabel?: string,
	): { title: string; body: string } {
		let template: { title: string; body: string };
		switch (stageLabel) {
			case "10min":
				template = SCHEDULER_TEMPLATES.TODO_REMINDER_10MIN;
				break;
			case "immediate":
				template = SCHEDULER_TEMPLATES.TODO_REMINDER_IMMEDIATE;
				break;
			default:
				template = SCHEDULER_TEMPLATES.TODO_REMINDER_60MIN;
				break;
		}

		return {
			title: fillTemplate(template.title, { todoTitle }),
			body: template.body,
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
	 * 아침 할일 없음 알림 메시지 생성
	 */
	static morningNoTodo(): { title: string; body: string } {
		return {
			title: SCHEDULER_TEMPLATES.MORNING_NO_TODO.title,
			body: SCHEDULER_TEMPLATES.MORNING_NO_TODO.body,
		};
	}

	/**
	 * 아침 리마인더 알림 메시지 생성
	 */
	static morningReminder(count: number): { title: string; body: string } {
		return {
			title: fillTemplate(SCHEDULER_TEMPLATES.MORNING_REMINDER.title, {
				count,
			}),
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
				title: fillTemplate(SCHEDULER_TEMPLATES.EVENING_PARTIAL.title, {
					remaining,
				}),
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

	/**
	 * 결제 문제 알림 메시지 생성
	 */
	static billingIssue(): { title: string; body: string } {
		return {
			title: SYSTEM_TEMPLATES.BILLING_ISSUE.title,
			body: SYSTEM_TEMPLATES.BILLING_ISSUE.body,
		};
	}
}
