import { josa } from "es-hangul";

import type { NotificationType } from "@/generated/prisma/client";
import type { WeatherForecast } from "@/modules/weather/providers/weather-provider.interface";

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
		title: "⏰ {todoTitle}, 1시간 뒤 시작!",
		body: "미리 해두면 마음이 편해져",
		type: "TODO_REMINDER",
		defaultRoute: "/todos/{todoId}",
		variants: [
			{
				title: "⏰ {todoTitle}, 1시간 뒤 시작!",
				body: "미리 해두면 마음이 편해져",
			},
			{ title: "{todoTitle}까지 1시간 ⏳", body: "슬슬 몸 풀어볼까?" },
			{
				title: "1시간 뒤에 {todoTitle} 있어 👀",
				body: "지금 시작하면 여유롭게 끝나",
			},
		],
	} satisfies NotificationTemplate,
	TODO_REMINDER_60MIN: {
		title: "⏰ {todoTitle}, 1시간 뒤 시작!",
		body: "미리 해두면 마음이 편해져",
		type: "TODO_REMINDER",
		defaultRoute: "/todos/{todoId}",
		variants: [
			{
				title: "⏰ {todoTitle}, 1시간 뒤 시작!",
				body: "미리 해두면 마음이 편해져",
			},
			{ title: "{todoTitle}까지 1시간 ⏳", body: "슬슬 몸 풀어볼까?" },
			{
				title: "1시간 뒤에 {todoTitle} 있어 👀",
				body: "지금 시작하면 여유롭게 끝나",
			},
		],
	} satisfies NotificationTemplate,
	TODO_REMINDER_10MIN: {
		title: "⏰ {todoTitle}, 10분 전!",
		body: "딱 좋은 타이밍이야, 가보자",
		type: "TODO_REMINDER",
		defaultRoute: "/todos/{todoId}",
		variants: [
			{ title: "⏰ {todoTitle}, 10분 전!", body: "딱 좋은 타이밍이야, 가보자" },
			{ title: "{todoTitle}까지 10분 🔥", body: "준비됐지?" },
			{ title: "10분 뒤 {todoTitle} 시작이야", body: "지금이 골든타임 ✨" },
		],
	} satisfies NotificationTemplate,
	TODO_REMINDER_IMMEDIATE: {
		title: "🚀 {todoTitle}, 지금 시작!",
		body: "시작이 반이야",
		type: "TODO_REMINDER",
		defaultRoute: "/todos/{todoId}",
		variants: [
			{ title: "🚀 {todoTitle}, 지금 시작!", body: "시작이 반이야" },
			{ title: "{todoTitle} 할 시간이야 ⏰", body: "바로 가보자!" },
			{
				title: "딱 지금이야, {todoTitle} ✨",
				body: "5분만 해봐, 몸이 풀릴 거야",
			},
		],
	} satisfies NotificationTemplate,
	MORNING_REMINDER: {
		title: "☀️ 오늘 할 일 {count}개",
		body: "가장 쉬운 것부터 하나씩 가보자",
		type: "MORNING_REMINDER",
		defaultRoute: "/todos",
		variants: [
			{
				title: "☀️ 오늘 할 일 {count}개",
				body: "가장 쉬운 것부터 하나씩 가보자",
			},
			{ title: "오늘의 미션 {count}개 🎯", body: "하나만 끝내도 흐름 탄다" },
			{
				title: "{count}개가 널 기다리고 있어 👋",
				body: "아침에 해치우면 저녁이 한가해져",
			},
			{
				title: "좋은 아침! 오늘은 {count}개야 ☀️",
				body: "커피 한 잔 하고 바로 시작해볼까?",
			},
			{
				title: "할 일 {count}개 도착 📬",
				body: "순서대로 하나씩 접수해 주세요~",
			},
		],
	} satisfies NotificationTemplate,
	EVENING_COMPLETE: {
		title: "🎉 올클리어!",
		body: "오늘 너 진짜 멋있었어",
		type: "EVENING_REMINDER",
		defaultRoute: "/",
		variants: [
			{ title: "🎉 올클리어!", body: "오늘 너 진짜 멋있었어" },
			{ title: "오늘 치 전부 완료 ✅", body: "이런 날이 쌓이면 인생이 바뀐다" },
			{ title: "다 해버렸네? 😎", body: "오늘의 나에게 박수 짝짝짝" },
			{ title: "완료 도장 꽝! 🏆", body: "이제 편하게 쉬어, 자격 충분해" },
			{ title: "퍼펙트한 하루 ✨", body: "내일의 너도 오늘만 같아라" },
		],
	} satisfies NotificationTemplate,
	EVENING_PARTIAL: {
		title: "올클리어까지 {remaining}개 🔥",
		body: "거의 다 왔잖아, 여기서 끝내자",
		type: "EVENING_REMINDER",
		defaultRoute: "/todos",
		variants: [
			{
				title: "올클리어까지 {remaining}개 🔥",
				body: "거의 다 왔잖아, 여기서 끝내자",
			},
			{ title: "{remaining}개만 더! 💪", body: "자기 전에 해치우면 꿀잠 각" },
			{
				title: "오늘 잘했어, 근데 {remaining}개 남았어 👀",
				body: "마무리 한 번 가볼까?",
			},
			{
				title: "딱 {remaining}개 남았다 ✨",
				body: "끝내고 자면 기분이 다를걸",
			},
		],
	} satisfies NotificationTemplate,
	EVENING_NONE: {
		title: "오늘 아직 0개야 🥲",
		body: "딱 하나만 해보자, 그거면 충분해",
		type: "EVENING_REMINDER",
		defaultRoute: "/todos",
		variants: [
			{
				title: "오늘 아직 0개야 🥲",
				body: "딱 하나만 해보자, 그거면 충분해",
			},
			{
				title: "할 일들이 기다리다 지쳤대 😢",
				body: "하나만 완료해 주고 자자",
			},
			{ title: "오늘 바빴구나 💦", body: "작은 것 하나가 내일의 시작이야" },
			{ title: "이대로 자면 아쉽잖아 🌙", body: "5분짜리 하나만 끝내볼까?" },
		],
	} satisfies NotificationTemplate,
	MORNING_NO_TODO: {
		title: "오늘 할 일이 텅 비었어 📭",
		body: "하나만 적어도 하루가 달라져",
		type: "MORNING_REMINDER",
		defaultRoute: "/todos",
		variants: [
			{
				title: "오늘 할 일이 텅 비었어 📭",
				body: "하나만 적어도 하루가 달라져",
			},
			{ title: "오늘은 백지 상태 📝", body: "제일 하고 싶은 것부터 적어볼까?" },
			{ title: "할 일 0개, 진짜야? 👀", body: "여유로운 거야, 미루는 거야?" },
		],
	} satisfies NotificationTemplate,
	// 스트릭 축하 (전체 완료 + 스트릭 2일+)
	EVENING_STREAK: {
		title: "🔥 {streak}일 연속 올클리어!",
		body: "내일이면 {next}일째, 이 불꽃 꺼뜨리지 마",
		type: "EVENING_REMINDER",
		defaultRoute: "/",
		variants: [
			{
				title: "🔥 {streak}일 연속 올클리어!",
				body: "내일이면 {next}일째, 이 불꽃 꺼뜨리지 마",
			},
			{
				title: "{streak}일째 달리는 중 🏃",
				body: "이대로 {next}일 찍으러 가보자",
			},
			{ title: "{streak}일 연속?! 미쳤다 🔥", body: "이 흐름 그대로 쭉 가자" },
		],
	} satisfies NotificationTemplate,
	EVENING_STREAK_7: {
		title: "🎉 7일 연속! 일주일 올클리어",
		body: "이거 실화야? 진짜 대단해",
		type: "EVENING_REMINDER",
		defaultRoute: "/",
	} satisfies NotificationTemplate,
	EVENING_STREAK_14: {
		title: "🏆 2주 연속 달성!",
		body: "이쯤 되면 그냥 습관이야",
		type: "EVENING_REMINDER",
		defaultRoute: "/",
	} satisfies NotificationTemplate,
	EVENING_STREAK_30: {
		title: "👑 {streak}일째, 전설이 되는 중",
		body: "여기서 멈추면 반칙이야",
		type: "EVENING_REMINDER",
		defaultRoute: "/",
	} satisfies NotificationTemplate,
	// 스트릭 위기 (일부 완료 + 스트릭 2일+)
	EVENING_STREAK_RISK_PARTIAL: {
		title: "🚨 {streak}일 기록이 위험해",
		body: "{remaining}개만 끝내면 지킬 수 있어!",
		type: "EVENING_REMINDER",
		defaultRoute: "/todos",
		variants: [
			{
				title: "🚨 {streak}일 기록이 위험해",
				body: "{remaining}개만 끝내면 지킬 수 있어!",
			},
			{
				title: "{streak}일째인데 여기서 끊기면 아깝잖아 😱",
				body: "딱 {remaining}개 남았어",
			},
			{ title: "아직 기회 있어 ⏳", body: "{remaining}개만 하면 기록 세이브!" },
		],
	} satisfies NotificationTemplate,
	// 스트릭 위기 (하나도 안 함 + 스트릭 2일+)
	EVENING_STREAK_RISK_NONE: {
		title: "🚨 {streak}일 기록, 아직 살릴 수 있어",
		body: "하나만 끝내면 세이브 성공",
		type: "EVENING_REMINDER",
		defaultRoute: "/todos",
		variants: [
			{
				title: "🚨 {streak}일 기록, 아직 살릴 수 있어",
				body: "하나만 끝내면 세이브 성공",
			},
			{
				title: "{streak}일 불꽃이 꺼지기 직전이야 🕯️",
				body: "오늘 하나면 다시 활활 타올라",
			},
			{
				title: "{streak}일이나 쌓았잖아 😢",
				body: "하나만 해도 기록은 이어져",
			},
		],
	} satisfies NotificationTemplate,
	// 점심 넛지 (12:30, 오늘 완료 0개)
	LUNCH_NUDGE: {
		title: "🍚 밥 먹었으면 하나 해볼까?",
		body: "오후의 시작은 할 일 하나부터",
		type: "LUNCH_NUDGE",
		defaultRoute: "/feed",
		variants: [
			{
				title: "🍚 밥 먹었으면 하나 해볼까?",
				body: "오후의 시작은 할 일 하나부터",
			},
			{ title: "아직 0개야 👀", body: "점심값 했으니 할일값도 하자" },
			{ title: "오후 출발! 🏃", body: "하나만 끝내면 탄력 붙는다" },
			{
				title: "식곤증엔 완료 체크가 특효약 💊",
				body: "제일 쉬운 것부터 가보자",
			},
		],
	} satisfies NotificationTemplate,
	// 스트릭 위기 전용 알림 (21:00, 스트릭 3일+ & 미완료)
	STREAK_AT_RISK: {
		title: "🚨 {streak}일 기록이 오늘에 달렸어",
		body: "하나만 끝내면 계속 달릴 수 있어",
		type: "STREAK_AT_RISK",
		defaultRoute: "/feed",
		variants: [
			{
				title: "🚨 {streak}일 기록이 오늘에 달렸어",
				body: "하나만 끝내면 계속 달릴 수 있어",
			},
			{ title: "{streak}일째인데 여기서 멈출 거야? 😱", body: "딱 하나만!" },
			{
				title: "{streak}일 불꽃 꺼지기 직전 🔥",
				body: "지금 하나 끝내면 세이브 완료",
			},
		],
	} satisfies NotificationTemplate,
} as const;

// =============================================================================
// Weather Templates
// =============================================================================

export const WEATHER_TEMPLATES = {
	MORNING_CLEAR: {
		title: "☀️ 오늘 {skyLabel}, {tempMin}~{tempMax}°C",
		body: "할 일 해치우기 딱 좋은 날씨야",
		type: "WEATHER_MORNING" as NotificationType,
		variants: [
			{
				title: "☀️ 오늘 {skyLabel}, {tempMin}~{tempMax}°C",
				body: "할 일 해치우기 딱 좋은 날씨야",
			},
			{
				title: "오늘 {skyLabel} {tempMin}~{tempMax}°C 🌤️",
				body: "밖에서 할 일 있으면 오늘이 기회!",
			},
		],
	} satisfies NotificationTemplate,
	MORNING_RAIN: {
		title: "☔ 오늘 비 소식, 확률 {precipProb}%",
		body: "우산 꼭 챙기자! {tempMin}~{tempMax}°C",
		type: "WEATHER_MORNING" as NotificationType,
		variants: [
			{
				title: "☔ 오늘 비 소식, 확률 {precipProb}%",
				body: "우산 꼭 챙기자! {tempMin}~{tempMax}°C",
			},
			{
				title: "🌧️ 오늘 비 올 확률 {precipProb}%",
				body: "실내 할 일부터 해치우기 좋은 날이야 ({tempMin}~{tempMax}°C)",
			},
		],
	} satisfies NotificationTemplate,
	MORNING_SNOW: {
		title: "❄️ 오늘 눈 소식, 확률 {precipProb}%",
		body: "따뜻하게 입고 나가자! {tempMin}~{tempMax}°C",
		type: "WEATHER_MORNING" as NotificationType,
		variants: [
			{
				title: "❄️ 오늘 눈 소식, 확률 {precipProb}%",
				body: "따뜻하게 입고 나가자! {tempMin}~{tempMax}°C",
			},
			{
				title: "☃️ 오늘 눈 올지도 몰라 ({precipProb}%)",
				body: "길 미끄러우니 여유 있게 움직이자 {tempMin}~{tempMax}°C",
			},
		],
	} satisfies NotificationTemplate,
	EVENING_CLEAR: {
		title: "🌙 내일 {skyLabel}, {tempMin}~{tempMax}°C",
		body: "내일 할 일 미리 정해두면 아침이 편해",
		type: "WEATHER_EVENING" as NotificationType,
		variants: [
			{
				title: "🌙 내일 {skyLabel}, {tempMin}~{tempMax}°C",
				body: "내일 할 일 미리 정해두면 아침이 편해",
			},
			{
				title: "내일 날씨 {skyLabel} {tempMin}~{tempMax}°C ✨",
				body: "지금 계획 세워두면 내일의 내가 고마워할걸",
			},
		],
	} satisfies NotificationTemplate,
	EVENING_RAIN: {
		title: "☔ 내일 비 올 확률 {precipProb}%",
		body: "우산 미리 챙겨두자! {tempMin}~{tempMax}°C",
		type: "WEATHER_EVENING" as NotificationType,
		variants: [
			{
				title: "☔ 내일 비 올 확률 {precipProb}%",
				body: "우산 미리 챙겨두자! {tempMin}~{tempMax}°C",
			},
			{
				title: "🌧️ 내일 비 소식이야 ({precipProb}%)",
				body: "실내 할 일 몰아서 하기 좋은 날! {tempMin}~{tempMax}°C",
			},
		],
	} satisfies NotificationTemplate,
	EVENING_SNOW: {
		title: "❄️ 내일 눈 올 확률 {precipProb}%",
		body: "포근하게 입고, 할 일은 실내 위주로! {tempMin}~{tempMax}°C",
		type: "WEATHER_EVENING" as NotificationType,
		variants: [
			{
				title: "❄️ 내일 눈 올 확률 {precipProb}%",
				body: "포근하게 입고, 할 일은 실내 위주로! {tempMin}~{tempMax}°C",
			},
			{
				title: "☃️ 내일 눈 소식이야 ({precipProb}%)",
				body: "미리 계획 세워두면 걱정 없어 {tempMin}~{tempMax}°C",
			},
		],
	} satisfies NotificationTemplate,
} as const;

// =============================================================================
// Social Templates
// =============================================================================

export const SOCIAL_TEMPLATES = {
	FOLLOW_NEW: {
		title: "👋 {senderName}의 친구 신청",
		body: "수락하면 서로의 할 일이 보여. 각오해",
		type: "FOLLOW_NEW",
		defaultRoute: "/friends/requests",
		variants: [
			{
				title: "👋 {senderName}의 친구 신청",
				body: "수락하면 서로의 할 일이 보여. 각오해",
			},
			{
				title: "{senderName:이/가} 같이 하재! 🤝",
				body: "친구랑 하면 진짜 더 잘하게 돼",
			},
			{
				title: "새 친구 신청 도착 💌",
				body: "{senderName:이/가} 기다리고 있어",
			},
		],
	} satisfies NotificationTemplate,
	FOLLOW_ACCEPTED: {
		title: "🎉 {senderName}, 이제 친구!",
		body: "서로 할 일이 다 보여. 각오해",
		type: "FOLLOW_ACCEPTED",
		defaultRoute: "/feed/friend/{friendId}",
		variants: [
			{
				title: "🎉 {senderName}, 이제 친구!",
				body: "서로 할 일이 다 보여. 각오해",
			},
			{
				title: "{senderName:와/과} 연결 완료 🤝",
				body: "이제부터 같이 달리는 거야",
			},
			{
				title: "{senderName:이/가} 수락했어! ✅",
				body: "서로 응원하면서 가보자",
			},
		],
	} satisfies NotificationTemplate,
	NUDGE_RECEIVED: {
		title: "👉 {senderName:이/가} '{todoTitle}' 콕!",
		body: "아직도 안 했어? 😏",
		type: "NUDGE_RECEIVED",
		defaultRoute: "/feed/friend/{friendId}",
		variants: [
			{
				title: "👉 {senderName:이/가} '{todoTitle}' 콕!",
				body: "아직도 안 했어? 😏",
			},
			{
				title: "{senderName:이/가} '{todoTitle}' 찔렀어 👀",
				body: "얼른 하라는 뜻이야",
			},
			{
				title: "콕콕! {senderName:이/가} '{todoTitle}' 재촉 중",
				body: "기다리고 있대",
			},
		],
	} satisfies NotificationTemplate,
	NUDGE_RECEIVED_WITH_MESSAGE: {
		title: "👉 {senderName:이/가} '{todoTitle}' 콕!",
		body: "💬 '{message}'",
		type: "NUDGE_RECEIVED",
		defaultRoute: "/feed/friend/{friendId}",
	} satisfies NotificationTemplate,
	REMIND_NUDGE_RECEIVED: {
		title: "👉 {senderName:이/가} 콕 찔렀어!",
		body: "할 일 좀 만들라는데? 😆",
		type: "NUDGE_RECEIVED",
		defaultRoute: "/feed",
		variants: [
			{
				title: "👉 {senderName:이/가} 콕 찔렀어!",
				body: "할 일 좀 만들라는데? 😆",
			},
			{
				title: "{senderName:이/가} 널 찾고 있어 👀",
				body: "뭐라도 하나 적어볼까?",
			},
			{
				title: "콕! {senderName:이/가} 안부 물었어 💌",
				body: "오늘 뭐 할지 하나만 적어보자",
			},
		],
	} satisfies NotificationTemplate,
	REMIND_NUDGE_RECEIVED_WITH_MESSAGE: {
		title: "👉 {senderName:이/가} 콕 찔렀어!",
		body: "💬 '{message}'",
		type: "NUDGE_RECEIVED",
		defaultRoute: "/feed",
	} satisfies NotificationTemplate,
	CHEER_RECEIVED: {
		title: "💌 {senderName}의 한마디",
		body: "{message}",
		type: "CHEER_RECEIVED",
		defaultRoute: "/feed/friend/{friendId}",
	} satisfies NotificationTemplate,
	CHEER_RECEIVED_NO_MESSAGE: {
		title: "📣 {senderName:이/가} 응원 보냈어",
		body: "잘하고 있는 거 다 알고 있대",
		type: "CHEER_RECEIVED",
		defaultRoute: "/feed/friend/{friendId}",
		variants: [
			{
				title: "📣 {senderName:이/가} 응원 보냈어",
				body: "잘하고 있는 거 다 알고 있대",
			},
			{
				title: "{senderName:이/가} 널 응원해 💪",
				body: "힘내, 오늘도 할 수 있어",
			},
			{
				title: "{senderName}의 응원 도착 💌",
				body: "너라면 충분히 할 수 있어",
			},
		],
	} satisfies NotificationTemplate,
	FRIEND_COMPLETED: {
		title: "✅ {friendName:이/가} 오늘 다 끝냈대",
		body: "너는? 👀",
		type: "FRIEND_COMPLETED",
		defaultRoute: "/feed/friend/{friendId}",
		variants: [
			{ title: "✅ {friendName:이/가} 오늘 다 끝냈대", body: "너는? 👀" },
			{ title: "{friendName:이/가} 올클리어! 🎉", body: "이대로 질 순 없잖아" },
			{ title: "{friendName:이/가} 벌써 다 했대 🔥", body: "우리도 가보자" },
		],
	} satisfies NotificationTemplate,
	// 친구 활동 요약 (Social Digest)
	SOCIAL_DIGEST_MULTI: {
		title: "🔥 친구 {completedFriendCount}명이 오늘 다 끝냈어",
		body: "이제 너만 남았다",
		type: "SOCIAL_DIGEST",
		defaultRoute: "/feed",
		variants: [
			{
				title: "🔥 친구 {completedFriendCount}명이 오늘 다 끝냈어",
				body: "이제 너만 남았다",
			},
			{
				title: "{completedFriendCount}명이나 올클리어! 👀",
				body: "나만 빼고 다 한 거야?",
			},
			{ title: "친구들이 앞서가는 중 🏃", body: "지금 시작해도 안 늦었어" },
		],
	} satisfies NotificationTemplate,
	SOCIAL_DIGEST_SINGLE: {
		title: "✅ {friendName:은/는} 오늘 다 끝냈대",
		body: "너도 할 수 있잖아",
		type: "SOCIAL_DIGEST",
		defaultRoute: "/feed",
		variants: [
			{
				title: "✅ {friendName:은/는} 오늘 다 끝냈대",
				body: "너도 할 수 있잖아",
			},
			{
				title: "{friendName:이/가} 올클리어 했대! 🎉",
				body: "이대로 보고만 있을 거야?",
			},
			{ title: "{friendName:은/는} 벌써 끝냈어 👀", body: "이제 네 차례야" },
		],
	} satisfies NotificationTemplate,
	// 콕 찌르기 유도 (Nudge Suggest)
	NUDGE_SUGGEST: {
		title: "👀 {friendName:이/가} {days}일째 조용해",
		body: "콕 찔러서 깨워볼까?",
		type: "NUDGE_SUGGEST",
		defaultRoute: "/feed/friend/{friendId}",
		variants: [
			{
				title: "👀 {friendName:이/가} {days}일째 조용해",
				body: "콕 찔러서 깨워볼까?",
			},
			{
				title: "{friendName:이/가} {days}일째 안 보여 🫥",
				body: "안부 한 번 물어보자",
			},
			{
				title: "{friendName:이/가} 요즘 잠수 중 🤿",
				body: "콕 한 번이면 돌아올지도?",
			},
		],
	} satisfies NotificationTemplate,
} as const;

// =============================================================================
// System Templates
// =============================================================================

export const SYSTEM_TEMPLATES = {
	// Win-back (비활성 유저 재방문 유도)
	WINBACK_DAY3: {
		title: "👀 3일째 안 보여서 와봤어",
		body: "할 일들이 기다리고 있대",
		type: "WINBACK",
		defaultRoute: "/feed",
		variants: [
			{ title: "👀 3일째 안 보여서 와봤어", body: "할 일들이 기다리고 있대" },
			{ title: "3일 만이야!", body: "가볍게 하나만 해볼까?" },
			{ title: "어디 갔어~ 🥺", body: "오늘 딱 하나만 같이 하자" },
		],
	} satisfies NotificationTemplate,
	WINBACK_DAY7: {
		title: "일주일 만이야 🥲",
		body: "딱 한 개만, 그걸로 충분해",
		type: "WINBACK",
		defaultRoute: "/feed",
		variants: [
			{ title: "일주일 만이야 🥲", body: "딱 한 개만, 그걸로 충분해" },
			{ title: "7일째 조용하네 👀", body: "다시 시작해도 하나도 안 늦었어" },
			{ title: "일주일 동안 보고 싶었어 💌", body: "할 일 하나만 만들어볼까?" },
		],
	} satisfies NotificationTemplate,
	WINBACK_DAY14: {
		title: "2주 만이야, 반갑다! 👋",
		body: "오늘이 새로운 Day 1이야",
		type: "WINBACK",
		defaultRoute: "/feed",
		variants: [
			{ title: "2주 만이야, 반갑다! 👋", body: "오늘이 새로운 Day 1이야" },
			{ title: "거의 잊혀질 뻔했잖아 🥲", body: "다시 시작해도 괜찮아" },
			{ title: "오래 쉬었네 🌱", body: "언제든 돌아올 수 있어, 지금처럼" },
		],
	} satisfies NotificationTemplate,
	WINBACK_DAY21: {
		title: "3주 만이야! 🎈",
		body: "작은 것부터 다시 시작해보자",
		type: "WINBACK",
		defaultRoute: "/feed",
		variants: [
			{ title: "3주 만이야! 🎈", body: "작은 것부터 다시 시작해보자" },
			{ title: "계속 기다리고 있었어 🥺", body: "할 일 하나면 다시 시작이야" },
			{
				title: "슬슬 돌아올 때 됐잖아 😎",
				body: "오늘이 새 출발 하기 딱 좋은 날",
			},
		],
	} satisfies NotificationTemplate,
	WINBACK_DAY30: {
		title: "한 달 만이야, 보고 싶었어 💌",
		body: "언제든 다시 시작할 수 있어",
		type: "WINBACK",
		defaultRoute: "/feed",
		variants: [
			{
				title: "한 달 만이야, 보고 싶었어 💌",
				body: "언제든 다시 시작할 수 있어",
			},
			{ title: "돌아올 거라고 믿었어 🌱", body: "오늘이 새로운 Day 1이야" },
			{ title: "오랜만이야! 👋", body: "하나만 해보자, 처음처럼" },
		],
	} satisfies NotificationTemplate,
	// 주간 달성 배지
	WEEKLY_ACHIEVEMENT: {
		title: "📊 이번 주 {completedCount}개 클리어",
		body: "꾸준함이 곧 실력이야",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
		variants: [
			{
				title: "📊 이번 주 {completedCount}개 클리어",
				body: "꾸준함이 곧 실력이야",
			},
			{
				title: "이번 주 {completedCount}개 완료! ✅",
				body: "다음 주엔 더 갈 수 있겠는데?",
			},
			{
				title: "한 주 동안 {completedCount}개 해냈어 💪",
				body: "조금씩 계속 늘고 있어",
			},
		],
	} satisfies NotificationTemplate,
	WEEKLY_ACHIEVEMENT_PERFECT: {
		title: "🏆 이번 주 100% 올클리어!",
		body: "완벽한 한 주였어",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
		variants: [
			{ title: "🏆 이번 주 100% 올클리어!", body: "완벽한 한 주였어" },
			{
				title: "이번 주 전부 다 해냈어 🎉",
				body: "이런 주가 쌓이면 전설이 된다",
			},
			{ title: "퍼펙트 위크 달성 ✨", body: "진짜 대단해, 박수!" },
		],
	} satisfies NotificationTemplate,
	WEEKLY_ACHIEVEMENT_ALMOST: {
		title: "이번 주 완료율 {rate}% 🔥",
		body: "아깝다! 다음 주엔 100% 가보자",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
		variants: [
			{
				title: "이번 주 완료율 {rate}% 🔥",
				body: "아깝다! 다음 주엔 100% 가보자",
			},
			{ title: "{rate}% 달성! 💪", body: "거의 다 왔어, 마지막 한 조각만" },
			{ title: "이번 주 {rate}%! ✨", body: "충분히 잘했어, 다음 주가 기대돼" },
		],
	} satisfies NotificationTemplate,
	WEEKLY_REPORT: {
		title: "📊 주간 리포트 도착!",
		body: "이번 주 어땠는지 같이 볼까?",
		type: "WEEKLY_REPORT",
		defaultRoute: "/reports",
	} satisfies NotificationTemplate,
	MONTHLY_REPORT: {
		title: "📈 월간 리포트 도착!",
		body: "한 달 동안 얼마나 해냈는지 확인해봐",
		type: "MONTHLY_REPORT",
		defaultRoute: "/reports",
	} satisfies NotificationTemplate,
	AI_SUGGESTION: {
		title: "✨ 반복 패턴 발견!",
		body: "매번 만들기 귀찮지? 자동으로 만들어줄게",
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
		title: "💳 결제에 문제가 생겼어",
		body: "결제 수단을 확인해줘. 이대로면 구독이 멈출 수 있어",
		type: "SYSTEM_NOTICE",
		defaultRoute: null,
	} satisfies NotificationTemplate,
	// 온보딩 시퀀스 (신규 유저 7일)
	ONBOARDING_DAY0: {
		title: "🌱 첫 할 일을 만들어볼까?",
		body: "작은 거 하나면 충분해",
		type: "SYSTEM_NOTICE",
		defaultRoute: "/create-todo",
	} satisfies NotificationTemplate,
	ONBOARDING_DAY1: {
		title: "어제 만든 할 일, 해봤어? ✅",
		body: "완료 체크 한 번이면 기분 좋아질걸",
		type: "SYSTEM_NOTICE",
		defaultRoute: null,
	} satisfies NotificationTemplate,
	ONBOARDING_DAY2: {
		title: "혼자보다 같이가 낫잖아 🤝",
		body: "친구 추가하고 서로 응원해보자",
		type: "SYSTEM_NOTICE",
		defaultRoute: "/friends",
	} satisfies NotificationTemplate,
	ONBOARDING_DAY3: {
		title: "⏰ 알림 시간 맞춰놨어?",
		body: "원하는 시간에 딱 맞춰 알려줄게",
		type: "SYSTEM_NOTICE",
		defaultRoute: "/settings",
	} satisfies NotificationTemplate,
	ONBOARDING_DAY5: {
		title: "벌써 {completedCount}개 완료! 🔥",
		body: "이 속도면 금방 습관 된다",
		type: "SYSTEM_NOTICE",
		defaultRoute: null,
	} satisfies NotificationTemplate,
	ONBOARDING_DAY7: {
		title: "🎉 첫 주 완주!",
		body: "{completedCount}개나 해냈어. 다음 주도 가보자",
		type: "SYSTEM_NOTICE",
		defaultRoute: null,
	} satisfies NotificationTemplate,
	// 마일스톤 축하
	MILESTONE_FIRST_COMPLETE: {
		title: "🎉 첫 번째 완료!",
		body: "시작이 반이야, 벌써 반 왔네",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
	} satisfies NotificationTemplate,
	MILESTONE_10: {
		title: "벌써 10개 달성! ✨",
		body: "꾸준함이 쌓이는 중",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
	} satisfies NotificationTemplate,
	MILESTONE_50: {
		title: "🔥 50개 돌파!",
		body: "이쯤 되면 프로 인정",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
	} satisfies NotificationTemplate,
	MILESTONE_100: {
		title: "👑 100개 달성!",
		body: "세 자릿수라니, 진짜 대단해",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
	} satisfies NotificationTemplate,
	MILESTONE_STREAK_3: {
		title: "🔥 3일 연속!",
		body: "습관은 이렇게 시작되는 거야",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
	} satisfies NotificationTemplate,
	MILESTONE_FIRST_FRIEND: {
		title: "🎉 첫 친구가 생겼어!",
		body: "같이 하면 두 배로 잘 돼",
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
	const index = Math.floor(Math.random() * pool.length);
	const picked = pool[index];
	if (!picked) {
		return { title: template.title, body: template.body };
	}
	return { title: picked.title, body: picked.body };
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

	// =============================================
	// Weather
	// =============================================

	static weatherMorning(forecast: WeatherForecast): {
		title: string;
		body: string;
	} {
		const skyLabel = SKY_LABEL_MAP[forecast.skyCondition] ?? "맑음";
		const vars = {
			skyLabel,
			tempMin: Math.round(forecast.temperatureMin),
			tempMax: Math.round(forecast.temperatureMax),
			precipProb: forecast.precipitationProbability,
		};

		const template = selectWeatherTemplate(
			forecast,
			WEATHER_TEMPLATES.MORNING_SNOW,
			WEATHER_TEMPLATES.MORNING_RAIN,
			WEATHER_TEMPLATES.MORNING_CLEAR,
		);

		const { title, body } = pickVariant(template);
		return {
			title: fillTemplate(title, vars),
			body: fillTemplate(body, vars),
		};
	}

	static weatherEvening(tomorrowForecast: WeatherForecast): {
		title: string;
		body: string;
	} {
		const skyLabel = SKY_LABEL_MAP[tomorrowForecast.skyCondition] ?? "맑음";
		const vars = {
			skyLabel,
			tempMin: Math.round(tomorrowForecast.temperatureMin),
			tempMax: Math.round(tomorrowForecast.temperatureMax),
			precipProb: tomorrowForecast.precipitationProbability,
		};

		const template = selectWeatherTemplate(
			tomorrowForecast,
			WEATHER_TEMPLATES.EVENING_SNOW,
			WEATHER_TEMPLATES.EVENING_RAIN,
			WEATHER_TEMPLATES.EVENING_CLEAR,
		);

		const { title, body } = pickVariant(template);
		return {
			title: fillTemplate(title, vars),
			body: fillTemplate(body, vars),
		};
	}

	/**
	 * 위치 미설정 유저용 아침 날씨 폴백 메시지
	 */
	static weatherMorningFallback(): { title: string; body: string } {
		return {
			title: "오늘 날씨 궁금하지 않아? ☀️",
			body: "위치만 설정하면 매일 아침 날씨도 같이 알려줄게",
		};
	}

	/**
	 * 위치 미설정 유저용 저녁 날씨 폴백 메시지
	 */
	static weatherEveningFallback(): { title: string; body: string } {
		return {
			title: "내일 날씨 미리 알려줄까? 🌙",
			body: "위치 설정하면 내일 계획 세우기 훨씬 편해져",
		};
	}
}

/**
 * 강수형태 우선으로 날씨 템플릿을 선택합니다.
 *
 * - 눈/진눈깨비 예보 → 눈 템플릿
 * - 비/소나기 예보 or 강수확률 40% 이상 → 비 템플릿
 * - 그 외 → 맑음 템플릿
 *
 * (강수확률만 보면 확률 40% 미만의 비 예보에 "맑음" 문구가 나가는 문제가 있어
 * 강수형태를 먼저 판정한다)
 */
function selectWeatherTemplate(
	forecast: WeatherForecast,
	snow: NotificationTemplate,
	rain: NotificationTemplate,
	clear: NotificationTemplate,
): NotificationTemplate {
	const type = forecast.precipitationType;
	if (type === "SNOW" || type === "RAIN_SNOW") {
		return snow;
	}
	if (
		type === "RAIN" ||
		type === "SHOWER" ||
		forecast.precipitationProbability >= 40
	) {
		return rain;
	}
	return clear;
}

const SKY_LABEL_MAP: Record<string, string> = {
	CLEAR: "맑음",
	PARTLY_CLOUDY: "구름많음",
	CLOUDY: "흐림",
};
