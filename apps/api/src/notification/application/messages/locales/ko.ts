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
} from "../notification-copy.types.js";

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

const REPLY_LABEL = { STARTING: "시작해볼게", THANKFUL: "응원 고마워", LATER: "조금 뒤에 할게" };

export const SCHEDULER_TEMPLATES = {
  TODO_REMINDER_60MIN: {
    variants: [
      ({ todoTitle }) => copy("한 시간 뒤에 만나요 ⏰", `‘${todoTitle}’ 준비를 시작해볼까?`),
      ({ todoTitle }) => copy("미리 챙겨두면 편해", `‘${todoTitle}’까지 한 시간 남았어`),
      ({ todoTitle }) => copy("다음 할 일을 알려줄게", `한 시간 뒤에는 ‘${todoTitle}’야`),
    ],
  },
  TODO_REMINDER_10MIN: {
    variants: [
      ({ todoTitle }) => copy("10분 뒤에 시작해요 ⏰", `곧 ‘${todoTitle}’ 할 시간이야`),
      ({ todoTitle }) => copy("잠깐, 다음 일정 확인", `‘${todoTitle}’까지 10분 남았어`),
      ({ todoTitle }) => copy("준비됐으면 천천히 가자", `10분 뒤 ‘${todoTitle}’를 시작해봐`),
    ],
  },
  TODO_REMINDER_IMMEDIATE: {
    variants: [
      ({ todoTitle }) => copy("할 시간이에요 🐾", `‘${todoTitle}’부터 시작해볼까?`),
      ({ todoTitle }) => copy("지금이 약속한 시간이야", `‘${todoTitle}’ 할 시간이 됐어`),
      ({ todoTitle }) => copy("첫걸음만 가볍게", `‘${todoTitle}’를 시작해보자`),
    ],
  },
  MORNING_REMINDER: {
    variants: [
      ({ count }) => copy(`오늘은 할 일 ${count}개 ☀️`, "가장 가벼운 일부터 하나 골라봐"),
      ({ count }) => copy(`좋은 아침, 계획 ${count}개`, "오늘 필요한 순서대로 해보자"),
      ({ count }) => copy(`오늘 할 일 ${count}개를 챙겼어`, "목록을 보고 첫걸음을 정해볼까?"),
      ({ count }) => copy(`${count}개의 계획, 천천히`, "고양이도 네 속도에 맞춰 갈게 🐾"),
      ({ count }) => copy("오늘의 시작을 함께할게", `할 일 ${count}개 중 하나면 좋은 출발이야`),
    ],
  },
  EVENING_COMPLETE: {
    variants: [
      staticCopy("오늘 할 일 모두 완료 🎉", "해낸 하루, 이제 편하게 쉬어"),
      staticCopy("오늘도 잘 해냈어", "목록을 다 채운 네게 박수를 보낼게"),
      staticCopy("체크를 모두 채웠어", "고양이와 함께 기분 좋게 마무리해 🐾"),
      staticCopy("계획한 일을 다 마쳤어", "오늘 쌓인 기록을 한번 돌아봐"),
      staticCopy("수고했어, 오늘의 너", "완료한 일들이 하루를 채웠어"),
    ],
  },
  EVENING_PARTIAL: {
    variants: [
      ({ remaining }) =>
        copy(`오늘 남은 할 일 ${remaining}개`, "시간이 괜찮다면 하나만 더 해볼까?"),
      ({ remaining }) => copy(`${remaining}개는 아직 진행 중`, "해낸 일도 함께 돌아봐"),
      ({ remaining }) => copy(`남은 계획은 ${remaining}개`, "작은 일부터 마무리해도 좋아 🐾"),
      ({ remaining }) => copy(`오늘 목록, ${remaining}개 남았어`, "할 수 있는 만큼만 해도 괜찮아"),
    ],
  },
  EVENING_NONE: {
    variants: [
      staticCopy("오늘은 아직 시작 전이야 🌙", "여유가 있다면 작은 일 하나부터 해봐"),
      staticCopy("지금 시작해도 괜찮아", "가장 쉬운 일을 하나 골라볼까?"),
      staticCopy("가볍게 하나만 해볼까?", "오늘 할 일 목록을 살펴봐"),
      staticCopy("오늘도 네 속도로 가자", "쉬어야 하는 날엔 쉬어도 괜찮아"),
    ],
  },
  MORNING_NO_TODO: {
    variants: [
      staticCopy("오늘 계획을 하나 적어볼까? ☀️", "생각나는 작은 일부터 시작해봐"),
      staticCopy("기억할 일을 남겨두자", "하고 싶은 일을 하나 적어봐"),
      staticCopy("오늘의 첫 할 일은 뭐야?", "고양이와 함께 하나씩 정해보자 🐾"),
    ],
  },
  EVENING_STREAK: {
    variants: [
      ({ streak, next }) => copy(`${streak}일 연속 모두 완료 🔥`, `내일도 이어가면 ${next}일째야`),
      ({ streak, next }) =>
        copy(`${streak}일 동안 꾸준히 해냈어`, `다음 발자국은 ${next}일째에 남겨보자`),
      ({ streak }) => copy(`${streak}일의 기록이 쌓였어`, "오늘도 네가 해낸 만큼 남겼어 🐾"),
    ],
  },
  EVENING_STREAK_7: {
    copy: staticCopy("일주일 연속 모두 완료 🎉", "7일 동안 차근차근 이어왔어"),
  },
  EVENING_STREAK_14: {
    copy: staticCopy("2주 연속 모두 완료 🏆", "14일의 꾸준함이 기록으로 남았어"),
  },
  EVENING_STREAK_30: {
    copy: ({ streak }) => copy(`${streak}일 연속 기록 달성 🐾`, "한 달의 발자국을 함께 돌아봐"),
  },
  EVENING_STREAK_RISK_PARTIAL: {
    variants: [
      ({ streak, remaining }) =>
        copy(`${streak}일 기록, ${remaining}개 남았어`, "오늘도 이어가고 싶다면 하나씩 해보자"),
      ({ remaining, streak }) =>
        copy(`${remaining}개를 마치면 기록이 이어져`, `${streak}일 동안 해낸 힘으로 천천히 🔥`),
      ({ remaining }) => copy(`오늘 남은 할 일 ${remaining}개`, "시간이 맞는 작은 일부터 골라봐"),
    ],
  },
  EVENING_STREAK_RISK_NONE: {
    variants: [
      ({ streak }) => copy(`${streak}일 기록을 이어갈까?`, "할 일 하나를 마치면 오늘도 이어져"),
      ({ streak }) => copy("오늘 한 걸음이면 충분해", `${streak}일의 기록에 발자국을 더해봐 🐾`),
      ({ streak }) => copy(`${streak}일 동안 잘 해왔어`, "가능한 작은 일부터 시작해봐"),
    ],
  },
  LUNCH_NUDGE: {
    variants: [
      staticCopy("점심 뒤, 가볍게 시작해볼까?", "5분이면 되는 일을 하나 골라봐"),
      staticCopy("오후 첫 체크를 해보자", "할 일 목록에서 쉬운 것부터 만나봐"),
      staticCopy("잠깐 목록을 살펴볼까? 🐾", "지금 할 수 있는 일 하나면 충분해"),
      staticCopy("오늘의 첫걸음은 작게", "하나를 마치고 흐름을 이어가봐"),
    ],
  },
  STREAK_AT_RISK: {
    variants: [
      ({ streak }) =>
        copy(`${streak}일 기록을 이어갈 시간 🔥`, "작은 일 하나를 마치면 오늘도 이어져"),
      ({ streak }) => copy("오늘도 발자국을 남겨볼까?", `${streak}일 동안 이어온 기록을 확인해봐`),
      ({ streak }) => copy(`${streak}일의 꾸준함이 쌓였어`, "오늘 할 수 있는 일부터 하나 골라봐"),
    ],
  },
} satisfies SchedulerNotificationCopyCatalog;

export const WEATHER_TEMPLATES = {
  MORNING_CLEAR: {
    variants: [
      ({ skyLabel, tempMin, tempMax }) =>
        copy(
          `오늘 ${skyLabel}, ${tempMin}~${tempMax}°C ☀️`,
          "외출 계획이 있다면 날씨부터 확인해봐",
        ),
      ({ tempMin, tempMax, skyLabel }) =>
        copy(`오늘 기온은 ${tempMin}~${tempMax}°C`, `하늘은 ${skyLabel}. 옷차림을 챙겨봐`),
    ],
  },
  MORNING_RAIN: {
    variants: [
      ({ precipProb, tempMin, tempMax }) =>
        copy(`오늘 비 확률 ${precipProb}% ☔`, `${tempMin}~${tempMax}°C, 우산을 챙겨봐`),
      ({ precipProb, tempMin, tempMax }) =>
        copy("비 예보가 있는 아침이야", `비 확률 ${precipProb}%, ${tempMin}~${tempMax}°C`),
    ],
  },
  MORNING_SNOW: {
    variants: [
      ({ precipProb, tempMin, tempMax }) =>
        copy(`오늘 눈 확률 ${precipProb}% ❄️`, `${tempMin}~${tempMax}°C, 따뜻하게 입어봐`),
      ({ precipProb, tempMin, tempMax }) =>
        copy("눈 예보가 있는 아침이야", `눈 확률 ${precipProb}%, ${tempMin}~${tempMax}°C`),
    ],
  },
  EVENING_CLEAR: {
    variants: [
      ({ skyLabel, tempMin, tempMax }) =>
        copy(`내일 ${skyLabel}, ${tempMin}~${tempMax}°C 🌙`, "내일 계획에 맞춰 옷차림을 준비해봐"),
      ({ tempMin, tempMax, skyLabel }) =>
        copy(`내일 기온은 ${tempMin}~${tempMax}°C`, `하늘은 ${skyLabel}. 외출 전에 참고해봐`),
    ],
  },
  EVENING_RAIN: {
    variants: [
      ({ precipProb, tempMin, tempMax }) =>
        copy(`내일 비 확률 ${precipProb}% ☔`, `${tempMin}~${tempMax}°C, 우산을 미리 챙겨놔`),
      ({ precipProb, tempMin, tempMax }) =>
        copy("내일은 비 예보가 있어", `비 확률 ${precipProb}%, ${tempMin}~${tempMax}°C`),
    ],
  },
  EVENING_SNOW: {
    variants: [
      ({ precipProb, tempMin, tempMax }) =>
        copy(`내일 눈 확률 ${precipProb}% ❄️`, `${tempMin}~${tempMax}°C, 이동 시간을 여유 있게`),
      ({ precipProb, tempMin, tempMax }) =>
        copy("내일은 눈 예보가 있어", `눈 확률 ${precipProb}%, ${tempMin}~${tempMax}°C`),
    ],
  },
} satisfies WeatherNotificationCopyCatalog;

export const SOCIAL_TEMPLATES = {
  NUDGE_REPLIED: {
    copy: ({ senderName, todoTitle, replyKind }) =>
      copy(
        `${attachJosa(senderName, "이/가")} 콕에 답했어`,
        `‘${todoTitle}’ · “${REPLY_LABEL[replyKind]}”`,
      ),
  },
  NUDGE_THANKED: {
    copy: ({ senderName, todoTitle }) =>
      copy(
        `${attachJosa(senderName, "이/가")} 고마움을 전했어 🐾`,
        `‘${todoTitle}’를 마치고 네 응원에 고마움을 전했어`,
      ),
  },
  FOLLOW_NEW: {
    variants: [
      ({ senderName }) =>
        copy(`${senderName}의 친구 신청이 왔어`, "수락하면 서로의 하루를 응원할 수 있어"),
      ({ senderName }) =>
        copy(
          `${attachJosa(senderName, "이/가")} 친구가 되고 싶대`,
          "함께 할 일을 나누며 응원해볼까? 🐾",
        ),
      ({ senderName }) => copy("새 친구 신청을 확인해봐", `${senderName}의 하루와 연결해볼까?`),
    ],
  },
  FOLLOW_ACCEPTED: {
    variants: [
      ({ senderName }) =>
        copy(
          `${attachJosa(senderName, "이/가")} 친구 신청을 수락했어`,
          "이제 서로의 할 일을 응원할 수 있어",
        ),
      ({ senderName }) =>
        copy(`${senderName}와 친구가 됐어 🎉`, "서로의 하루에 작은 힘이 되어보자"),
      ({ senderName }) => copy("친구가 한 명 더 생겼어", `${senderName}에게 가볍게 인사해봐 🐾`),
    ],
  },
  NUDGE_RECEIVED: {
    variants: [
      ({ senderName, todoTitle }) =>
        copy(
          `${attachJosa(senderName, "이/가")} 콕을 보냈어 🐾`,
          todoTitle ? `‘${todoTitle}’에 응원을 남겼어` : "오늘 할 일을 응원하고 있어",
        ),
      ({ senderName, todoTitle }) =>
        copy(
          `${senderName}의 응원이 도착했어`,
          todoTitle ? `‘${todoTitle}’, 같이 시작해볼까?` : "지금 할 수 있는 일부터 하나 골라봐",
        ),
      ({ todoTitle, senderName }) =>
        copy(
          "친구가 콕으로 응원을 보냈어",
          todoTitle
            ? `${senderName}의 콕이 ‘${todoTitle}’에 왔어`
            : `${attachJosa(senderName, "이/가")} 하루를 응원하고 있어`,
        ),
    ],
  },
  NUDGE_RECEIVED_WITH_MESSAGE: {
    copy: ({ senderName, todoTitle, message }) =>
      copy(
        `${senderName}의 응원과 한마디가 도착했어`,
        todoTitle ? `‘${todoTitle}’ · ${message}` : message,
      ),
  },
  REMIND_NUDGE_RECEIVED: {
    variants: [
      ({ senderName }) =>
        copy(
          `${attachJosa(senderName, "이/가")} 오늘의 시작을 응원해`,
          "할 일을 하나 적어보는 건 어때? 🐾",
        ),
      ({ senderName }) => copy(`${senderName}의 콕이 도착했어`, "생각나는 작은 일부터 하나 적어봐"),
      ({ senderName }) =>
        copy(
          "친구가 오늘의 시작을 응원해",
          `${attachJosa(senderName, "이/가")} 콕으로 안부를 전했어`,
        ),
    ],
  },
  REMIND_NUDGE_RECEIVED_WITH_MESSAGE: {
    copy: ({ senderName, message }) => copy(`${senderName}의 응원과 한마디가 도착했어`, message),
  },
  CHEER_RECEIVED: {
    copy: ({ senderName, message }) => copy(`${senderName}의 응원이 왔어`, message),
  },
  CHEER_RECEIVED_NO_MESSAGE: {
    variants: [
      ({ senderName }) =>
        copy(`${attachJosa(senderName, "이/가")} 응원을 보냈어 🐾`, "오늘도 네 속도로 해보자"),
      ({ senderName }) => copy(`${senderName}의 작은 응원이야`, "함께 해내는 하루가 되길 바란대"),
      ({ senderName }) =>
        copy("친구의 응원을 받아봐", `${attachJosa(senderName, "이/가")} 오늘의 너를 응원해`),
    ],
  },
  FRIEND_COMPLETED: {
    variants: [
      ({ friendName }) => copy(`${friendName}의 하루가 반짝였어 ✨`, "오늘 할 일을 모두 마쳤대"),
      ({ friendName }) => copy(`${friendName}의 오늘도 모두 완료`, "친구에게 응원 한마디를 건네봐"),
      ({ friendName }) =>
        copy("친구의 완료 소식이 왔어", `${friendName}에게 잘했다고 말해볼까? 🐾`),
    ],
  },
  SOCIAL_DIGEST_MULTI: {
    variants: [
      ({ completedFriendCount }) =>
        copy(`친구 ${completedFriendCount}명이 모두 완료 ✨`, "각자의 하루에 응원을 보내봐"),
      ({ completedFriendCount }) =>
        copy(`친구 ${completedFriendCount}명의 완료 소식`, "한 명씩 안부를 나눠볼까?"),
      ({ completedFriendCount }) =>
        copy(`${completedFriendCount}명이 오늘 계획을 마쳤어`, "친구들의 발자국을 함께 돌아봐 🐾"),
    ],
  },
  SOCIAL_DIGEST_SINGLE: {
    variants: [
      ({ friendName }) =>
        copy(`${friendName}의 오늘도 모두 완료 ✨`, "친구의 하루에 응원을 보내봐"),
      ({ friendName }) => copy(`${friendName}의 완료 소식이 왔어`, "잘했다고 한마디 건네볼까?"),
      ({ friendName }) => copy("친구가 오늘 계획을 마쳤어", `${friendName}의 하루를 응원해줘 🐾`),
    ],
  },
  NUDGE_SUGGEST: {
    variants: [
      ({ friendName }) =>
        copy(`${friendName}에게 안부를 전할까?`, "가벼운 콕 하나로 하루를 응원해봐 🐾"),
      ({ friendName }) =>
        copy("친구에게 작은 응원을 보내봐", `${friendName}에게 콕으로 인사해볼까?`),
      ({ friendName }) => copy("오늘은 친구와 같이 해볼까?", `${friendName}의 할 일을 살펴봐`),
    ],
  },
  TODO_COMMENT: {
    variants: [
      ({ senderName }) =>
        copy(`${attachJosa(senderName, "이/가")} 댓글을 남겼어`, "할 일에 새 댓글이 도착했어"),
      ({ senderName }) =>
        copy(`${senderName}의 새 댓글이야`, "앱에서 이어지는 이야기를 확인해봐 🐾"),
      ({ senderName }) => copy("할 일에 새 이야기가 생겼어", `${senderName}의 댓글을 확인해봐`),
    ],
  },
  TODO_COMMENT_CHAIN: {
    variants: [
      ({ senderName, count }) =>
        copy(
          `${attachJosa(senderName, "이/가")} 댓글 ${count}개를 남겼어`,
          "앱에서 새 댓글들을 확인해봐",
        ),
      ({ senderName, count }) =>
        copy(`${senderName}의 댓글 ${count}개가 왔어`, "할 일의 이야기가 이어지고 있어 🐾"),
      ({ count, senderName }) =>
        copy(`새 댓글 ${count}개를 확인해봐`, `${senderName}의 이야기가 도착했어`),
    ],
  },
  TODO_COMMENT_REPLY: {
    variants: [
      ({ senderName }) =>
        copy(`${attachJosa(senderName, "이/가")} 답글을 남겼어`, "네 댓글에 새 답글이 도착했어"),
      ({ senderName }) => copy(`${senderName}의 답글이 왔어`, "앱에서 대화를 이어가볼까? 🐾"),
      ({ senderName }) => copy("댓글에 새 답글이 생겼어", `${senderName}의 답글을 확인해봐`),
    ],
  },
  TODO_COMMENT_REPLY_CHAIN: {
    variants: [
      ({ senderName, count }) =>
        copy(
          `${attachJosa(senderName, "이/가")} 답글 ${count}개를 남겼어`,
          "앱에서 이어진 대화를 확인해봐",
        ),
      ({ senderName, count }) =>
        copy(`${senderName}의 답글 ${count}개가 왔어`, "새 답글들을 한 번에 읽어봐 🐾"),
      ({ count, senderName }) =>
        copy(`새 답글 ${count}개를 확인해봐`, `${senderName}의 대화가 이어지고 있어`),
    ],
  },
  TODO_COMMENT_LIKE: {
    variants: [
      ({ senderName }) =>
        copy(`${attachJosa(senderName, "이/가")} 네 댓글을 좋아해`, "댓글에 마음을 남겼어 ❤️"),
      ({ senderName }) => copy(`${senderName}의 댓글 공감이 왔어`, "네 이야기에 응원을 보냈어"),
      ({ senderName }) =>
        copy("네 댓글에 공감이 더해졌어", `${attachJosa(senderName, "이/가")} 하트를 보냈어`),
    ],
  },
} satisfies SocialNotificationCopyCatalog;

export const SYSTEM_TEMPLATES = {
  WINBACK_DAY3: {
    variants: [
      staticCopy("오늘 계획부터 다시 만나볼까?", "지금 필요한 작은 일 하나를 적어봐"),
      staticCopy("잠깐 쉬어도 기록은 남아 있어", "할 수 있는 일부터 가볍게 시작해봐"),
      staticCopy("고양이와 한 걸음만 해볼까? 🐾", "오늘의 첫 할 일을 정해보자"),
    ],
  },
  WINBACK_DAY7: {
    variants: [
      staticCopy("새로운 한 주를 시작해볼까?", "이번 주에 필요한 일을 하나 적어봐"),
      staticCopy("오늘부터 천천히 다시 해보자", "작은 계획 하나로 돌아와도 괜찮아"),
      staticCopy("네 계획은 언제든 여기 있어 🐾", "지금 마음에 있는 일을 남겨봐"),
    ],
  },
  WINBACK_DAY14: {
    variants: [
      staticCopy("지금의 계획을 새로 적어볼까?", "오늘 필요한 일부터 다시 시작해봐"),
      staticCopy("다시 시작하는 날도 소중해", "작은 할 일 하나면 좋은 출발이야"),
      staticCopy("고양이와 오늘을 계획해봐 🐾", "지난 계획보다 지금 할 수 있는 일부터"),
    ],
  },
  WINBACK_DAY21: {
    variants: [
      staticCopy("오늘, 가볍게 돌아와도 좋아", "지금 할 수 있는 일을 하나 적어봐"),
      staticCopy("새 계획을 위한 자리가 있어", "오늘의 너에게 필요한 일부터 시작해"),
      staticCopy("다시 만날 준비가 됐어 🐾", "고양이와 작은 계획 하나를 정해봐"),
    ],
  },
  WINBACK_DAY30: {
    variants: [
      staticCopy("오늘부터 다시 계획해볼까?", "한 달 전보다 지금 필요한 일부터"),
      staticCopy("익숙한 자리에서 새로 시작해", "작은 일 하나를 적고 천천히 해보자"),
      staticCopy("고양이와 새 발자국을 남겨봐 🐾", "오늘 할 수 있는 만큼만 계획해도 좋아"),
    ],
  },
  WEEKLY_ACHIEVEMENT: {
    variants: [
      ({ completedCount }) =>
        copy(`이번 주 ${completedCount}개를 해냈어 🐾`, "차곡차곡 쌓인 완료를 돌아봐"),
      ({ completedCount }) =>
        copy(`일주일 동안 ${completedCount}개 완료`, "한 주의 기록을 한눈에 확인해봐"),
      ({ completedCount }) =>
        copy(`완료 ${completedCount}개, 잘 해왔어`, "이번 주의 작은 성취를 챙겨봐"),
    ],
  },
  WEEKLY_ACHIEVEMENT_PERFECT: {
    variants: [
      staticCopy("이번 주 100% 완료 🏆", "계획한 일을 모두 해냈어, 수고했어"),
      staticCopy("한 주 계획을 모두 마쳤어", "이번 주의 꾸준한 기록을 돌아봐"),
      staticCopy("이번 주도 모두 완료했어", "고양이와 함께 해낸 한 주를 기억해 🐾"),
    ],
  },
  WEEKLY_ACHIEVEMENT_ALMOST: {
    variants: [
      ({ rate }) => copy(`이번 주 완료율 ${rate}%`, "해낸 일들을 차근차근 돌아봐"),
      ({ rate }) => copy(`${rate}%만큼 계획을 해냈어`, "이번 주에 쌓은 발자국이야 🐾"),
      ({ rate }) => copy(`한 주의 기록, ${rate}% 완료`, "잘 해낸 일부터 함께 확인해봐"),
    ],
  },
  WEEKLY_REPORT: {
    copy: staticCopy("이번 주 리포트가 준비됐어 📊", "완료 기록과 네 흐름을 함께 살펴봐"),
  },
  MONTHLY_REPORT: {
    copy: staticCopy("한 달의 기록이 모였어 📈", "이번 달의 변화와 꾸준함을 돌아봐"),
  },
  AI_SUGGESTION: {
    copy: staticCopy("자주 하는 일을 발견했어 ✨", "반복 할 일로 더 쉽게 챙겨볼까?"),
  },
  BILLING_ISSUE: {
    copy: staticCopy("결제 정보 확인이 필요해요", "구독을 이어가려면 결제 수단을 확인해 주세요."),
  },
  ONBOARDING_DAY0: {
    copy: staticCopy("첫 할 일을 함께 적어볼까? 🌱", "지금 떠오르는 작은 일 하나면 충분해"),
  },
  ONBOARDING_DAY1: {
    copy: staticCopy("오늘도 작은 계획 하나부터", "하고 싶은 일을 적고 하나씩 해보자 🐾"),
  },
  ONBOARDING_DAY2: {
    copy: staticCopy("친구와 하루를 나눠볼까?", "함께 할 일을 보고 응원할 수 있어"),
  },
  ONBOARDING_DAY3: {
    copy: staticCopy("필요한 시간에 알려줄게 ⏰", "내 일정에 맞는 알림 시간을 정해봐"),
  },
  ONBOARDING_DAY5: {
    copy: ({ completedCount }) =>
      copy(`지금까지 ${completedCount}개를 해냈어`, "작은 완료들이 차곡차곡 쌓이고 있어 🐾"),
  },
  ONBOARDING_DAY7: {
    copy: ({ completedCount }) =>
      copy("첫 일주일의 기록이 모였어 🎉", `완료한 일 ${completedCount}개를 함께 돌아봐`),
  },
  MILESTONE_FIRST_COMPLETE: {
    copy: staticCopy("첫 할 일 완료, 잘 해냈어 ✨", "시작을 끝낸 첫 발자국이 남았어"),
  },
  MILESTONE_10: {
    copy: staticCopy("완료 10개, 작은 성취가 모였어", "하나씩 해낸 기록을 돌아봐 🐾"),
  },
  MILESTONE_50: {
    copy: staticCopy("어느새 완료한 일 50개 🎉", "꾸준히 쌓은 기록을 기억해봐"),
  },
  MILESTONE_100: {
    copy: staticCopy("완료 100개를 함께 축하해 🏆", "하나씩 해내며 여기까지 왔어"),
  },
  MILESTONE_STREAK_3: {
    copy: staticCopy("3일 연속, 좋은 흐름이야 🔥", "오늘도 작은 일을 하나 해냈어"),
  },
  MILESTONE_FIRST_FRIEND: {
    copy: staticCopy("첫 친구와 연결됐어 🐾", "이제 서로의 하루에 응원을 보내봐"),
  },
} satisfies SystemNotificationCopyCatalog;

export const SKY_LABEL_MAP = { CLEAR: "맑음", PARTLY_CLOUDY: "구름 많음", CLOUDY: "흐림" };

export const WEATHER_FALLBACK = {
  MORNING: {
    copy: staticCopy("오늘 날씨를 함께 챙겨볼까? ☀️", "한국 지역을 설정하면 날씨를 알려줄게"),
  },
  EVENING: {
    copy: staticCopy("내일의 날씨도 미리 챙겨봐 🌙", "한국 지역을 설정해 내일 예보를 확인해"),
  },
} satisfies WeatherFallbackCopyCatalog;

export const RETENTION_TEMPLATES = {
  "D0:d0_no_todo": {
    variants: [
      staticCopy("처음엔 작은 할 일 하나면 돼 🌱", "지금 떠오르는 일을 적어보자"),
      staticCopy("고양이와 첫 계획을 정해볼까?", "기억해둘 일을 하나 적어봐 🐾"),
      staticCopy("첫 할 일을 만들어보자", "오늘 할 수 있는 작은 일이면 충분해"),
    ],
  },
  "D1:d1_no_todo": {
    variants: [
      staticCopy("오늘의 작은 계획은 뭐야?", "하고 싶은 일을 하나 적어봐"),
      staticCopy("아직 정하지 않아도 괜찮아", "생각나는 일부터 하나 남겨봐 🐾"),
      staticCopy("기억할 일을 함께 챙겨보자", "작은 계획부터 천천히 시작해봐"),
    ],
  },
  "D1:d1_has_todo_no_completion": {
    variants: [
      staticCopy("첫 완료를 함께 해볼까? ✅", "가장 쉬운 할 일을 하나 골라봐"),
      staticCopy("적어둔 일부터 가볍게 시작해", "5분이면 되는 일도 좋은 첫걸음이야"),
      staticCopy("고양이와 첫 체크를 남겨봐 🐾", "할 수 있는 일 하나부터 해보자"),
    ],
  },
  "D3:d3_restart": {
    variants: [
      staticCopy("다시 시작하는 오늘이야 🌱", "지금 필요한 일 하나를 적어봐"),
      staticCopy("오늘의 계획만 가볍게 정해봐", "작은 일 하나부터 다시 해도 괜찮아"),
      staticCopy("고양이와 다시 한 걸음 🐾", "할 수 있는 만큼만 시작해보자"),
    ],
  },
  "D7:d7_has_progress": {
    variants: [
      staticCopy("첫 주의 기록을 돌아볼까? 🎉", "일주일 동안 해낸 일들이 모였어"),
      staticCopy("작은 완료가 한 주를 채웠어", "지금까지 쌓인 발자국을 확인해봐 🐾"),
      staticCopy("일주일의 네 흐름을 살펴봐", "해낸 일을 보며 다음 계획을 정해보자"),
    ],
  },
  "D7:d7_restart": {
    variants: [
      staticCopy("새로운 한 주, 작은 계획부터", "지금 할 수 있는 일을 하나 적어봐"),
      staticCopy("오늘부터 다시 해도 괜찮아", "필요한 일 하나면 다시 시작할 수 있어"),
      staticCopy("고양이와 한 주를 열어볼까? 🐾", "부담 없는 첫 할 일을 정해봐"),
    ],
  },
} satisfies RetentionNotificationCopyCatalog;
