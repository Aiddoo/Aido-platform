import { josa } from "es-hangul";

import type {
	NotificationCopy,
	NotificationCopyFactory,
	RetentionNotificationCopyCatalog,
	SchedulerNotificationCopyCatalog,
	SocialNotificationCopyCatalog,
	SystemNotificationCopyCatalog,
	WeatherFallbackCopyCatalog,
	WeatherNotificationCopyCatalog,
} from "../notification-copy.types";

export const SOCIAL_SENDER_FALLBACK = "친구";

const staticCopy =
	(title: string, body: string): NotificationCopyFactory<undefined> =>
	() => ({
		title,
		body,
	});

const copy = (title: string, body: string): NotificationCopy => ({ title, body });

type JosaParticle = Parameters<typeof josa>[1];

/** 영문·emoji 닉네임에서도 알림 생성을 실패시키지 않는 조사 부착 경계. */
function attachJosa(value: string, particle: JosaParticle): string {
	try {
		return josa(value, particle);
	} catch {
		return value;
	}
}

export const SCHEDULER_TEMPLATES = {
	TODO_REMINDER_60MIN: {
		variants: [
			({ todoTitle }) => copy("한 시간 뒤, 출발 준비 ⏰", `‘${todoTitle}’ 차례가 다가오고 있어`),
			({ todoTitle }) => copy("할 일 시계가 한 칸 움직였어", `‘${todoTitle}’까지 한 시간 남았어`),
			({ todoTitle }) => copy("한 시간 전 알림이 톡", `‘${todoTitle}’ 준비를 슬쩍 시작해볼까?`),
		],
	},
	TODO_REMINDER_10MIN: {
		variants: [
			({ todoTitle }) => copy("이제 10분 남았어 ⏰", `‘${todoTitle}’ 준비할 시간이야`),
			({ todoTitle }) => copy("할 일이 준비 운동 중이야", `‘${todoTitle}’까지 10분 남았어`),
			({ todoTitle }) => copy("10분 뒤에 만날 할 일", `‘${todoTitle}’ 차례가 곧 와`),
		],
	},
	TODO_REMINDER_IMMEDIATE: {
		variants: [
			({ todoTitle }) => copy("지금 시작할 시간이야 🚀", `‘${todoTitle}’ 차례가 왔어`),
			({ todoTitle }) => copy("할 일이 문 앞에 도착했어", `‘${todoTitle}’ 지금 시작해볼까?`),
			({ todoTitle }) => copy("출발 신호가 켜졌어", `‘${todoTitle}’ 첫 단추만 끼워보자`),
		],
	},
	MORNING_REMINDER: {
		variants: [
			({ count }) => copy(`오늘 할 일 ${count}개 ☀️`, "가장 만만한 것부터 골라보자"),
			({ count }) => copy(`오늘의 계획은 ${count}개`, "고양이는 이미 목록 옆에 앉았어"),
			({ count }) => copy(`${count}개의 할 일이 기상했어`, "첫 번째 체크를 기다리는 중이야"),
			({ count }) => copy(`좋은 아침, 오늘은 ${count}개`, "한 발자국이면 충분히 좋은 출발이야"),
			({ count }) => copy(`할 일 ${count}개가 줄을 섰어`, "순서는 네가 정하면 돼 🐾"),
		],
	},
	EVENING_COMPLETE: {
		variants: [
			staticCopy("오늘 계획, 전부 완료 🎉", "고양이가 조용히 기립 박수 중이야"),
			staticCopy("오늘 목록이 깨끗해졌어", "빈 체크박스가 한 개도 없어"),
			staticCopy("오늘 할 일은 모두 퇴근", "이제 너도 편하게 쉬어도 돼"),
			staticCopy("완료 도장, 아주 반듯해", "오늘의 네가 꽤 근사했어 🏆"),
			staticCopy("올클리어가 살포시 도착", "오늘도 한 발자국 앞으로 갔어"),
		],
	},
	EVENING_PARTIAL: {
		variants: [
			({ remaining }) =>
				copy(`${remaining}개가 아직 자리를 지키는 중`, "여유가 있으면 하나만 더 만나볼까?"),
			({ remaining }) => copy(`남은 할 일은 ${remaining}개`, "오늘 한 만큼도 분명히 기록됐어"),
			({ remaining }) =>
				copy(`${remaining}개의 체크박스가 깜빡`, "가장 작은 것부터 골라도 좋아 🐾"),
			({ remaining }) =>
				copy(`오늘 목록에 ${remaining}개 남았어`, "할 수 있는 만큼만 차분히 마무리하자"),
		],
	},
	EVENING_NONE: {
		variants: [
			staticCopy("오늘 목록은 아직 고요해 🌙", "쉬는 날이어도 괜찮아, 필요하면 하나만 골라봐"),
			staticCopy("체크박스들이 낮잠을 잤나 봐", "짧은 일 하나로 깨워도 좋아"),
			staticCopy("오늘은 시작 전 화면 그대로", "지금 시작해도 전혀 늦지 않았어"),
			staticCopy("고요한 목록도 하루의 기록이야", "힘이 남았다면 작은 일 하나만 만나보자"),
		],
	},
	MORNING_NO_TODO: {
		variants: [
			staticCopy("오늘 목록이 아주 넓어 📭", "하고 싶은 일 하나를 먼저 놓아볼까?"),
			staticCopy("빈 목록이 꼬리를 흔드는 중", "가장 작은 계획 하나면 충분해"),
			staticCopy("오늘 계획 자리가 비어 있어", "떠오르는 일을 하나만 적어두자"),
		],
	},
	EVENING_STREAK: {
		variants: [
			({ streak, next }) => copy(`${streak}일 연속 올클리어 🔥`, `내일이면 ${next}일째 기록이야`),
			({ streak, next }) => copy(`${streak}일째 차곡차곡`, `다음 칸은 ${next}일, 천천히 이어가자`),
			({ streak }) =>
				copy(`${streak}일 기록이 제법 길어졌어`, "꾸준함이 꼬리처럼 따라오고 있어 🐾"),
		],
	},
	EVENING_STREAK_7: {
		copy: staticCopy("7일 연속, 한 주 완성 🎉", "일주일을 차근차근 채웠어"),
	},
	EVENING_STREAK_14: {
		copy: staticCopy("14일 연속 기록 완성 🏆", "두 주 동안 이어온 발자국이 선명해"),
	},
	EVENING_STREAK_30: {
		copy: ({ streak }) => copy(`${streak}일째 이어지는 기록 👑`, "꾸준함이 이제 제법 익숙해졌어"),
	},
	EVENING_STREAK_RISK_PARTIAL: {
		variants: [
			({ streak, remaining }) =>
				copy(`${streak}일 기록에 ${remaining}개 남았어`, "이어가고 싶다면 작은 것부터 골라봐"),
			({ streak, remaining }) =>
				copy(`${streak}일째 불꽃이 기다리는 중`, `${remaining}개를 마치면 오늘도 이어져 🔥`),
			({ remaining }) => copy(`기록까지 남은 할 일 ${remaining}개`, "가능한 만큼만 차분히 해보자"),
		],
	},
	EVENING_STREAK_RISK_NONE: {
		variants: [
			({ streak }) =>
				copy(`${streak}일 기록이 오늘을 기다려`, "이어가고 싶다면 할 일 하나면 충분해"),
			({ streak }) => copy(`${streak}일 불꽃이 잠깐 졸고 있어`, "하나를 마치면 다시 반짝여 🔥"),
			({ streak }) => copy(`${streak}일째 발자국 앞에 빈칸 하나`, "오늘 한 걸음으로 채울 수 있어"),
		],
	},
	LUNCH_NUDGE: {
		variants: [
			staticCopy("점심 먹고, 할 일도 한입 🍚", "가장 작은 것부터 가볍게 시작해보자"),
			staticCopy("오후 첫 체크가 기다리는 중", "고양이는 쉬운 것부터 고르는 편이야"),
			staticCopy("오후가 슬쩍 문을 열었어", "할 일 하나와 같이 들어가볼까?"),
			staticCopy("점심 뒤의 작은 출발", "첫 완료 하나면 흐름이 생겨 🐾"),
		],
	},
	STREAK_AT_RISK: {
		variants: [
			({ streak }) => copy(`${streak}일 기록이 오늘을 기다려`, "이어가고 싶다면 하나만 완료해봐"),
			({ streak }) => copy(`${streak}일 불꽃이 잠깐 졸고 있어`, "작은 완료 하나면 다시 반짝여 🔥"),
			({ streak }) => copy(`${streak}번째 발자국 다음에 빈칸`, "오늘 한 걸음으로 이어갈 수 있어"),
		],
	},
} satisfies SchedulerNotificationCopyCatalog;

export const WEATHER_TEMPLATES = {
	MORNING_CLEAR: {
		variants: [
			({ skyLabel, tempMin, tempMax }) =>
				copy(`오늘 ${skyLabel}, ${tempMin}~${tempMax}°C ☀️`, "하늘도 오늘 계획을 확인한 모양이야"),
			({ skyLabel, tempMin, tempMax }) =>
				copy(
					`아침 하늘은 ${skyLabel}, ${tempMin}~${tempMax}°C`,
					"바깥 할 일이 있다면 날씨와 상의해봐",
				),
		],
	},
	MORNING_RAIN: {
		variants: [
			({ precipProb, tempMin, tempMax }) =>
				copy(`오늘 비 확률 ${precipProb}% ☔`, `우산 챙기기, ${tempMin}~${tempMax}°C`),
			({ precipProb, tempMin, tempMax }) =>
				copy(`비 소식이 톡, ${precipProb}%`, `고양이는 실내파야. ${tempMin}~${tempMax}°C 🌧️`),
		],
	},
	MORNING_SNOW: {
		variants: [
			({ precipProb, tempMin, tempMax }) =>
				copy(`오늘 눈 확률 ${precipProb}% ❄️`, `따뜻하게 입기, ${tempMin}~${tempMax}°C`),
			({ precipProb, tempMin, tempMax }) =>
				copy(`눈 소식이 살포시, ${precipProb}%`, `길은 천천히, ${tempMin}~${tempMax}°C ☃️`),
		],
	},
	EVENING_CLEAR: {
		variants: [
			({ skyLabel, tempMin, tempMax }) =>
				copy(
					`내일 ${skyLabel}, ${tempMin}~${tempMax}°C 🌙`,
					"내일 계획도 날씨에 맞춰 가볍게 놓아두자",
				),
			({ skyLabel, tempMin, tempMax }) =>
				copy(`내일은 ${skyLabel}, ${tempMin}~${tempMax}°C`, "날씨가 내일 일정표를 먼저 들여다봤어"),
		],
	},
	EVENING_RAIN: {
		variants: [
			({ precipProb, tempMin, tempMax }) =>
				copy(`내일 비 확률 ${precipProb}% ☔`, `우산을 문 앞에, ${tempMin}~${tempMax}°C`),
			({ precipProb, tempMin, tempMax }) =>
				copy(`내일 비 소식, ${precipProb}%`, `실내 계획과 잘 맞겠어. ${tempMin}~${tempMax}°C`),
		],
	},
	EVENING_SNOW: {
		variants: [
			({ precipProb, tempMin, tempMax }) =>
				copy(`내일 눈 확률 ${precipProb}% ❄️`, `따뜻한 옷 준비, ${tempMin}~${tempMax}°C`),
			({ precipProb, tempMin, tempMax }) =>
				copy(
					`내일 눈이 올지도 몰라, ${precipProb}%`,
					`조금 일찍 움직여봐. ${tempMin}~${tempMax}°C`,
				),
		],
	},
} satisfies WeatherNotificationCopyCatalog;

export const SOCIAL_TEMPLATES = {
	FOLLOW_NEW: {
		variants: [
			({ senderName }) => copy(`${senderName}의 친구 신청 👋`, "함께 하루를 나눠보고 싶대"),
			({ senderName }) =>
				copy(
					`${attachJosa(senderName, "이/가")} 친구 문을 두드렸어`,
					"수락하면 서로의 하루를 응원할 수 있어",
				),
			({ senderName }) =>
				copy(
					"새 친구 신청이 도착했어",
					`${attachJosa(senderName, "이/가")} 문 앞에서 얌전히 기다리는 중 🐾`,
				),
		],
	},
	FOLLOW_ACCEPTED: {
		variants: [
			({ senderName }) =>
				copy(
					`${attachJosa(senderName, "와/과")} 이제 친구야 🎉`,
					"서로의 하루에 작은 응원을 보낼 수 있어",
				),
			({ senderName }) =>
				copy(
					`${attachJosa(senderName, "와/과")} 친구가 됐어`,
					"고양이가 연결선을 반듯하게 그어뒀어",
				),
			({ senderName }) =>
				copy(
					`${attachJosa(senderName, "이/가")} 친구 신청을 수락했어`,
					"이제 함께 한 발자국씩 가보자 🐾",
				),
		],
	},
	NUDGE_RECEIVED: {
		variants: [
			({ senderName, todoTitle }) =>
				copy(
					`${attachJosa(senderName, "이/가")} 콕 건드렸어`,
					todoTitle ? `‘${todoTitle}’ 생각나서 왔대 🐾` : "할 일 하나가 살짝 흔들렸어 🐾",
				),
			({ senderName, todoTitle }) =>
				copy(
					`${senderName}의 콕이 도착했어`,
					todoTitle ? `‘${todoTitle}’에 작은 발자국을 남겼어` : "가벼운 응원을 두고 갔어",
				),
			({ senderName, todoTitle }) =>
				copy(
					"할 일이 방금 움찔했어",
					todoTitle
						? `${senderName}의 콕이 ‘${todoTitle}’에 닿았어`
						: `${attachJosa(senderName, "이/가")} 콕 눌렀어`,
				),
		],
	},
	NUDGE_RECEIVED_WITH_MESSAGE: {
		copy: ({ senderName, todoTitle, message }) =>
			copy(
				`${attachJosa(senderName, "이/가")} 콕과 한마디를 보냈어`,
				todoTitle ? `‘${todoTitle}’ · ${message}` : message,
			),
	},
	REMIND_NUDGE_RECEIVED: {
		variants: [
			({ senderName }) =>
				copy(
					`${attachJosa(senderName, "이/가")} 콕 건드렸어`,
					"오늘 계획 자리가 비어 있다고 알려줬어 🐾",
				),
			({ senderName }) =>
				copy(`${senderName}의 작은 알림`, "떠오르는 할 일을 하나 적어보는 건 어때?"),
			({ senderName }) =>
				copy(
					"빈 목록에 콕이 도착했어",
					`${attachJosa(senderName, "이/가")} 계획 하나를 기다리는 중이래`,
				),
		],
	},
	REMIND_NUDGE_RECEIVED_WITH_MESSAGE: {
		copy: ({ senderName, message }) =>
			copy(`${attachJosa(senderName, "이/가")} 콕과 한마디를 보냈어`, message),
	},
	CHEER_RECEIVED: {
		copy: ({ senderName, message }) => copy(`${senderName}의 응원이 도착했어`, message),
	},
	CHEER_RECEIVED_NO_MESSAGE: {
		variants: [
			({ senderName }) =>
				copy(`${attachJosa(senderName, "이/가")} 응원을 보냈어 📣`, "작은 힘 하나를 두고 갔어"),
			({ senderName }) => copy(`${senderName}의 응원이 톡`, "고양이가 소중히 받아뒀어"),
			({ senderName }) =>
				copy("응원 한 봉지가 도착했어", `보낸 사람은 ${senderName}, 무게는 아주 가벼워 🐾`),
		],
	},
	FRIEND_COMPLETED: {
		variants: [
			({ friendName }) => copy(`${friendName}의 오늘이 반짝였어 ✨`, "작은 응원을 보내도 좋아"),
			({ friendName }) =>
				copy(`${friendName}의 하루가 살짝 반짝였어`, "안부 한마디가 잘 어울리는 날이야 🐾"),
			({ friendName }) =>
				copy(`${friendName}의 하루가 기분 좋게 빛났어`, "친구에게 가볍게 인사해봐"),
		],
	},
	SOCIAL_DIGEST_MULTI: {
		variants: [
			({ completedFriendCount }) =>
				copy(
					`친구 ${completedFriendCount}명의 오늘이 반짝였어 ✨`,
					"친구들에게 작은 응원을 보내도 좋아",
				),
			({ completedFriendCount }) =>
				copy(
					`친구 ${completedFriendCount}명의 하루가 살짝 반짝였어`,
					"가벼운 안부 한마디가 잘 어울려 🐾",
				),
			({ completedFriendCount }) =>
				copy(
					`친구 ${completedFriendCount}명의 하루가 기분 좋게 빛났어`,
					"응원 한마디를 건네도 좋아",
				),
		],
	},
	SOCIAL_DIGEST_SINGLE: {
		variants: [
			({ friendName }) => copy(`${friendName}의 오늘이 반짝였어 ✨`, "작은 응원을 보내도 좋아"),
			({ friendName }) =>
				copy(`${friendName}의 하루가 살짝 반짝였어`, "안부 한마디가 잘 어울리는 날이야 🐾"),
			({ friendName }) =>
				copy(`${friendName}의 하루가 기분 좋게 빛났어`, "작은 응원을 건네도 좋아"),
		],
	},
	NUDGE_SUGGEST: {
		variants: [
			({ friendName }) =>
				copy(`${friendName}에게 안부를 건네볼까?`, "부담 없는 콕 하나면 충분해 🐾"),
			({ friendName }) => copy(`${friendName}에게 작은 인사 어때?`, "가벼운 안부를 보내도 좋아"),
			({ friendName }) => copy(`${friendName}에게 콕 하나 준비됐어`, "고양이가 살포시 건네줄게 🐾"),
		],
	},
	TODO_COMMENT: {
		variants: [
			({ senderName }) =>
				copy(`${attachJosa(senderName, "이/가")} 댓글을 남겼어`, "새 이야기가 살포시 도착했어 🐾"),
			({ senderName }) => copy(`${senderName}의 댓글이 도착했어`, "할 일에 대화 한 줄이 생겼어"),
			({ senderName }) =>
				copy(
					`${attachJosa(senderName, "이/가")} 이야기를 보탰어`,
					"댓글이 앱 안에서 얌전히 기다리는 중",
				),
		],
	},
	TODO_COMMENT_CHAIN: {
		variants: [
			({ senderName, count }) =>
				copy(
					`${attachJosa(senderName, "이/가")} 댓글 ${count}개를 남겼어`,
					"대화가 꼬리를 물고 이어졌어 🐾",
				),
			({ senderName, count }) =>
				copy(`${senderName}의 댓글 ${count}개가 도착했어`, "할 일 아래가 조금 북적여졌어"),
			({ senderName, count }) =>
				copy(
					`${attachJosa(senderName, "이/가")} 이야기 ${count}개를 보탰어`,
					"새 댓글들이 앱 안에서 기다리는 중",
				),
		],
	},
	TODO_COMMENT_REPLY: {
		variants: [
			({ senderName }) =>
				copy(`${attachJosa(senderName, "이/가")} 답글을 남겼어`, "대화가 한 칸 더 자랐어 🐾"),
			({ senderName }) => copy(`${senderName}의 답글이 도착했어`, "댓글의 꼬리가 조금 길어졌어"),
			({ senderName }) =>
				copy(
					`${attachJosa(senderName, "이/가")} 대화를 이어갔어`,
					"새 답글이 앱 안에서 기다리는 중",
				),
		],
	},
	TODO_COMMENT_REPLY_CHAIN: {
		variants: [
			({ senderName, count }) =>
				copy(
					`${attachJosa(senderName, "이/가")} 답글 ${count}개를 이어 썼어`,
					"대화가 제법 길게 자랐어 🐾",
				),
			({ senderName, count }) =>
				copy(`${senderName}의 답글 ${count}개가 도착했어`, "댓글의 꼬리가 조금 더 길어졌어"),
			({ senderName, count }) =>
				copy(
					`${attachJosa(senderName, "이/가")} 대화 ${count}칸을 보탰어`,
					"새 답글들이 앱 안에서 기다리는 중",
				),
		],
	},
	TODO_COMMENT_LIKE: {
		variants: [
			({ senderName }) =>
				copy(
					`${attachJosa(senderName, "이/가")} 네 댓글을 좋아해`,
					"댓글에 작은 하트가 도착했어 ❤️",
				),
			({ senderName }) =>
				copy(`${senderName}의 하트가 도착했어`, "네 댓글이 아무렇지 않은 척 뿌듯해하는 중"),
			({ senderName }) =>
				copy(
					`${attachJosa(senderName, "이/가")} 댓글에 마음을 남겼어`,
					"하트 하나가 조용히 자리를 잡았어",
				),
		],
	},
} satisfies SocialNotificationCopyCatalog;

export const SYSTEM_TEMPLATES = {
	WINBACK_DAY3: {
		variants: [
			staticCopy("할 일들이 잠깐 낮잠 중이야 💤", "돌아오면 목록이 모른 척 반겨줄 거야"),
			staticCopy("목록에 조용한 바람이 불었어", "오늘 필요한 일 하나만 놓아봐"),
			staticCopy("Aido 고양이가 자리를 데워뒀어", "언제든 한 발자국부터 다시 시작해 🐾"),
		],
	},
	WINBACK_DAY7: {
		variants: [
			staticCopy("목록이 일주일째 아주 얌전해", "새 계획 하나면 다시 움직이기 시작해 🐾"),
			staticCopy("고양이가 달력 한 장을 넘겼어", "오늘 필요한 것부터 천천히 적어봐"),
			staticCopy("쉬고 돌아온 자리도 네 자리야", "가장 작은 할 일 하나로 시작해도 좋아"),
		],
	},
	WINBACK_DAY14: {
		variants: [
			staticCopy("목록에 보름달이 두 번쯤 떴어 🌕", "오늘을 새로운 첫날로 정해도 좋아"),
			staticCopy("오래 쉰 계획표가 기지개 중", "지금 필요한 일 하나만 새로 적어봐"),
			staticCopy("다시 시작 버튼은 늘 여기 있어", "부담 없는 한 걸음부터 만나자 🐾"),
		],
	},
	WINBACK_DAY21: {
		variants: [
			staticCopy("달력이 세 장쯤 지나갔어", "돌아오는 데 필요한 건 계획 하나뿐이야 🐾"),
			staticCopy("목록이 새 출발을 준비했어", "오늘 할 수 있는 만큼만 적어봐"),
			staticCopy("고양이는 아직 네 자리를 기억해", "작은 일 하나부터 다시 시작해도 좋아"),
		],
	},
	WINBACK_DAY30: {
		variants: [
			staticCopy("달력이 한 바퀴 돌아왔어 🗓️", "새로운 오늘은 할 일 하나면 충분해"),
			staticCopy("목록이 먼지를 톡 털었어", "지금 필요한 계획 하나만 놓아봐"),
			staticCopy("다시 만난 첫날로 정해볼까?", "고양이는 늘 한 발자국부터 시작해 🐾"),
		],
	},
	WEEKLY_ACHIEVEMENT: {
		variants: [
			({ completedCount }) =>
				copy(`이번 주 ${completedCount}개 완료 📊`, "작은 체크들이 제법 근사하게 모였어"),
			({ completedCount }) =>
				copy(`한 주 동안 ${completedCount}개를 해냈어`, "고양이가 숫자를 두 번 세어봤어"),
			({ completedCount }) =>
				copy(`완료 ${completedCount}개가 나란히`, "이번 주의 발자국이 선명해 🐾"),
		],
	},
	WEEKLY_ACHIEVEMENT_PERFECT: {
		variants: [
			staticCopy("이번 주 100% 완료 🏆", "빈 체크박스를 찾았지만 하나도 없었어"),
			staticCopy("한 주 계획을 전부 해냈어", "아주 반듯한 완료 기록이야"),
			staticCopy("퍼펙트 위크가 도착했어", "고양이도 잠깐 자세를 고쳐 앉았어 🐾"),
		],
	},
	WEEKLY_ACHIEVEMENT_ALMOST: {
		variants: [
			({ rate }) => copy(`이번 주 완료율 ${rate}% 📊`, "해낸 만큼 또렷하게 기록됐어"),
			({ rate }) => copy(`${rate}%의 계획을 마쳤어`, "거의 가득 찬 한 주였어"),
			({ rate }) => copy(`한 주 기록이 ${rate}%까지 찼어`, "고양이는 충분히 뿌듯한 표정이야 🐾"),
		],
	},
	WEEKLY_REPORT: {
		copy: staticCopy("주간 리포트가 도착했어 📊", "이번 주에 남긴 발자국을 살펴봐"),
	},
	MONTHLY_REPORT: {
		copy: staticCopy("월간 리포트가 도착했어 📈", "한 달 동안 쌓인 기록을 살펴봐"),
	},
	AI_SUGGESTION: {
		copy: staticCopy("반복되는 패턴을 찾았어 ✨", "자주 만드는 일을 더 간단히 준비해볼 수 있어"),
	},
	BILLING_ISSUE: {
		copy: staticCopy(
			"결제 수단을 확인해 주세요",
			"구독이 중단되지 않도록 결제 정보를 확인해 주세요.",
		),
	},
	ONBOARDING_DAY0: {
		copy: staticCopy("첫 할 일 자리가 준비됐어 🌱", "지금 떠오르는 작은 일 하나를 적어봐"),
	},
	ONBOARDING_DAY1: {
		copy: staticCopy("오늘의 체크박스도 준비 완료", "할 수 있는 만큼만 천천히 이어가자 🐾"),
	},
	ONBOARDING_DAY2: {
		copy: staticCopy("친구와 나눌 자리도 있어 🤝", "서로의 하루에 작은 응원을 보낼 수 있어"),
	},
	ONBOARDING_DAY3: {
		copy: staticCopy("알림 시계가 기다리는 중 ⏰", "원하는 시간에 맞춰 소식을 받을 수 있어"),
	},
	ONBOARDING_DAY5: {
		copy: ({ completedCount }) =>
			copy(`벌써 ${completedCount}개 완료했어`, "고양이가 숫자를 꼼꼼히 세어뒀어 🐾"),
	},
	ONBOARDING_DAY7: {
		copy: ({ completedCount }) =>
			copy("첫 주 기록이 완성됐어 🎉", `${completedCount}개의 완료가 차곡차곡 모였어`),
	},
	MILESTONE_FIRST_COMPLETE: {
		copy: staticCopy("첫 번째 완료가 반짝였어 ✨", "첫 발자국을 아주 잘 놓았어"),
	},
	MILESTONE_10: { copy: staticCopy("완료 10개가 모였어 🎉", "두 자릿수 발자국이 제법 든든해") },
	MILESTONE_50: { copy: staticCopy("완료 50개를 지나왔어 🐾", "차곡차곡 쌓인 기록이 꽤 묵직해") },
	MILESTONE_100: { copy: staticCopy("완료 100개 달성 👑", "고양이가 세다가 발가락이 모자랐어") },
	MILESTONE_STREAK_3: {
		copy: staticCopy("3일 연속 발자국 완성 🔥", "꾸준함이 작은 꼬리를 만들기 시작했어"),
	},
	MILESTONE_FIRST_FRIEND: {
		copy: staticCopy("첫 친구가 생겼어 🎉", "이제 서로의 하루에 응원을 보낼 수 있어"),
	},
} satisfies SystemNotificationCopyCatalog;

export const SKY_LABEL_MAP = { CLEAR: "맑음", PARTLY_CLOUDY: "구름 많음", CLOUDY: "흐림" };

export const WEATHER_FALLBACK = {
	MORNING: {
		copy: staticCopy("오늘 날씨도 같이 볼까? ☀️", "위치를 설정하면 아침 날씨를 알려줄게"),
	},
	EVENING: {
		copy: staticCopy("내일 날씨 자리가 비어 있어 🌙", "위치를 설정하면 내일 날씨를 미리 알려줄게"),
	},
} satisfies WeatherFallbackCopyCatalog;

export const RETENTION_TEMPLATES = {
	"D0:d0_no_todo": {
		variants: [
			staticCopy("첫 할 일 자리가 준비됐어 🌱", "지금 떠오르는 한 가지만 적어봐"),
			staticCopy("빈 목록이 꼬리를 흔드는 중", "작은 계획 하나면 시작하기 충분해 🐾"),
			staticCopy("오늘의 첫 계획을 놓아볼까?", "가장 쉬운 일 하나부터 적어봐"),
		],
	},
	"D1:d1_no_todo": {
		variants: [
			staticCopy("오늘 목록이 아주 넓어 📝", "하고 싶은 일 하나를 먼저 놓아봐"),
			staticCopy("계획 한 칸이 비어 있어", "가장 작은 할 일 하나면 충분해"),
			staticCopy("고양이가 빈 목록 옆에 앉았어", "떠오르는 일을 하나 적어줄래? 🐾"),
		],
	},
	"D1:d1_has_todo_no_completion": {
		variants: [
			staticCopy("첫 체크가 자리를 기다리는 중 ✅", "가장 만만한 할 일부터 골라봐"),
			staticCopy("적어둔 계획이 살짝 기지개", "5분짜리 일 하나로 시작해도 좋아"),
			staticCopy("목록은 준비를 마쳤어", "첫 발자국만 놓으면 나머지는 천천히 따라와 🐾"),
		],
	},
	"D3:d3_restart": {
		variants: [
			staticCopy("오늘을 새 첫날로 정해도 돼 🌱", "지금 필요한 일 하나만 적어봐"),
			staticCopy("계획표가 새 페이지를 펼쳤어", "할 수 있는 만큼만 가볍게 시작하자"),
			staticCopy("고양이가 다시 출발선에 앉았어", "가장 쉬운 한 걸음이면 충분해 🐾"),
		],
	},
	"D7:d7_has_progress": {
		variants: [
			staticCopy("첫 주의 발자국이 모였어 🎉", "이번 주에 만든 변화를 살펴봐"),
			staticCopy("일주일 기록이 한 장 완성됐어", "지금까지의 완료를 차근차근 확인해봐"),
			staticCopy("첫 주를 함께 걸었어", "네가 해낸 일들이 한눈에 보여 🐾"),
		],
	},
	"D7:d7_restart": {
		variants: [
			staticCopy("새로운 한 주 자리가 열렸어 🌱", "지금 필요한 할 일 하나만 적어봐"),
			staticCopy("목록이 월요일 같은 표정을 지었어", "오늘 할 수 있는 일 하나면 충분해"),
			staticCopy("다시 시작 버튼은 여전히 여기 있어", "부담 없는 작은 계획부터 만나자 🐾"),
		],
	},
} satisfies RetentionNotificationCopyCatalog;
