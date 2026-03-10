import { josa } from "es-hangul";

import type { NotificationType } from "@/generated/prisma/client";

/**
 * 알림 메시지 템플릿 (듀오링고 스타일: 짧고 강렬하게, 죄책감 + 사회적 압박)
 *
 * 플레이스홀더:
 * - {변수명}        — 단순 치환
 * - {변수명:이/가}  — 치환 후 받침에 맞는 조사 자동 부착 (es-hangul)
 */

export interface NotificationTemplate {
	title: string;
	body: string;
	type: NotificationType;
	/** 기본 라우트 패턴 (동적 값은 빌더에서 설정, null이면 라우트 없음) */
	defaultRoute?: string | null;
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
		type: "TODO_REMINDER",
		defaultRoute: "/todos/{todoId}",
	} satisfies NotificationTemplate,
	TODO_REMINDER_60MIN: {
		title: "{todoTitle}, 1시간 남음",
		body: "지금 안 하면 진짜 못 한다",
		type: "TODO_REMINDER",
		defaultRoute: "/todos/{todoId}",
	} satisfies NotificationTemplate,
	TODO_REMINDER_10MIN: {
		title: "{todoTitle}, 10분 남음",
		body: "진짜 마지막이다. 지금 당장!",
		type: "TODO_REMINDER",
		defaultRoute: "/todos/{todoId}",
	} satisfies NotificationTemplate,
	TODO_REMINDER_IMMEDIATE: {
		title: "{todoTitle}, 곧 시작",
		body: "아직 시간 있어. 지금 바로 시작해",
		type: "TODO_REMINDER",
		defaultRoute: "/todos/{todoId}",
	} satisfies NotificationTemplate,
	MORNING_REMINDER: {
		title: "오늘 할일 {count}개",
		body: "미루면 저녁의 내가 울어",
		type: "MORNING_REMINDER",
		defaultRoute: "/todos",
	} satisfies NotificationTemplate,
	EVENING_COMPLETE: {
		title: "다 했다. 진짜 대단한데?",
		body: "오늘 너 좀 멋있었어",
		type: "EVENING_REMINDER",
		defaultRoute: "/",
	} satisfies NotificationTemplate,
	EVENING_PARTIAL: {
		title: "{remaining}개 남았는데 자려고?",
		body: "조금만 더 하면 끝이야",
		type: "EVENING_REMINDER",
		defaultRoute: "/todos",
	} satisfies NotificationTemplate,
	EVENING_NONE: {
		title: "오늘 하나도 안 했어",
		body: "한 개만. 딱 한 개만 해보자",
		type: "EVENING_REMINDER",
		defaultRoute: "/todos",
	} satisfies NotificationTemplate,
	MORNING_NO_TODO: {
		title: "할일이 하나도 없다",
		body: "한가한 거 맞아? 뭐라도 적어봐",
	},
	// 스트릭 축하 (전체 완료 + 스트릭 2일+)
	EVENING_STREAK: {
		title: "{streak}일 연속 올클리어!",
		body: "내일도 하면 {next}일째다. 끊지 마",
		type: "EVENING_REMINDER",
		defaultRoute: "/",
	} satisfies NotificationTemplate,
	EVENING_STREAK_7: {
		title: "7일 연속! 일주일 내내 해냈어",
		body: "이거 실화냐",
		type: "EVENING_REMINDER",
		defaultRoute: "/",
	} satisfies NotificationTemplate,
	EVENING_STREAK_14: {
		title: "2주 연속이다. 진심이구나",
		body: "이쯤 되면 습관이야",
		type: "EVENING_REMINDER",
		defaultRoute: "/",
	} satisfies NotificationTemplate,
	EVENING_STREAK_30: {
		title: "{streak}일째. 전설이 되고 있어",
		body: "멈추지 마",
		type: "EVENING_REMINDER",
		defaultRoute: "/",
	} satisfies NotificationTemplate,
	// 스트릭 위기 (일부 완료 + 스트릭 2일+)
	EVENING_STREAK_RISK_PARTIAL: {
		title: "어제까지 {streak}일 연속이었는데...",
		body: "{remaining}개만 끝내면 이어갈 수 있어",
		type: "EVENING_REMINDER",
		defaultRoute: "/todos",
	} satisfies NotificationTemplate,
	// 스트릭 위기 (하나도 안 함 + 스트릭 2일+)
	EVENING_STREAK_RISK_NONE: {
		title: "{streak}일 연속 기록이 위험해",
		body: "한 개만 끝내면 살릴 수 있어",
		type: "EVENING_REMINDER",
		defaultRoute: "/todos",
	} satisfies NotificationTemplate,
	// 점심 넛지 (12:30, 오늘 완료 0개)
	LUNCH_NUDGE: {
		title: "아직 0개야",
		body: "점심 먹고 하나만 해볼래?",
		type: "LUNCH_NUDGE",
		defaultRoute: "/feed",
	} satisfies NotificationTemplate,
	// 스트릭 위기 전용 알림 (21:00, 스트릭 3일+ & 미완료)
	STREAK_AT_RISK: {
		title: "{streak}일 연속인데 오늘 끊을 거야?",
		body: "딱 하나만 끝내면 이어갈 수 있어",
		type: "STREAK_AT_RISK",
		defaultRoute: "/feed",
	} satisfies NotificationTemplate,
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
		type: "FOLLOW_NEW",
		defaultRoute: "/friends/requests",
	} satisfies NotificationTemplate,
	FOLLOW_ACCEPTED: {
		title: "{senderName}, 이제 친구다",
		body: "서로 할일이 다 보여. 각오해",
		type: "FOLLOW_ACCEPTED",
		defaultRoute: "/feed/friend/{friendId}",
	} satisfies NotificationTemplate,
	NUDGE_RECEIVED: {
		title: "{senderName:이/가} '{todoTitle}' 콕 찔렀어!",
		body: "아직도 안 했어?",
		type: "NUDGE_RECEIVED",
		defaultRoute: "/feed/friend/{friendId}",
	} satisfies NotificationTemplate,
	NUDGE_RECEIVED_WITH_MESSAGE: {
		title: "{senderName:이/가} '{todoTitle}' 콕 찔렀어!",
		body: "'{message}'",
		type: "NUDGE_RECEIVED",
		defaultRoute: "/feed/friend/{friendId}",
	} satisfies NotificationTemplate,
	CHEER_RECEIVED: {
		title: "{senderName}의 한마디",
		body: "{message}",
		type: "CHEER_RECEIVED",
		defaultRoute: "/feed/friend/{friendId}",
	} satisfies NotificationTemplate,
	CHEER_RECEIVED_NO_MESSAGE: {
		title: "{senderName}, 보고 있다",
		body: "네가 잘하는 거 알고 있어",
		type: "CHEER_RECEIVED",
		defaultRoute: "/feed/friend/{friendId}",
	} satisfies NotificationTemplate,
	FRIEND_COMPLETED: {
		title: "{friendName}, 오늘 다 끝냈대",
		body: "너는?",
		type: "FRIEND_COMPLETED",
		defaultRoute: "/feed/friend/{friendId}",
	} satisfies NotificationTemplate,
	// 친구 활동 요약 (Social Digest)
	SOCIAL_DIGEST_MULTI: {
		title: "친구 {completedFriendCount}명이 오늘 다 끝냈어",
		body: "너만 남았다",
		type: "SOCIAL_DIGEST",
		defaultRoute: "/feed",
	} satisfies NotificationTemplate,
	SOCIAL_DIGEST_SINGLE: {
		title: "{friendName}은 오늘 다 끝냈대",
		body: "너는 아직이잖아",
		type: "SOCIAL_DIGEST",
		defaultRoute: "/feed",
	} satisfies NotificationTemplate,
	// 콕 찌르기 유도 (Nudge Suggest)
	NUDGE_SUGGEST: {
		title: "{friendName:이/가} {days}일째 조용해",
		body: "콕 찔러볼래?",
		type: "NUDGE_SUGGEST",
		defaultRoute: "/feed/friend/{friendId}",
	} satisfies NotificationTemplate,
} as const;

/**
 * 시스템 알림 템플릿
 */
export const SYSTEM_TEMPLATES = {
	// Win-back (비활성 유저 재방문 유도)
	WINBACK_DAY3: {
		title: "3일째 조용한데",
		body: "할일 쌓이고 있을걸?",
		type: "WINBACK",
		defaultRoute: "/feed",
	} satisfies NotificationTemplate,
	WINBACK_DAY7: {
		title: "일주일이나 안 왔잖아",
		body: "한 개만. 딱 한 개만 해보자",
		type: "WINBACK",
		defaultRoute: "/feed",
	} satisfies NotificationTemplate,
	WINBACK_DAY14: {
		title: "거의 잊혀질 뻔했어",
		body: "다시 시작해도 괜찮아",
		type: "WINBACK",
		defaultRoute: "/feed",
	} satisfies NotificationTemplate,
	// 주간 달성 배지
	WEEKLY_ACHIEVEMENT: {
		title: "이번 주 {completedCount}개 클리어",
		body: "다음 주엔 더 할 수 있잖아",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
	} satisfies NotificationTemplate,
	WEEKLY_ACHIEVEMENT_PERFECT: {
		title: "이번 주 전부 다 해냈어",
		body: "완벽한 한 주였다",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
	} satisfies NotificationTemplate,
	WEEKLY_ACHIEVEMENT_ALMOST: {
		title: "이번 주 완료율 {rate}%",
		body: "거의 다 했는데 아쉽다",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
	} satisfies NotificationTemplate,
	WEEKLY_REPORT: {
		title: "주간 리포트가 도착했다냥!",
		body: "이번 주 성적표를 확인해보라냥",
		type: "WEEKLY_REPORT",
		defaultRoute: "/reports",
	} satisfies NotificationTemplate,
	MONTHLY_REPORT: {
		title: "월간 리포트 왔다냥!",
		body: "한 달 동안 얼마나 했는지 볼까냥",
		type: "MONTHLY_REPORT",
		defaultRoute: "/reports",
	} satisfies NotificationTemplate,
	AI_SUGGESTION: {
		title: "반복 패턴을 발견했다냥!",
		body: "자동으로 만들어줄까냥?",
		type: "AI_SUGGESTION",
		defaultRoute: "/suggestions",
	} satisfies NotificationTemplate,
	SYSTEM_NOTICE: {
		title: "Aido",
		body: "{message}",
		type: "SYSTEM_NOTICE",
		defaultRoute: null,
	} satisfies NotificationTemplate,
	BILLING_ISSUE: {
		title: "결제 문제가 발생했어요",
		body: "결제 수단을 확인해주세요. 구독이 중단될 수 있습니다.",
		type: "SYSTEM_NOTICE",
		defaultRoute: null,
	} satisfies NotificationTemplate,
} as const;

/**
 * 템플릿 문자열에서 플레이스홀더를 치환합니다.
 *
 * - `{key}`       → 단순 치환
 * - `{key:이/가}` → 치환 후 받침에 맞는 조사 자동 부착
 *
 * @example
 * fillTemplate("{name}님 안녕하세요!", { name: "홍길동" })
 * // => "홍길동님 안녕하세요!"
 *
 * fillTemplate("{name:이/가} 콕 찔렀어!", { name: "홍길동" })
 * // => "홍길동이 콕 찔렀어!"
 */
export function fillTemplate(
	template: string,
	variables: Record<string, string | number | undefined>,
): string {
	return template.replace(/\{(\w+)(?::([^}]+))?\}/g, (match, key, particle) => {
		const value = variables[key];
		if (value === undefined) {
			return match;
		}

		const str = String(value);

		if (particle) {
			try {
				return josa(str, particle as Parameters<typeof josa>[1]);
			} catch {
				return str;
			}
		}
		return str;
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
		todoTitle?: string,
		message?: string,
	): { title: string; body: string } {
		if (message) {
			return {
				title: fillTemplate(
					SOCIAL_TEMPLATES.NUDGE_RECEIVED_WITH_MESSAGE.title,
					{ senderName, todoTitle },
				),
				body: fillTemplate(SOCIAL_TEMPLATES.NUDGE_RECEIVED_WITH_MESSAGE.body, {
					message,
				}),
			};
		}
		return {
			title: fillTemplate(SOCIAL_TEMPLATES.NUDGE_RECEIVED.title, {
				senderName,
				todoTitle,
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
	 * 저녁 리마인더 알림 메시지 생성 (스트릭 통합)
	 *
	 * @param completed 완료된 투두 수
	 * @param total 전체 투두 수
	 * @param streak 현재 스트릭 (0이면 스트릭 없음)
	 * @param isStreakAtRisk 스트릭 위기 여부 (어제까지 연속 완료 + 오늘 미완료)
	 */
	static eveningReminder(
		completed: number,
		total: number,
		streak = 0,
		isStreakAtRisk = false,
	): { title: string; body: string } {
		// A. 전체 완료
		if (completed === total && total > 0) {
			if (streak >= 30) {
				return {
					title: fillTemplate(SCHEDULER_TEMPLATES.EVENING_STREAK_30.title, {
						streak,
					}),
					body: SCHEDULER_TEMPLATES.EVENING_STREAK_30.body,
				};
			}
			if (streak === 14) {
				return {
					title: SCHEDULER_TEMPLATES.EVENING_STREAK_14.title,
					body: SCHEDULER_TEMPLATES.EVENING_STREAK_14.body,
				};
			}
			if (streak === 7) {
				return {
					title: SCHEDULER_TEMPLATES.EVENING_STREAK_7.title,
					body: SCHEDULER_TEMPLATES.EVENING_STREAK_7.body,
				};
			}
			if (streak >= 2) {
				return {
					title: fillTemplate(SCHEDULER_TEMPLATES.EVENING_STREAK.title, {
						streak,
					}),
					body: fillTemplate(SCHEDULER_TEMPLATES.EVENING_STREAK.body, {
						streak,
						next: streak + 1,
					}),
				};
			}
			return {
				title: SCHEDULER_TEMPLATES.EVENING_COMPLETE.title,
				body: SCHEDULER_TEMPLATES.EVENING_COMPLETE.body,
			};
		}

		// B. 일부 완료
		if (completed > 0) {
			const remaining = total - completed;
			if (isStreakAtRisk && streak >= 2) {
				return {
					title: fillTemplate(
						SCHEDULER_TEMPLATES.EVENING_STREAK_RISK_PARTIAL.title,
						{ streak },
					),
					body: fillTemplate(
						SCHEDULER_TEMPLATES.EVENING_STREAK_RISK_PARTIAL.body,
						{ remaining },
					),
				};
			}
			return {
				title: fillTemplate(SCHEDULER_TEMPLATES.EVENING_PARTIAL.title, {
					remaining,
				}),
				body: fillTemplate(SCHEDULER_TEMPLATES.EVENING_PARTIAL.body, {
					remaining,
				}),
			};
		}

		// C. 하나도 안 함
		if (isStreakAtRisk && streak >= 2) {
			return {
				title: fillTemplate(
					SCHEDULER_TEMPLATES.EVENING_STREAK_RISK_NONE.title,
					{ streak },
				),
				body: SCHEDULER_TEMPLATES.EVENING_STREAK_RISK_NONE.body,
			};
		}
		return {
			title: SCHEDULER_TEMPLATES.EVENING_NONE.title,
			body: SCHEDULER_TEMPLATES.EVENING_NONE.body,
		};
	}

	/**
	 * 주간 리포트 알림 메시지 생성
	 */
	static weeklyReport(): { title: string; body: string } {
		return {
			title: SYSTEM_TEMPLATES.WEEKLY_REPORT.title,
			body: SYSTEM_TEMPLATES.WEEKLY_REPORT.body,
		};
	}

	/**
	 * 월간 리포트 알림 메시지 생성
	 */
	static monthlyReport(): { title: string; body: string } {
		return {
			title: SYSTEM_TEMPLATES.MONTHLY_REPORT.title,
			body: SYSTEM_TEMPLATES.MONTHLY_REPORT.body,
		};
	}

	/**
	 * AI 반복 제안 알림 메시지 생성
	 */
	static aiSuggestion(): { title: string; body: string } {
		return {
			title: SYSTEM_TEMPLATES.AI_SUGGESTION.title,
			body: SYSTEM_TEMPLATES.AI_SUGGESTION.body,
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

	/**
	 * Win-back 알림 메시지 생성 (비활성 일수에 따라 단계별)
	 */
	static winback(inactiveDays: number): { title: string; body: string } {
		if (inactiveDays >= 14) {
			return {
				title: SYSTEM_TEMPLATES.WINBACK_DAY14.title,
				body: SYSTEM_TEMPLATES.WINBACK_DAY14.body,
			};
		}
		if (inactiveDays >= 7) {
			return {
				title: SYSTEM_TEMPLATES.WINBACK_DAY7.title,
				body: SYSTEM_TEMPLATES.WINBACK_DAY7.body,
			};
		}
		return {
			title: SYSTEM_TEMPLATES.WINBACK_DAY3.title,
			body: SYSTEM_TEMPLATES.WINBACK_DAY3.body,
		};
	}

	/**
	 * 주간 달성 배지 알림 메시지 생성 (완료율에 따라 분기)
	 */
	static weeklyAchievement(
		completedCount: number,
		totalCount: number,
	): { title: string; body: string } {
		const rate = Math.round((completedCount / totalCount) * 100);

		if (rate === 100) {
			return {
				title: SYSTEM_TEMPLATES.WEEKLY_ACHIEVEMENT_PERFECT.title,
				body: SYSTEM_TEMPLATES.WEEKLY_ACHIEVEMENT_PERFECT.body,
			};
		}
		if (rate >= 90) {
			return {
				title: fillTemplate(SYSTEM_TEMPLATES.WEEKLY_ACHIEVEMENT_ALMOST.title, {
					rate,
				}),
				body: SYSTEM_TEMPLATES.WEEKLY_ACHIEVEMENT_ALMOST.body,
			};
		}
		return {
			title: fillTemplate(SYSTEM_TEMPLATES.WEEKLY_ACHIEVEMENT.title, {
				completedCount,
			}),
			body: SYSTEM_TEMPLATES.WEEKLY_ACHIEVEMENT.body,
		};
	}

	/**
	 * 친구 활동 요약 알림 메시지 생성
	 */
	static socialDigest(
		completedFriendCount: number,
		friendName?: string,
	): { title: string; body: string } {
		if (completedFriendCount === 1 && friendName) {
			return {
				title: fillTemplate(SOCIAL_TEMPLATES.SOCIAL_DIGEST_SINGLE.title, {
					friendName,
				}),
				body: SOCIAL_TEMPLATES.SOCIAL_DIGEST_SINGLE.body,
			};
		}
		return {
			title: fillTemplate(SOCIAL_TEMPLATES.SOCIAL_DIGEST_MULTI.title, {
				completedFriendCount,
			}),
			body: SOCIAL_TEMPLATES.SOCIAL_DIGEST_MULTI.body,
		};
	}

	/**
	 * 점심 넛지 알림 메시지 생성
	 */
	static lunchNudge(): { title: string; body: string } {
		return {
			title: SCHEDULER_TEMPLATES.LUNCH_NUDGE.title,
			body: SCHEDULER_TEMPLATES.LUNCH_NUDGE.body,
		};
	}

	/**
	 * 스트릭 위기 알림 메시지 생성
	 */
	static streakAtRisk(streak: number): { title: string; body: string } {
		return {
			title: fillTemplate(SCHEDULER_TEMPLATES.STREAK_AT_RISK.title, {
				streak,
			}),
			body: SCHEDULER_TEMPLATES.STREAK_AT_RISK.body,
		};
	}

	/**
	 * 콕 찌르기 유도 알림 메시지 생성
	 */
	static nudgeSuggest(
		friendName: string,
		days: number,
	): { title: string; body: string } {
		return {
			title: fillTemplate(SOCIAL_TEMPLATES.NUDGE_SUGGEST.title, {
				friendName,
				days,
			}),
			body: SOCIAL_TEMPLATES.NUDGE_SUGGEST.body,
		};
	}
}
