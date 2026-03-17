import { josa } from "es-hangul";

import type { NotificationType } from "@/generated/prisma/client";

/**
 * 알림 메시지 템플릿 (듀오링고 스타일: 짧고 위트있게, 살짝 찔리지만 웃기게)
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
	/** 랜덤 문구 풀. 비어있으면 title/body를 fallback으로 사용 */
	variants?: ReadonlyArray<{ readonly title: string; readonly body: string }>;
}

// =============================================================================
// Scheduler Templates
// =============================================================================

export const SCHEDULER_TEMPLATES = {
	TODO_REMINDER: {
		title: "{todoTitle}, 1시간 남았어",
		body: "미리 시작하면 여유롭게 끝나",
		type: "TODO_REMINDER",
		defaultRoute: "/todos/{todoId}",
		variants: [
			{
				title: "{todoTitle}, 1시간 남았어",
				body: "미리 시작하면 여유롭게 끝나",
			},
			{ title: "{todoTitle}까지 1시간", body: "슬슬 준비해볼까?" },
			{ title: "1시간 후 {todoTitle}", body: "지금 시작하면 칼퇴 가능" },
		],
	} satisfies NotificationTemplate,
	TODO_REMINDER_60MIN: {
		title: "{todoTitle}, 1시간 남았어",
		body: "미리 시작하면 여유롭게 끝나",
		type: "TODO_REMINDER",
		defaultRoute: "/todos/{todoId}",
		variants: [
			{
				title: "{todoTitle}, 1시간 남았어",
				body: "미리 시작하면 여유롭게 끝나",
			},
			{ title: "{todoTitle}까지 1시간", body: "슬슬 준비해볼까?" },
			{ title: "1시간 후 {todoTitle}", body: "지금 시작하면 칼퇴 가능" },
		],
	} satisfies NotificationTemplate,
	TODO_REMINDER_10MIN: {
		title: "{todoTitle}, 10분 남았어",
		body: "지금 시작하면 딱 맞아",
		type: "TODO_REMINDER",
		defaultRoute: "/todos/{todoId}",
		variants: [
			{ title: "{todoTitle}, 10분 남았어", body: "지금 시작하면 딱 맞아" },
			{ title: "{todoTitle}까지 10분!", body: "준비 됐지?" },
			{ title: "10분 남았어, {todoTitle}", body: "지금이 골든타임" },
		],
	} satisfies NotificationTemplate,
	TODO_REMINDER_IMMEDIATE: {
		title: "{todoTitle}, 시작할 시간이야",
		body: "바로 해보자!",
		type: "TODO_REMINDER",
		defaultRoute: "/todos/{todoId}",
		variants: [
			{ title: "{todoTitle}, 시작할 시간이야", body: "바로 해보자!" },
			{ title: "{todoTitle} 시간이다!", body: "가보자" },
			{ title: "지금이야, {todoTitle}", body: "시작이 반이야" },
		],
	} satisfies NotificationTemplate,
	MORNING_REMINDER: {
		title: "오늘 할일 {count}개",
		body: "하나씩 쓸어버리자",
		type: "MORNING_REMINDER",
		defaultRoute: "/todos",
		variants: [
			{ title: "오늘 할일 {count}개", body: "하나씩 쓸어버리자" },
			{
				title: "{count}개가 널 기다리고 있어",
				body: "먼저 해치우면 저녁이 편해",
			},
			{ title: "오늘의 미션 {count}개", body: "하나만 끝내면 나머지도 쉬워" },
			{ title: "할일 {count}개 출근했다", body: "순서대로 보내버리자" },
			{ title: "{count}개 남았어", body: "안 하면 저녁의 내가 운다" },
		],
	} satisfies NotificationTemplate,
	EVENING_COMPLETE: {
		title: "올클리어!",
		body: "오늘 너 좀 멋있었어",
		type: "EVENING_REMINDER",
		defaultRoute: "/",
		variants: [
			{ title: "올클리어!", body: "오늘 너 좀 멋있었어" },
			{ title: "다 해버렸네", body: "오늘의 나한테 박수" },
			{ title: "오늘치 전부 완료", body: "이런 날이 쌓이면 인생 바뀜" },
			{ title: "끝냈다! 진짜 대단한데?", body: "편하게 쉬어, 자격 있어" },
			{ title: "완료 도장 꽝", body: "내일도 이러면 전설임" },
		],
	} satisfies NotificationTemplate,
	EVENING_PARTIAL: {
		title: "{remaining}개만 더 하면 올클리어",
		body: "거의 다 왔잖아",
		type: "EVENING_REMINDER",
		defaultRoute: "/todos",
		variants: [
			{ title: "{remaining}개만 더 하면 올클리어", body: "거의 다 왔잖아" },
			{ title: "{remaining}개 남았어", body: "여기서 끝내면 기분 좋을걸" },
			{ title: "오늘 잘 했어, 근데 {remaining}개 남음", body: "마무리 각?" },
			{
				title: "올클리어까지 {remaining}개",
				body: "자기 전에 해치울 수 있잖아",
			},
		],
	} satisfies NotificationTemplate,
	EVENING_NONE: {
		title: "오늘 아직 시작 전이야",
		body: "딱 한 개만 해보자, 그걸로 충분해",
		type: "EVENING_REMINDER",
		defaultRoute: "/todos",
		variants: [
			{
				title: "오늘 아직 시작 전이야",
				body: "딱 한 개만 해보자, 그걸로 충분해",
			},
			{ title: "0개인데... 괜찮아?", body: "하나만 끝내고 자면 기분이 다를걸" },
			{ title: "오늘 바빴구나", body: "작은 거 하나만, 그게 내일의 시작이야" },
			{ title: "할일들이 삐져있어", body: "한 개만 해주면 얘들이 좋아할걸" },
		],
	} satisfies NotificationTemplate,
	MORNING_NO_TODO: {
		title: "오늘은 텅 비어있어",
		body: "뭐라도 하나 적어보면 하루가 달라져",
		type: "MORNING_REMINDER",
		defaultRoute: "/todos",
		variants: [
			{
				title: "오늘은 텅 비어있어",
				body: "뭐라도 하나 적어보면 하루가 달라져",
			},
			{ title: "할일 0개, 진짜야?", body: "한가한 거야 도피하는 거야?" },
			{ title: "백지 상태", body: "작은 거 하나만 적어봐" },
		],
	} satisfies NotificationTemplate,
	// 스트릭 축하 (전체 완료 + 스트릭 2일+)
	EVENING_STREAK: {
		title: "{streak}일 연속 올클리어!",
		body: "내일이면 {next}일째, 끊지 마",
		type: "EVENING_REMINDER",
		defaultRoute: "/",
		variants: [
			{
				title: "{streak}일 연속 올클리어!",
				body: "내일이면 {next}일째, 끊지 마",
			},
			{ title: "{streak}일째 달리는 중!", body: "{next}일 가보자" },
			{ title: "{streak}일 연속! 미쳤다", body: "이 흐름 멈추면 안 돼" },
		],
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
		title: "{streak}일 기록 이어갈 수 있어",
		body: "{remaining}개만 끝내면 돼!",
		type: "EVENING_REMINDER",
		defaultRoute: "/todos",
		variants: [
			{
				title: "{streak}일 기록 이어갈 수 있어",
				body: "{remaining}개만 끝내면 돼!",
			},
			{
				title: "{streak}일째인데 여기서 끊기면 아까워",
				body: "{remaining}개만 더!",
			},
			{ title: "아직 기회 있어", body: "{remaining}개 남았어, 지금이야" },
		],
	} satisfies NotificationTemplate,
	// 스트릭 위기 (하나도 안 함 + 스트릭 2일+)
	EVENING_STREAK_RISK_NONE: {
		title: "{streak}일 기록, 아직 늦지 않았어",
		body: "한 개만 끝내면 살릴 수 있어",
		type: "EVENING_REMINDER",
		defaultRoute: "/todos",
		variants: [
			{
				title: "{streak}일 기록, 아직 늦지 않았어",
				body: "한 개만 끝내면 살릴 수 있어",
			},
			{
				title: "{streak}일째인데 오늘 쉴 거야?",
				body: "하나만 해도 기록은 이어가",
			},
			{
				title: "{streak}일 기록이 흔들리고 있어",
				body: "지금 하나 끝내면 세이브",
			},
		],
	} satisfies NotificationTemplate,
	// 점심 넛지 (12:30, 오늘 완료 0개)
	LUNCH_NUDGE: {
		title: "점심 먹었으면 하나만 해볼까?",
		body: "오후의 시작은 할일 하나로",
		type: "LUNCH_NUDGE",
		defaultRoute: "/feed",
		variants: [
			{
				title: "점심 먹었으면 하나만 해볼까?",
				body: "오후의 시작은 할일 하나로",
			},
			{ title: "아직 0개야", body: "점심값은 했으니 할일값도 하자" },
			{ title: "밥 먹고 하나만", body: "작은 거부터 시작하면 돼" },
			{ title: "오후 시작!", body: "하나만 끝내면 탄력 붙어" },
		],
	} satisfies NotificationTemplate,
	// 스트릭 위기 전용 알림 (21:00, 스트릭 3일+ & 미완료)
	STREAK_AT_RISK: {
		title: "{streak}일 기록, 오늘도 이어가자",
		body: "하나만 끝내면 계속 달릴 수 있어",
		type: "STREAK_AT_RISK",
		defaultRoute: "/feed",
		variants: [
			{
				title: "{streak}일 기록, 오늘도 이어가자",
				body: "하나만 끝내면 계속 달릴 수 있어",
			},
			{ title: "{streak}일째인데 여기서 멈출 거야?", body: "딱 하나만!" },
			{
				title: "{streak}일 기록 깨지기 직전",
				body: "지금 하나 끝내면 세이브 완료",
			},
		],
	} satisfies NotificationTemplate,
} as const;

// =============================================================================
// Social Templates
// =============================================================================

export const SOCIAL_TEMPLATES = {
	FOLLOW_NEW: {
		title: "{senderName}의 친구 요청",
		body: "수락하면 서로 감시 시작",
		type: "FOLLOW_NEW",
		defaultRoute: "/friends/requests",
		variants: [
			{ title: "{senderName}의 친구 요청", body: "수락하면 서로 감시 시작" },
			{
				title: "{senderName:이/가} 같이 하자고 해!",
				body: "친구가 있으면 더 잘하게 돼",
			},
			{
				title: "새 친구 요청이 왔어",
				body: "{senderName:이/가} 기다리고 있어",
			},
		],
	} satisfies NotificationTemplate,
	FOLLOW_ACCEPTED: {
		title: "{senderName}, 이제 친구다",
		body: "서로 할일이 다 보여. 각오해",
		type: "FOLLOW_ACCEPTED",
		defaultRoute: "/feed/friend/{friendId}",
		variants: [
			{
				title: "{senderName}, 이제 친구다",
				body: "서로 할일이 다 보여. 각오해",
			},
			{ title: "{senderName}과 연결됐어!", body: "이제부터 같이 가는 거야" },
			{
				title: "{senderName}, 이제 같은 편이야",
				body: "서로 응원하면서 달려보자",
			},
		],
	} satisfies NotificationTemplate,
	NUDGE_RECEIVED: {
		title: "{senderName:이/가} '{todoTitle}' 콕 찔렀어!",
		body: "아직도 안 했어?",
		type: "NUDGE_RECEIVED",
		defaultRoute: "/feed/friend/{friendId}",
		variants: [
			{
				title: "{senderName:이/가} '{todoTitle}' 콕 찔렀어!",
				body: "아직도 안 했어?",
			},
			{
				title: "{senderName:이/가} '{todoTitle}' 찔렀어!",
				body: "기다리고 있대",
			},
			{
				title: "{senderName:이/가} '{todoTitle}' 콕!",
				body: "뭐 하고 있었어?",
			},
		],
	} satisfies NotificationTemplate,
	NUDGE_RECEIVED_WITH_MESSAGE: {
		title: "{senderName:이/가} '{todoTitle}' 콕 찔렀어!",
		body: "'{message}'",
		type: "NUDGE_RECEIVED",
		defaultRoute: "/feed/friend/{friendId}",
	} satisfies NotificationTemplate,
	REMIND_NUDGE_RECEIVED: {
		title: "{senderName:이/가} 콕 찔렀어!",
		body: "할일 좀 만들어!",
		type: "NUDGE_RECEIVED",
		defaultRoute: "/feed",
		variants: [
			{ title: "{senderName:이/가} 콕 찔렀어!", body: "할일 좀 만들어!" },
			{ title: "{senderName:이/가} 찾고 있어!", body: "뭐라도 하나 적어볼까?" },
			{
				title: "{senderName:이/가} 안부를 물어",
				body: "오늘 뭐 할지 적어볼까?",
			},
		],
	} satisfies NotificationTemplate,
	REMIND_NUDGE_RECEIVED_WITH_MESSAGE: {
		title: "{senderName:이/가} 콕 찔렀어!",
		body: "'{message}'",
		type: "NUDGE_RECEIVED",
		defaultRoute: "/feed",
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
		variants: [
			{ title: "{senderName}, 보고 있다", body: "네가 잘하는 거 알고 있어" },
			{ title: "{senderName:이/가} 응원 보냈어", body: "힘내, 잘 하고 있어" },
			{ title: "{senderName}의 응원이 도착", body: "너라면 할 수 있어" },
		],
	} satisfies NotificationTemplate,
	FRIEND_COMPLETED: {
		title: "{friendName}, 오늘 다 끝냈대",
		body: "너는?",
		type: "FRIEND_COMPLETED",
		defaultRoute: "/feed/friend/{friendId}",
		variants: [
			{ title: "{friendName}, 오늘 다 끝냈대", body: "너는?" },
			{ title: "{friendName:이/가} 올클리어!", body: "이대로 질 수 없잖아" },
			{ title: "{friendName:이/가} 다 해냈대", body: "우리도 가자" },
		],
	} satisfies NotificationTemplate,
	// 친구 활동 요약 (Social Digest)
	SOCIAL_DIGEST_MULTI: {
		title: "친구 {completedFriendCount}명이 오늘 다 끝냈어",
		body: "너만 남았다",
		type: "SOCIAL_DIGEST",
		defaultRoute: "/feed",
		variants: [
			{
				title: "친구 {completedFriendCount}명이 오늘 다 끝냈어",
				body: "너만 남았다",
			},
			{
				title: "{completedFriendCount}명이나 올클리어!",
				body: "나만 빼고 다 했어?",
			},
			{ title: "친구들이 앞서가고 있어", body: "지금이라도 따라잡자" },
		],
	} satisfies NotificationTemplate,
	SOCIAL_DIGEST_SINGLE: {
		title: "{friendName}은 오늘 다 끝냈대",
		body: "너는 아직이잖아",
		type: "SOCIAL_DIGEST",
		defaultRoute: "/feed",
		variants: [
			{ title: "{friendName}은 오늘 다 끝냈대", body: "너는 아직이잖아" },
			{ title: "{friendName:이/가} 올클리어 했대!", body: "이대로 있을 거야?" },
			{ title: "{friendName}은 끝냈어", body: "너도 할 수 있잖아" },
		],
	} satisfies NotificationTemplate,
	// 콕 찌르기 유도 (Nudge Suggest)
	NUDGE_SUGGEST: {
		title: "{friendName:이/가} {days}일째 조용해",
		body: "콕 찔러볼래?",
		type: "NUDGE_SUGGEST",
		defaultRoute: "/feed/friend/{friendId}",
		variants: [
			{ title: "{friendName:이/가} {days}일째 조용해", body: "콕 찔러볼래?" },
			{
				title: "{friendName:이/가} {days}일째 안 보여",
				body: "한 번 찔러볼까?",
			},
			{ title: "{friendName:이/가} 요즘 뜸해", body: "안부 한 번 물어볼래?" },
		],
	} satisfies NotificationTemplate,
} as const;

// =============================================================================
// System Templates
// =============================================================================

export const SYSTEM_TEMPLATES = {
	// Win-back (비활성 유저 재방문 유도)
	WINBACK_DAY3: {
		title: "3일째 잠수야?",
		body: "할일들이 기다리고 있을걸",
		type: "WINBACK",
		defaultRoute: "/feed",
		variants: [
			{ title: "3일째 잠수야?", body: "할일들이 기다리고 있을걸" },
			{ title: "3일 만이야", body: "오늘 하나만 해보자" },
			{ title: "3일이나 비웠네", body: "가볍게 하나만 시작해볼까?" },
		],
	} satisfies NotificationTemplate,
	WINBACK_DAY7: {
		title: "일주일이나 안 왔잖아",
		body: "한 개만. 딱 한 개만 해보자",
		type: "WINBACK",
		defaultRoute: "/feed",
		variants: [
			{ title: "일주일이나 안 왔잖아", body: "한 개만. 딱 한 개만 해보자" },
			{ title: "7일 만이야", body: "다시 시작해도 늦지 않았어" },
			{ title: "일주일째 조용한데", body: "할일 하나만 만들어볼까?" },
		],
	} satisfies NotificationTemplate,
	WINBACK_DAY14: {
		title: "거의 잊혀질 뻔했어",
		body: "다시 시작해도 괜찮아",
		type: "WINBACK",
		defaultRoute: "/feed",
		variants: [
			{ title: "거의 잊혀질 뻔했어", body: "다시 시작해도 괜찮아" },
			{ title: "2주 만이야", body: "오늘이 새로운 Day 1이야" },
			{ title: "오래 쉬었네", body: "언제든 돌아올 수 있어" },
		],
	} satisfies NotificationTemplate,
	WINBACK_DAY21: {
		title: "3주 만이야",
		body: "할일 하나만 만들어볼까?",
		type: "WINBACK",
		defaultRoute: "/feed",
		variants: [
			{ title: "3주 만이야", body: "할일 하나만 만들어볼까?" },
			{ title: "기다리고 있었어", body: "작은 것부터 다시 시작해보자" },
			{ title: "오래 쉬었다", body: "오늘이 새 출발이야" },
		],
	} satisfies NotificationTemplate,
	WINBACK_DAY30: {
		title: "한 달 만이야",
		body: "언제든 다시 시작할 수 있어",
		type: "WINBACK",
		defaultRoute: "/feed",
		variants: [
			{ title: "한 달 만이야", body: "언제든 다시 시작할 수 있어" },
			{ title: "돌아올 거라고 믿었어", body: "오늘이 새로운 Day 1이야" },
			{ title: "오랜만이야", body: "하나만 해보자, 다시" },
		],
	} satisfies NotificationTemplate,
	// 주간 달성 배지
	WEEKLY_ACHIEVEMENT: {
		title: "이번 주 {completedCount}개 클리어",
		body: "다음 주엔 더 할 수 있잖아",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
		variants: [
			{
				title: "이번 주 {completedCount}개 클리어",
				body: "다음 주엔 더 할 수 있잖아",
			},
			{ title: "{completedCount}개 완료!", body: "꾸준히 하고 있네" },
			{
				title: "이번 주 {completedCount}개 해냈어",
				body: "조금씩 늘어가고 있어",
			},
		],
	} satisfies NotificationTemplate,
	WEEKLY_ACHIEVEMENT_PERFECT: {
		title: "이번 주 전부 다 해냈어",
		body: "완벽한 한 주였다",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
		variants: [
			{ title: "이번 주 전부 다 해냈어", body: "완벽한 한 주였다" },
			{ title: "올클리어!", body: "이런 주가 계속되면 전설임" },
			{ title: "100% 완료!", body: "진짜 대단해" },
		],
	} satisfies NotificationTemplate,
	WEEKLY_ACHIEVEMENT_ALMOST: {
		title: "이번 주 완료율 {rate}%",
		body: "거의 다 했는데 아쉽다",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
		variants: [
			{ title: "이번 주 완료율 {rate}%", body: "거의 다 했는데 아쉽다" },
			{ title: "{rate}% 달성!", body: "다음 주 100% 가보자" },
			{ title: "이번 주 {rate}%!", body: "아깝지만 충분히 잘 했어" },
		],
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
	// 온보딩 시퀀스 (신규 유저 7일)
	ONBOARDING_DAY0: {
		title: "첫 할일을 만들어볼까?",
		body: "작은 거 하나면 충분해",
		type: "SYSTEM_NOTICE",
		defaultRoute: "/create-todo",
	} satisfies NotificationTemplate,
	ONBOARDING_DAY1: {
		title: "어제 만든 할일, 해봤어?",
		body: "완료 체크하면 기분 좋을걸",
		type: "SYSTEM_NOTICE",
		defaultRoute: null,
	} satisfies NotificationTemplate,
	ONBOARDING_DAY2: {
		title: "혼자보다 같이가 낫잖아",
		body: "친구 추가하고 서로 응원해보자",
		type: "SYSTEM_NOTICE",
		defaultRoute: "/friends",
	} satisfies NotificationTemplate,
	ONBOARDING_DAY3: {
		title: "알림 시간 맞춰놨어?",
		body: "원하는 시간에 알려줄게",
		type: "SYSTEM_NOTICE",
		defaultRoute: "/settings",
	} satisfies NotificationTemplate,
	ONBOARDING_DAY5: {
		title: "벌써 {completedCount}개 완료!",
		body: "이 속도면 금방 습관 됨",
		type: "SYSTEM_NOTICE",
		defaultRoute: null,
	} satisfies NotificationTemplate,
	ONBOARDING_DAY7: {
		title: "첫 주 끝!",
		body: "{completedCount}개 해냈어, 다음 주도 가보자",
		type: "SYSTEM_NOTICE",
		defaultRoute: null,
	} satisfies NotificationTemplate,
	// 마일스톤 축하
	MILESTONE_FIRST_COMPLETE: {
		title: "첫 번째 완료!",
		body: "시작이 반이야",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
	} satisfies NotificationTemplate,
	MILESTONE_10: {
		title: "벌써 10개째!",
		body: "꾸준히 하고 있네",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
	} satisfies NotificationTemplate,
	MILESTONE_50: {
		title: "50개 돌파!",
		body: "이쯤 되면 프로야",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
	} satisfies NotificationTemplate,
	MILESTONE_100: {
		title: "100개 달성!",
		body: "진짜 대단해",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
	} satisfies NotificationTemplate,
	MILESTONE_STREAK_3: {
		title: "3일 연속!",
		body: "습관의 시작이야",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
	} satisfies NotificationTemplate,
	MILESTONE_FIRST_FRIEND: {
		title: "첫 친구가 생겼어!",
		body: "같이 하면 더 잘 돼",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/friends",
	} satisfies NotificationTemplate,
} as const;

// =============================================================================
// Utilities
// =============================================================================

/**
 * variants 풀에서 랜덤으로 하나를 선택합니다.
 * variants가 없으면 기본 title/body를 반환합니다.
 */
export function pickVariant(
	template: Pick<NotificationTemplate, "title" | "body" | "variants">,
): { title: string; body: string } {
	const pool = template.variants;
	if (!pool?.length) {
		return { title: template.title, body: template.body };
	}
	const picked = pool[Math.floor(Math.random() * pool.length)];
	return picked ?? { title: template.title, body: template.body };
}

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

// =============================================================================
// NotificationMessageBuilder
// =============================================================================

/**
 * 알림 메시지 빌더
 */
export class NotificationMessageBuilder {
	/**
	 * 팔로우 요청 알림 메시지 생성
	 */
	static followNew(senderName: string): { title: string; body: string } {
		const { title, body } = pickVariant(SOCIAL_TEMPLATES.FOLLOW_NEW);
		return {
			title: fillTemplate(title, { senderName }),
			body: fillTemplate(body, { senderName }),
		};
	}

	/**
	 * 맞팔로우 성립 알림 메시지 생성
	 */
	static followAccepted(senderName: string): { title: string; body: string } {
		const { title, body } = pickVariant(SOCIAL_TEMPLATES.FOLLOW_ACCEPTED);
		return {
			title: fillTemplate(title, { senderName }),
			body: fillTemplate(body, { senderName }),
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
		const { title, body } = pickVariant(SOCIAL_TEMPLATES.NUDGE_RECEIVED);
		return {
			title: fillTemplate(title, { senderName, todoTitle }),
			body: fillTemplate(body, { senderName }),
		};
	}

	/**
	 * 리마인드 Nudge 수신 알림 메시지 생성 (할일 만들기 독촉)
	 */
	static remindNudgeReceived(
		senderName: string,
		message?: string,
	): { title: string; body: string } {
		if (message) {
			return {
				title: fillTemplate(
					SOCIAL_TEMPLATES.REMIND_NUDGE_RECEIVED_WITH_MESSAGE.title,
					{ senderName },
				),
				body: fillTemplate(
					SOCIAL_TEMPLATES.REMIND_NUDGE_RECEIVED_WITH_MESSAGE.body,
					{ message },
				),
			};
		}
		const { title, body } = pickVariant(SOCIAL_TEMPLATES.REMIND_NUDGE_RECEIVED);
		return {
			title: fillTemplate(title, { senderName }),
			body: fillTemplate(body, { senderName }),
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
		const { title, body } = pickVariant(
			SOCIAL_TEMPLATES.CHEER_RECEIVED_NO_MESSAGE,
		);
		return {
			title: fillTemplate(title, { senderName }),
			body: fillTemplate(body, { senderName }),
		};
	}

	/**
	 * 친구 할일 완료 알림 메시지 생성
	 */
	static friendCompleted(friendName: string): { title: string; body: string } {
		const { title, body } = pickVariant(SOCIAL_TEMPLATES.FRIEND_COMPLETED);
		return {
			title: fillTemplate(title, { friendName }),
			body: fillTemplate(body, { friendName }),
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
		let template: Pick<NotificationTemplate, "title" | "body" | "variants">;
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

		const { title, body } = pickVariant(template);
		return {
			title: fillTemplate(title, { todoTitle }),
			body: fillTemplate(body, { todoTitle }),
		};
	}

	/**
	 * 아침 할일 없음 알림 메시지 생성
	 */
	static morningNoTodo(): { title: string; body: string } {
		return pickVariant(SCHEDULER_TEMPLATES.MORNING_NO_TODO);
	}

	/**
	 * 아침 리마인더 알림 메시지 생성
	 */
	static morningReminder(count: number): { title: string; body: string } {
		const { title, body } = pickVariant(SCHEDULER_TEMPLATES.MORNING_REMINDER);
		return {
			title: fillTemplate(title, { count }),
			body: fillTemplate(body, { count }),
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
				const { title, body } = pickVariant(SCHEDULER_TEMPLATES.EVENING_STREAK);
				return {
					title: fillTemplate(title, { streak }),
					body: fillTemplate(body, { streak, next: streak + 1 }),
				};
			}
			return pickVariant(SCHEDULER_TEMPLATES.EVENING_COMPLETE);
		}

		// B. 일부 완료
		if (completed > 0) {
			const remaining = total - completed;
			if (isStreakAtRisk && streak >= 2) {
				const { title, body } = pickVariant(
					SCHEDULER_TEMPLATES.EVENING_STREAK_RISK_PARTIAL,
				);
				return {
					title: fillTemplate(title, { streak }),
					body: fillTemplate(body, { remaining }),
				};
			}
			const { title, body } = pickVariant(SCHEDULER_TEMPLATES.EVENING_PARTIAL);
			return {
				title: fillTemplate(title, { remaining }),
				body: fillTemplate(body, { remaining }),
			};
		}

		// C. 하나도 안 함
		if (isStreakAtRisk && streak >= 2) {
			const { title, body } = pickVariant(
				SCHEDULER_TEMPLATES.EVENING_STREAK_RISK_NONE,
			);
			return {
				title: fillTemplate(title, { streak }),
				body: fillTemplate(body, { streak }),
			};
		}
		return pickVariant(SCHEDULER_TEMPLATES.EVENING_NONE);
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
		if (inactiveDays >= 30) {
			return pickVariant(SYSTEM_TEMPLATES.WINBACK_DAY30);
		}
		if (inactiveDays >= 21) {
			return pickVariant(SYSTEM_TEMPLATES.WINBACK_DAY21);
		}
		if (inactiveDays >= 14) {
			return pickVariant(SYSTEM_TEMPLATES.WINBACK_DAY14);
		}
		if (inactiveDays >= 7) {
			return pickVariant(SYSTEM_TEMPLATES.WINBACK_DAY7);
		}
		return pickVariant(SYSTEM_TEMPLATES.WINBACK_DAY3);
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
			return pickVariant(SYSTEM_TEMPLATES.WEEKLY_ACHIEVEMENT_PERFECT);
		}
		if (rate >= 90) {
			const { title, body } = pickVariant(
				SYSTEM_TEMPLATES.WEEKLY_ACHIEVEMENT_ALMOST,
			);
			return {
				title: fillTemplate(title, { rate }),
				body: fillTemplate(body, { rate }),
			};
		}
		const { title, body } = pickVariant(SYSTEM_TEMPLATES.WEEKLY_ACHIEVEMENT);
		return {
			title: fillTemplate(title, { completedCount }),
			body: fillTemplate(body, { completedCount }),
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
			const { title, body } = pickVariant(
				SOCIAL_TEMPLATES.SOCIAL_DIGEST_SINGLE,
			);
			return {
				title: fillTemplate(title, { friendName }),
				body: fillTemplate(body, { friendName }),
			};
		}
		const { title, body } = pickVariant(SOCIAL_TEMPLATES.SOCIAL_DIGEST_MULTI);
		return {
			title: fillTemplate(title, { completedFriendCount }),
			body: fillTemplate(body, { completedFriendCount }),
		};
	}

	/**
	 * 점심 넛지 알림 메시지 생성
	 */
	static lunchNudge(): { title: string; body: string } {
		return pickVariant(SCHEDULER_TEMPLATES.LUNCH_NUDGE);
	}

	/**
	 * 스트릭 위기 알림 메시지 생성
	 */
	static streakAtRisk(streak: number): { title: string; body: string } {
		const { title, body } = pickVariant(SCHEDULER_TEMPLATES.STREAK_AT_RISK);
		return {
			title: fillTemplate(title, { streak }),
			body: fillTemplate(body, { streak }),
		};
	}

	/**
	 * 콕 찌르기 유도 알림 메시지 생성
	 */
	static nudgeSuggest(
		friendName: string,
		days: number,
	): { title: string; body: string } {
		const { title, body } = pickVariant(SOCIAL_TEMPLATES.NUDGE_SUGGEST);
		return {
			title: fillTemplate(title, { friendName, days }),
			body: fillTemplate(body, { friendName, days }),
		};
	}

	/**
	 * 온보딩 알림 메시지 생성
	 */
	static onboarding(
		day: number,
		completedCount?: number,
	): { title: string; body: string } | null {
		const templateMap: Record<number, NotificationTemplate> = {
			0: SYSTEM_TEMPLATES.ONBOARDING_DAY0,
			1: SYSTEM_TEMPLATES.ONBOARDING_DAY1,
			2: SYSTEM_TEMPLATES.ONBOARDING_DAY2,
			3: SYSTEM_TEMPLATES.ONBOARDING_DAY3,
			5: SYSTEM_TEMPLATES.ONBOARDING_DAY5,
			7: SYSTEM_TEMPLATES.ONBOARDING_DAY7,
		};

		const template = templateMap[day];
		if (!template) return null;

		return {
			title: fillTemplate(template.title, { completedCount }),
			body: fillTemplate(template.body, { completedCount }),
		};
	}

	/**
	 * 마일스톤 축하 알림 메시지 생성
	 */
	static milestone(
		type:
			| "FIRST_COMPLETE"
			| "COUNT_10"
			| "COUNT_50"
			| "COUNT_100"
			| "STREAK_3"
			| "FIRST_FRIEND",
	): { title: string; body: string } {
		const templateMap = {
			FIRST_COMPLETE: SYSTEM_TEMPLATES.MILESTONE_FIRST_COMPLETE,
			COUNT_10: SYSTEM_TEMPLATES.MILESTONE_10,
			COUNT_50: SYSTEM_TEMPLATES.MILESTONE_50,
			COUNT_100: SYSTEM_TEMPLATES.MILESTONE_100,
			STREAK_3: SYSTEM_TEMPLATES.MILESTONE_STREAK_3,
			FIRST_FRIEND: SYSTEM_TEMPLATES.MILESTONE_FIRST_FRIEND,
		} as const;

		const template = templateMap[type];
		return { title: template.title, body: template.body };
	}
}
