import type { SubscriptionPlanType, WeatherCondition } from "@aido/api/vocabulary";
import { josa } from "es-hangul";
import { match } from "ts-pattern";

import type { WeatherDayPart } from "../../../../domain/services/reminders/weather-briefing.policy.js";
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

/** 앱 화면처럼 이름에 `님`을 붙이고, 이름을 모를 때의 `친구`에는 붙이지 않는다. */
function honorific(name: string): string {
  return name === SOCIAL_SENDER_FALLBACK ? name : `${name}님`;
}

function named(name: string, particle: JosaParticle): string {
  return attachJosa(honorific(name), particle);
}

const REPLY_LABEL = { STARTING: "시작해볼게", THANKFUL: "응원 고마워", LATER: "조금 뒤에 할게" };

export const SCHEDULER_TEMPLATES = {
  TODO_REMINDER_60MIN: {
    variants: [
      ({ todoTitle }) => copy("1시간 뒤에 할 일이 있어요 ⏰", `‘${todoTitle}’ 미리 챙겨둘까요?`),
      ({ todoTitle }) => copy("한 시간 남았어요", `‘${todoTitle}’ 준비할 시간은 충분해요`),
      ({ todoTitle }) => copy("다음 할 일을 미리 알려드려요", `1시간 뒤 ‘${todoTitle}’ 시작이에요`),
    ],
  },
  TODO_REMINDER_10MIN: {
    variants: [
      ({ todoTitle }) => copy("10분 뒤 시작이에요 ⏰", `‘${todoTitle}’ 준비됐나요?`),
      ({ todoTitle }) => copy("곧 시작할 시간이에요", `‘${todoTitle}’까지 10분 남았어요`),
      ({ todoTitle }) => copy("슬슬 준비해볼까요?", `10분 뒤 ‘${todoTitle}’ 시작이에요`),
    ],
  },
  TODO_SERIES_PAUSED: {
    variants: [staticCopy("반복 할 일 알림을 잠시 멈췄어요", "앱을 열면 다시 시작돼요")],
  },
  MORNING_REMINDER: {
    variants: [
      ({ count }) => copy(`오늘 할 일 ${count}개 ☀️`, "제일 쉬운 것부터 하나 끝내봐요"),
      ({ count }) => copy(`좋은 아침이에요, 할 일 ${count}개`, "첫 체크를 하면 하루가 가벼워져요"),
      ({ count }) => copy(`오늘 할 일 ${count}개 준비됐어요`, "순서만 정해도 반은 끝난 거예요"),
      ({ count }) => copy(`할 일 ${count}개, 천천히 가요`, "아이두도 옆에서 같이 걸을게요 🐾"),
      ({ count }) =>
        copy("오늘도 같이 시작해요", `할 일 ${count}개 중 하나만 끝내도 좋은 출발이에요`),
    ],
  },
  EVENING_COMPLETE: {
    variants: [
      staticCopy("오늘 할 일 전부 끝! 🎉", "이제 마음 편히 쉬어도 돼요"),
      staticCopy("오늘도 해냈어요", "체크 표시가 빈틈없이 꽉 찼어요"),
      staticCopy("완벽한 하루였어요", "아이두가 골골송 불러드려요 🐾"),
      staticCopy("계획한 일, 다 마쳤어요", "오늘 해낸 기록을 한번 구경해봐요"),
      staticCopy("오늘 하루 수고 많았어요", "끝낸 일들이 오늘을 꽉 채웠어요"),
    ],
  },
  EVENING_PARTIAL: {
    variants: [
      ({ remaining }) =>
        copy(`오늘 할 일 ${remaining}개 남았어요`, "여유 있으면 하나만 더 해볼까요?"),
      ({ remaining }) =>
        copy(`아직 체크 전인 일 ${remaining}개`, "할 일 목록에서 다음 걸 골라봐요"),
      ({ remaining }) => copy(`남은 할 일은 ${remaining}개`, "가벼운 것부터 마무리해봐요 🐾"),
      ({ remaining }) =>
        copy(`할 일 목록에 ${remaining}개 남았어요`, "할 수 있는 만큼만 해도 충분해요"),
    ],
  },
  EVENING_NONE: {
    variants: [
      staticCopy("오늘 할 일 목록 볼까요? 🌙", "자기 전에 하나만 끝내도 충분해요"),
      staticCopy("오늘 계획, 다시 살펴볼까요?", "내일로 미룰 일은 미뤄도 괜찮아요"),
      staticCopy("가볍게 하나만 해볼까요?", "5분이면 끝나는 일부터 골라봐요"),
      staticCopy("오늘은 쉬어가도 괜찮아요", "내일 할 일만 살짝 정리해둬요"),
    ],
  },
  MORNING_NO_TODO: {
    variants: [
      staticCopy("오늘 할 일 하나 적어볼까요? ☀️", "작은 일 하나면 하루가 정리돼요"),
      staticCopy("오늘 할 일 목록이 비어 있어요", "떠오르는 일 하나만 적어봐요"),
      staticCopy("오늘 첫 할 일은 뭐예요?", "아이두랑 하나씩 정해봐요 🐾"),
    ],
  },
  EVENING_STREAK: {
    variants: [
      ({ streak, next }) =>
        copy(`${streak}일 연속 전부 완료 🔥`, `내일도 이어가면 ${next}일째예요`),
      ({ streak, next }) => copy(`${streak}일째 꾸준히 해냈어요`, `내일 ${next}일째도 같이 가봐요`),
      ({ streak }) => copy(`연속 기록 ${streak}일 달성`, "오늘도 끝까지 해낸 거 다 봤어요 🐾"),
    ],
  },
  EVENING_STREAK_7: {
    copy: staticCopy("일주일 연속 전부 완료 🎉", "7일 내내 해낸 거, 진짜 대단해요"),
  },
  EVENING_STREAK_14: {
    copy: staticCopy("2주 연속 전부 완료 🏆", "14일의 꾸준함, 이제 습관이 됐어요"),
  },
  EVENING_STREAK_30: {
    copy: ({ streak }) => copy(`${streak}일 연속 완료 🐾`, "이쯤 되면 꾸준함이 특기예요"),
  },
  EVENING_STREAK_RISK_PARTIAL: {
    variants: [
      ({ streak, remaining }) =>
        copy(`연속 ${streak}일, ${remaining}개 남았어요`, "남은 일을 끝내면 기록이 이어져요"),
      ({ remaining, streak }) =>
        copy(`${remaining}개 끝내면 연속 기록 유지`, `${streak}일 쌓아온 기록, 천천히 이어가요 🔥`),
      ({ remaining }) => copy(`오늘 남은 할 일 ${remaining}개`, "가벼운 것부터 하나씩 끝내봐요"),
    ],
  },
  EVENING_STREAK_RISK_NONE: {
    variants: [
      ({ streak }) =>
        copy(`연속 ${streak}일, 오늘도 이어갈까요?`, "할 일 목록에서 남은 일을 확인해봐요"),
      ({ streak }) => copy(`${streak}일 연속 기록이 기다려요 🐾`, "남은 일을 모두 끝내면 이어져요"),
      ({ streak }) =>
        copy(`${streak}일 동안 잘 해왔어요`, "오늘 할 일을 다 끝내면 기록이 이어져요"),
    ],
  },
  LUNCH_NUDGE: {
    variants: [
      staticCopy("점심 먹고 하나 해볼까요?", "할 일 목록에서 지금 할 수 있는 걸 골라봐요"),
      staticCopy("오후 첫 체크, 뭐로 할까요?", "제일 쉬운 할 일 하나면 충분해요"),
      staticCopy("잠깐 할 일 목록 볼까요? 🐾", "하나 끝내면 오후가 가벼워져요"),
      staticCopy("오늘 첫 체크는 작게", "하나 끝내면 흐름이 붙어요"),
    ],
  },
  STREAK_AT_RISK: {
    variants: [
      ({ streak }) =>
        copy(`연속 ${streak}일, 오늘도 이어가요 🔥`, "할 일 목록에서 남은 일을 확인해봐요"),
      ({ streak }) =>
        copy("오늘 남은 일, 같이 끝내볼까요?", `다 끝내면 ${streak}일 연속 기록이 이어져요`),
      ({ streak }) => copy(`${streak}일 쌓은 기록이 있어요`, "자기 전에 남은 일을 정리해봐요"),
    ],
  },
} satisfies SchedulerNotificationCopyCatalog;

export const WEATHER_TEMPLATES = {
  MORNING_TODO_RAIN: {
    copy: ({ time, todoTitle, precipChance, otherCount }) =>
      copy(
        `${time} ‘${todoTitle}’ 때 비 소식이 있어요 ☔`,
        otherCount > 0
          ? `할 일 ${otherCount}개도 비와 겹쳐요 · 시간 옮기기`
          : `강수 확률 ${precipChance}% · 시간 옮기기`,
      ),
  },
  MORNING_TODO_STORM: {
    copy: ({ time, todoTitle }) =>
      copy(`${time} ‘${todoTitle}’ 때 낙뢰가 칠 수 있어요 ⚡`, "실내에서 하거나 시간을 옮겨보세요"),
  },
  MORNING_TODO_SNOW: {
    copy: ({ time, todoTitle }) =>
      copy(`${time} ‘${todoTitle}’ 때 눈 소식이 있어요 ❄️`, "눈길이라 20분 일찍 나가는 게 좋아요"),
  },
  MORNING_TODO_HEAT: {
    copy: ({ time, todoTitle, apparentTemp }) =>
      copy(
        `${time} ‘${todoTitle}’ 때 체감 ${apparentTemp}°C예요 ☀️`,
        "더 선선한 시간으로 옮겨보세요",
      ),
  },
  MORNING_RAIN_LATER: {
    copy: ({ time }) => copy(`오늘 ${time}부터 비 소식이 있어요 ☔`, "나갈 땐 우산을 챙겨주세요"),
  },
  MORNING_SNOW_LATER: {
    copy: ({ time }) =>
      copy(`오늘 ${time}부터 눈 소식이 있어요 ❄️`, "길이 미끄러울 수 있어요. 따뜻하게 입어요"),
  },
  MORNING_SUMMARY: {
    copy: ({ conditionLabel, tempMin, tempMax, precipChance }) =>
      copy(
        `오늘은 ${conditionLabel}, ${tempMin}~${tempMax}°C예요`,
        `강수 확률 ${precipChance}%예요. 좋은 하루 보내요`,
      ),
  },
  EVENING_RAIN: {
    copy: ({ dayPartLabel, chillyTemp }) =>
      copy(
        dayPartLabel == null
          ? "내일 비 소식이 있어요 ☔"
          : `내일 ${dayPartLabel}부터 비 소식이 있어요 ☔`,
        chillyTemp == null
          ? "우산을 미리 챙겨두세요"
          : `아침엔 ${chillyTemp}°C로 쌀쌀해요. 우산과 겉옷을 챙겨주세요`,
      ),
  },
  EVENING_SNOW: {
    copy: ({ dayPartLabel, chillyTemp }) =>
      copy(
        dayPartLabel == null
          ? "내일 눈 소식이 있어요 ❄️"
          : `내일 ${dayPartLabel}부터 눈 소식이 있어요 ❄️`,
        chillyTemp == null
          ? "이동 시간을 여유 있게 잡아두세요"
          : `아침엔 ${chillyTemp}°C예요. 따뜻하게 입고 여유 있게 나가세요`,
      ),
  },
  EVENING_SUMMARY: {
    copy: ({ conditionLabel, tempMin, tempMax, isChilly }) =>
      isChilly
        ? copy(
            `내일 아침은 ${tempMin}°C로 쌀쌀해요 🌙`,
            `겉옷을 챙겨주세요. 낮에는 ${tempMax}°C까지 올라요`,
          )
        : copy(
            `내일은 ${conditionLabel}, ${tempMin}~${tempMax}°C예요 🌙`,
            "내일 계획에 참고해보세요",
          ),
  },
} satisfies WeatherNotificationCopyCatalog;

export const SOCIAL_TEMPLATES = {
  NUDGE_REPLIED: {
    copy: ({ senderName, todoTitle, replyKind }) =>
      copy(
        `${named(senderName, "이/가")} 콕에 답했어요`,
        `‘${todoTitle}’ · “${REPLY_LABEL[replyKind]}”`,
      ),
  },
  NUDGE_THANKED: {
    copy: ({ senderName, todoTitle }) =>
      copy(`${named(senderName, "이/가")} 고맙대요 🐾`, `‘${todoTitle}’ 끝냈대요. 응원이 통했어요`),
  },
  FOLLOW_NEW: {
    variants: [
      ({ senderName }) =>
        copy(
          `${named(senderName, "이/가")} 친구 요청을 보냈어요`,
          "수락하면 서로의 할 일을 보고 응원할 수 있어요",
        ),
      ({ senderName }) =>
        copy(
          `${named(senderName, "이/가")} 친구가 되고 싶대요`,
          "같이 하면 할 일이 더 잘 끝나요 🐾",
        ),
      ({ senderName }) =>
        copy("새 친구 요청이 왔어요", `${named(senderName, "와/과")} 서로 응원해볼까요?`),
    ],
  },
  FOLLOW_ACCEPTED: {
    variants: [
      ({ senderName }) =>
        copy(
          `${named(senderName, "이/가")} 친구 요청을 수락했어요`,
          "이제 서로의 할 일을 보고 응원할 수 있어요",
        ),
      ({ senderName }) =>
        copy(`${named(senderName, "와/과")} 친구가 됐어요 🎉`, "첫 응원을 먼저 보내볼까요?"),
      ({ senderName }) =>
        copy("친구가 한 명 늘었어요", `${honorific(senderName)}에게 콕으로 인사해봐요 🐾`),
    ],
  },
  INVITE_PROGRESS: {
    copy: ({ inviteeName }) =>
      copy(
        `${named(inviteeName, "이/가")} 첫날 할 일을 끝냈어요 🐾`,
        "내일도 해낼 수 있게 콕 찔러 응원해줘요",
      ),
  },
  INVITE_QUALIFY_REMINDER: {
    copy: ({ inviterName }) =>
      copy(
        "오늘 하루만 더 해볼까요? 🐾",
        `오늘 할 일을 끝내면 ${honorific(inviterName)}에게 발자국을 선물할 수 있어요`,
      ),
  },
  INVITE_JOINED: {
    copy: ({ inviteeName }) =>
      copy(
        `${named(inviteeName, "이/가")} 내 초대로 친구가 됐어요 🐾`,
        "환영 인사로 첫 응원을 보내봐요",
      ),
  },
  INVITE_REWARDED: {
    copy: ({ premiumDays, friendSlots }) => {
      const premium = `프리미엄 ${premiumDays}일`;
      const friends = `${friendSlots}명 더 추가할 수 있어요`;
      if (premiumDays > 0 && friendSlots > 0) {
        return copy("발자국이 찍혔어요 🐾", `${premium}을 받았고, 친구도 ${friends}`);
      }
      return copy(
        "발자국이 찍혔어요 🐾",
        premiumDays > 0 ? `${premium}을 받았어요` : `이제 친구를 ${friends}`,
      );
    },
  },
  NUDGE_RECEIVED: {
    variants: [
      ({ senderName, todoTitle }) =>
        copy(
          `${named(senderName, "이/가")} 콕 찔렀어요 🐾`,
          todoTitle ? `‘${todoTitle}’ 같이 시작해보재요` : "오늘 할 일, 같이 시작해보재요",
        ),
      ({ senderName, todoTitle }) =>
        copy(
          `${honorific(senderName)}의 콕이 도착했어요`,
          todoTitle ? `‘${todoTitle}’, 지금 시작해볼까요?` : "지금 할 수 있는 일 하나만 골라봐요",
        ),
      ({ todoTitle, senderName }) =>
        copy(
          "친구가 콕 찔렀어요",
          todoTitle
            ? `${named(senderName, "이/가")} ‘${todoTitle}’ 응원하고 있어요`
            : `${named(senderName, "이/가")} 오늘 하루를 응원하고 있어요`,
        ),
    ],
  },
  NUDGE_RECEIVED_WITH_MESSAGE: {
    copy: ({ senderName, todoTitle, message }) =>
      copy(
        `${honorific(senderName)}의 콕과 한마디가 왔어요`,
        todoTitle ? `‘${todoTitle}’ · ${message}` : message,
      ),
  },
  REMIND_NUDGE_RECEIVED: {
    variants: [
      ({ senderName }) =>
        copy(`${named(senderName, "이/가")} 같이 시작하재요 🐾`, "오늘 할 일을 하나 적어볼까요?"),
      ({ senderName }) =>
        copy(`${honorific(senderName)}의 콕이 도착했어요`, "떠오르는 일 하나만 적어봐요"),
      ({ senderName }) =>
        copy(
          "친구가 오늘의 시작을 응원해요",
          `${named(senderName, "이/가")} 콕으로 안부를 전했어요`,
        ),
    ],
  },
  REMIND_NUDGE_RECEIVED_WITH_MESSAGE: {
    copy: ({ senderName, message }) =>
      copy(`${honorific(senderName)}의 콕과 한마디가 왔어요`, message),
  },
  CHEER_RECEIVED: {
    copy: ({ senderName, message }) =>
      copy(`${honorific(senderName)}의 응원이 도착했어요`, message),
  },
  CHEER_RECEIVED_NO_MESSAGE: {
    variants: [
      ({ senderName }) =>
        copy(`${named(senderName, "이/가")} 응원을 보냈어요 🐾`, "오늘도 나만의 속도로 가봐요"),
      ({ senderName }) =>
        copy(`${honorific(senderName)}의 응원이 왔어요`, "오늘 할 일, 힘내서 끝내봐요"),
      ({ senderName }) =>
        copy("친구가 응원하고 있어요", `${named(senderName, "이/가")} 오늘 하루를 응원한대요`),
    ],
  },
  FRIEND_COMPLETED: {
    variants: [
      ({ friendName }) =>
        copy(`${named(friendName, "이/가")} 할 일을 다 끝냈어요 ✨`, "축하 한마디 보내볼까요?"),
      ({ friendName }) =>
        copy(`${honorific(friendName)}, 오늘 할 일 전부 완료`, "응원 한마디가 큰 힘이 돼요"),
      ({ friendName }) =>
        copy(
          "친구가 오늘 할 일을 다 끝냈어요",
          `${honorific(friendName)}에게 잘했다고 말해줘요 🐾`,
        ),
    ],
  },
  SOCIAL_DIGEST_MULTI: {
    variants: [
      ({ completedFriendCount }) =>
        copy(
          `친구 ${completedFriendCount}명이 할 일을 다 끝냈어요 ✨`,
          "나도 하나 끝내고 응원 보내볼까요?",
        ),
      ({ completedFriendCount }) =>
        copy(`친구 ${completedFriendCount}명이 오늘 완료했어요`, "축하 한마디 건네봐요"),
      ({ completedFriendCount }) =>
        copy(
          `오늘 ${completedFriendCount}명이 할 일을 다 끝냈어요`,
          "친구들 기록 구경하고 나도 하나 해봐요 🐾",
        ),
    ],
  },
  SOCIAL_DIGEST_SINGLE: {
    variants: [
      ({ friendName }) =>
        copy(
          `${named(friendName, "이/가")} 할 일을 다 끝냈어요 ✨`,
          "축하 보내고 나도 하나 끝내볼까요?",
        ),
      ({ friendName }) =>
        copy(`${honorific(friendName)}의 완료 소식이 왔어요`, "잘했다고 한마디 건네볼까요?"),
      ({ friendName }) =>
        copy(
          "친구가 오늘 할 일을 다 끝냈어요",
          `${honorific(friendName)}에게 응원 보내고 같이 달려봐요 🐾`,
        ),
    ],
  },
  NUDGE_SUGGEST: {
    variants: [
      ({ friendName }) =>
        copy(`${honorific(friendName)}에게 안부 콕 어때요?`, "가벼운 콕 하나가 큰 응원이 돼요 🐾"),
      ({ friendName }) =>
        copy("친구에게 응원을 보내볼까요?", `${honorific(friendName)}에게 콕으로 인사해봐요`),
      ({ friendName }) =>
        copy(`${named(friendName, "은/는")} 요즘 어떻게 지낼까요?`, "콕 하나로 안부를 전해봐요"),
    ],
  },
  TODO_COMMENT: {
    variants: [
      ({ senderName }) =>
        copy(`${named(senderName, "이/가")} 댓글을 남겼어요`, "할 일에 새 댓글이 달렸어요"),
      ({ senderName }) =>
        copy(`${honorific(senderName)}의 새 댓글`, "무슨 이야기인지 확인해봐요 🐾"),
      ({ senderName }) =>
        copy("할 일에 새 댓글이 달렸어요", `${honorific(senderName)}의 댓글을 확인해봐요`),
    ],
  },
  TODO_COMMENT_CHAIN: {
    variants: [
      ({ senderName, count }) =>
        copy(
          `${named(senderName, "이/가")} 댓글 ${count}개를 남겼어요`,
          "새 댓글을 한 번에 확인해봐요",
        ),
      ({ senderName, count }) =>
        copy(`${honorific(senderName)}의 댓글 ${count}개`, "할 일에 이야기가 이어지고 있어요 🐾"),
      ({ count, senderName }) =>
        copy(`새 댓글 ${count}개가 달렸어요`, `${honorific(senderName)}의 이야기를 확인해봐요`),
    ],
  },
  TODO_COMMENT_REPLY: {
    variants: [
      ({ senderName }) =>
        copy(`${named(senderName, "이/가")} 답글을 남겼어요`, "내 댓글에 새 답글이 달렸어요"),
      ({ senderName }) =>
        copy(`${honorific(senderName)}의 답글이 왔어요`, "이어서 대화해볼까요? 🐾"),
      ({ senderName }) =>
        copy("내 댓글에 답글이 달렸어요", `${honorific(senderName)}의 답글을 확인해봐요`),
    ],
  },
  TODO_COMMENT_REPLY_TO_REPLY: {
    variants: [
      ({ senderName }) =>
        copy(`${named(senderName, "이/가")} 답글을 남겼어요`, "내 답글에 새 답글이 달렸어요"),
      ({ senderName }) =>
        copy(`${honorific(senderName)}의 답글이 왔어요`, "이어서 대화해볼까요? 🐾"),
      ({ senderName }) =>
        copy("내 답글에 답글이 달렸어요", `${honorific(senderName)}의 답글을 확인해봐요`),
    ],
  },
  TODO_COMMENT_REPLY_CHAIN: {
    variants: [
      ({ senderName, count }) =>
        copy(
          `${named(senderName, "이/가")} 답글 ${count}개를 남겼어요`,
          "이어진 대화를 확인해봐요",
        ),
      ({ senderName, count }) =>
        copy(`${honorific(senderName)}의 답글 ${count}개`, "새 답글을 한 번에 읽어봐요 🐾"),
      ({ count, senderName }) =>
        copy(
          `새 답글 ${count}개가 달렸어요`,
          `${named(senderName, "와/과")} 대화가 이어지고 있어요`,
        ),
    ],
  },
  TODO_COMMENT_LIKE: {
    variants: [
      ({ senderName }) =>
        copy(`${named(senderName, "이/가")} 내 댓글을 좋아해요`, "댓글에 하트를 남겼어요 ❤️"),
      ({ senderName }) =>
        copy(`${named(senderName, "이/가")} 내 댓글에 공감했어요`, "내 이야기에 마음을 보탰어요"),
      ({ senderName }) =>
        copy("내 댓글에 하트가 달렸어요", `${named(senderName, "이/가")} 하트를 보냈어요`),
    ],
  },
} satisfies SocialNotificationCopyCatalog;

/** 받는 사람 달력으로 센 남은 일수(0 = 오늘) */
function dayPhrase(days: number): string {
  return days <= 0 ? "오늘" : days === 1 ? "내일" : `${days}일 뒤`;
}

function planPhrase(planType: SubscriptionPlanType | null): string {
  return match(planType)
    .with("ANNUAL", () => "연간 구독")
    .with("MONTHLY", () => "월간 구독")
    .with(null, () => "구독")
    .exhaustive();
}

export const SYSTEM_TEMPLATES = {
  WINBACK_DAY3: {
    variants: [
      staticCopy("다시 가볍게 시작해볼까요?", "오늘 할 일 하나만 적어봐요"),
      staticCopy("오늘 계획, 같이 세워볼까요?", "작은 일 하나면 충분해요"),
      staticCopy("아이두랑 한 걸음만 가봐요 🐾", "오늘 첫 할 일을 정해봐요"),
    ],
  },
  WINBACK_DAY7: {
    variants: [
      staticCopy("오늘 필요한 일, 하나 적어볼까요?", "다시 시작하는 데 큰 계획은 필요 없어요"),
      staticCopy("다시 천천히 시작해요", "작은 할 일 하나면 충분해요"),
      staticCopy("빈 할 일 목록도 새 출발이에요 🐾", "지금 떠오르는 일을 적어봐요"),
    ],
  },
  WINBACK_DAY14: {
    variants: [
      staticCopy("새 계획 세우기 좋은 날이에요", "오늘 필요한 일부터 적어봐요"),
      staticCopy("다시 시작하는 날도 소중해요", "작은 할 일 하나면 좋은 출발이에요"),
      staticCopy("아이두랑 오늘을 계획해봐요 🐾", "지난 일 말고 오늘 할 일부터요"),
    ],
  },
  WINBACK_DAY21: {
    variants: [
      staticCopy("언제든 다시 와도 괜찮아요", "지금 할 수 있는 일 하나만 적어봐요"),
      staticCopy("새 계획을 적을 자리가 있어요", "오늘 나에게 필요한 일부터 시작해요"),
      staticCopy("아이두는 늘 여기 있어요 🐾", "작은 계획 하나로 다시 만나요"),
    ],
  },
  WINBACK_DAY30: {
    variants: [
      staticCopy("오늘부터 다시 계획해볼까요?", "한 달 전 말고, 지금 필요한 일부터요"),
      staticCopy("익숙한 곳에서 새로 시작해요", "할 일 하나 적고 천천히 가봐요"),
      staticCopy("새 출발, 아이두가 함께할게요 🐾", "오늘 할 수 있는 만큼만 계획해요"),
    ],
  },
  WEEKLY_ACHIEVEMENT: {
    variants: [
      ({ completedCount }) =>
        copy(`지난주 할 일 ${completedCount}개 끝냈어요 🐾`, "차곡차곡 쌓인 기록을 확인해봐요"),
      ({ completedCount }) =>
        copy(`지난주 완료 ${completedCount}개`, "이번 주도 이 흐름 그대로 가봐요"),
      ({ completedCount }) =>
        copy(`지난주에 ${completedCount}개를 해냈어요`, "작은 성취들을 한눈에 모아봤어요"),
    ],
  },
  WEEKLY_ACHIEVEMENT_PERFECT: {
    variants: [
      staticCopy("지난주 할 일 100% 완료 🏆", "계획한 일을 모두 해냈어요, 최고예요"),
      staticCopy("지난주 계획을 모두 끝냈어요", "이번 주도 이 기세 그대로 가요"),
      staticCopy("지난주 할 일 모두 완료", "아이두도 깜짝 놀랐어요 🐾"),
    ],
  },
  WEEKLY_ACHIEVEMENT_ALMOST: {
    variants: [
      ({ rate }) => copy(`지난주 완료율 ${rate}%`, "거의 다 해냈어요! 기록을 확인해봐요"),
      ({ rate }) => copy(`지난주 ${rate}% 해냈어요 🐾`, "이번 주엔 100%도 노려봐요"),
      ({ rate }) => copy(`지난주 기록 ${rate}% 완료`, "잘 해낸 일부터 돌아봐요"),
    ],
  },
  WEEKLY_REPORT: {
    copy: staticCopy("지난주의 나, 어땠을까요? 📊", "리포트에서 지난주 흐름을 살펴봐요"),
  },
  MONTHLY_REPORT: {
    copy: staticCopy("지난달의 나, 어땠을까요? 📈", "리포트에서 지난달 흐름을 살펴봐요"),
  },
  AI_SUGGESTION: {
    copy: staticCopy("맞춤 할 일 제안이 도착했어요 ✨", "최근 기록에 맞춰 골라봤어요"),
  },
  BILLING_ISSUE: {
    copy: staticCopy("결제 정보 확인이 필요해요", "구독을 이어가려면 결제 수단을 확인해주세요"),
  },
  PREMIUM_GRANT_ENDING: {
    copy: staticCopy("내일 프리미엄이 끝나요", "남은 기간은 구독 화면에서 볼 수 있어요"),
  },
  PREMIUM_TRIAL_ENDING_RENEWING: {
    copy: ({ days, date, planType }) =>
      copy(
        `${dayPhrase(days)} ${planPhrase(planType)}이 시작돼요`,
        `${date} 결제 예정 · 해지는 스토어에서`,
      ),
  },
  PREMIUM_TRIAL_ENDING_CANCELLED: {
    copy: ({ days, date }) =>
      copy(
        days <= 0
          ? "오늘 무료 체험이 끝나요"
          : days === 1
            ? "내일 무료 체험이 끝나요"
            : `무료 체험이 ${days}일 뒤 끝나요`,
        `${date}까지 이용 · 결제는 없어요`,
      ),
  },
  MARKETING_CONSENT_RECONFIRM: {
    copy: ({ agreedOn }) =>
      copy("광고성 알림 수신에 동의 중이에요", `${agreedOn} 동의 · 설정에서 바꿀 수 있어요`),
  },
  ONBOARDING_DAY0: {
    copy: staticCopy("첫 할 일을 적어볼까요? 🌱", "지금 떠오르는 작은 일 하나면 충분해요"),
  },
  ONBOARDING_DAY1: {
    copy: staticCopy("오늘 할 일 하나로 시작해요", "적고, 끝내고, 체크하면 끝이에요 🐾"),
  },
  ONBOARDING_DAY2: {
    copy: staticCopy("친구랑 같이 하면 더 잘 돼요", "서로의 할 일을 보고 콕 찔러줄 수 있어요"),
  },
  ONBOARDING_DAY3: {
    copy: staticCopy("필요할 때 알려드릴게요 ⏰", "알림 설정을 내 하루에 맞춰봐요"),
  },
  ONBOARDING_DAY5: {
    copy: ({ completedCount }) =>
      completedCount === 0
        ? copy("내 할 일 목록 볼까요? 🐾", "목록에서 다음에 할 일을 정해봐요")
        : copy(`지금까지 ${completedCount}개 해냈어요`, "끝낸 일들을 한눈에 확인해봐요 🐾"),
  },
  ONBOARDING_DAY7: {
    copy: ({ completedCount }) =>
      copy(
        "아이두와 함께한 첫 일주일 🎉",
        completedCount === 0
          ? "첫 주 기록을 확인해봐요"
          : `완료한 할 일 ${completedCount}개를 돌아봐요`,
      ),
  },
  MILESTONE_FIRST_COMPLETE: {
    copy: staticCopy("첫 할 일 완료! ✨", "시작이 제일 어려운데, 해냈어요"),
  },
  MILESTONE_10: {
    copy: staticCopy("할 일 10개 완료 🐾", "작은 성취가 차곡차곡 쌓이고 있어요"),
  },
  MILESTONE_50: {
    copy: staticCopy("벌써 50개나 끝냈어요 🎉", "꾸준함이 눈에 보이기 시작했어요"),
  },
  MILESTONE_100: {
    copy: staticCopy("할 일 100개 달성 🏆", "하나씩 해내서 여기까지 왔어요"),
  },
  MILESTONE_STREAK_3: {
    copy: staticCopy("3일 연속 완료 🔥", "좋은 흐름이에요. 내일도 이어가봐요"),
  },
  MILESTONE_FIRST_FRIEND: {
    copy: staticCopy("첫 친구가 생겼어요 🐾", "이제 서로 응원하며 같이 해봐요"),
  },
} satisfies SystemNotificationCopyCatalog;

export const WEATHER_CONDITION_LABEL = {
  CLEAR: "맑음",
  MOSTLY_CLEAR: "대체로 맑음",
  PARTLY_CLOUDY: "구름 조금",
  MOSTLY_CLOUDY: "구름 많음",
  CLOUDY: "흐림",
  FOGGY: "안개",
  HAZY: "뿌연 하늘",
  WINDY: "강한 바람",
  DRIZZLE: "이슬비",
  RAIN: "비",
  HEAVY_RAIN: "폭우",
  THUNDERSTORMS: "천둥번개",
  SLEET: "진눈깨비",
  SNOW: "눈",
  HEAVY_SNOW: "폭설",
  HAIL: "우박",
  HOT: "무더위",
  FRIGID: "강추위",
} satisfies Record<WeatherCondition, string>;

export const WEATHER_DAY_PART_LABEL = {
  dawn: "새벽",
  morning: "오전",
  afternoon: "오후",
  evening: "저녁",
} satisfies Record<WeatherDayPart, string>;

export const WEATHER_FALLBACK = {
  MORNING: {
    copy: staticCopy("오늘 날씨를 함께 챙겨볼까요? ☀️", "날씨 위치를 정하면 매일 알려드릴게요"),
  },
  EVENING: {
    copy: staticCopy("내일 날씨도 미리 챙겨보세요 🌙", "날씨 위치를 정하면 내일 예보를 알려드려요"),
  },
  MORNING_UNAVAILABLE: {
    copy: staticCopy("오늘 날씨를 확인해보세요 ☀️", "앱에서 시간대별 예보를 볼 수 있어요"),
  },
  EVENING_UNAVAILABLE: {
    copy: staticCopy("내일 날씨를 미리 확인해보세요 🌙", "앱에서 내일 예보를 볼 수 있어요"),
  },
} satisfies WeatherFallbackCopyCatalog;

export const RETENTION_TEMPLATES = {
  "D0:d0_no_todo": {
    variants: [
      staticCopy("첫 할 일은 작게 시작해요 🌱", "지금 떠오르는 일 하나면 충분해요"),
      staticCopy("아이두랑 첫 계획 세워볼까요?", "기억해둘 일 하나만 적어봐요 🐾"),
      staticCopy("첫 할 일을 만들어봐요", "물 마시기처럼 작은 일도 좋아요"),
    ],
  },
  "D1:d1_no_todo": {
    variants: [
      staticCopy("오늘 할 일, 뭐가 있을까요?", "하고 싶은 일 하나만 적어봐요"),
      staticCopy("거창한 계획은 필요 없어요", "떠오르는 일부터 하나 적어봐요 🐾"),
      staticCopy("잊으면 안 될 일, 있나요?", "적어두면 머리가 한결 가벼워져요"),
    ],
  },
  "D1:d1_has_todo_no_completion": {
    variants: [
      staticCopy("첫 체크, 해볼까요? ✅", "제일 쉬운 할 일 하나만 골라봐요"),
      staticCopy("적어둔 일부터 가볍게", "할 일 목록에서 지금 할 수 있는 걸 골라봐요"),
      staticCopy("첫 체크의 기분, 느껴볼까요? 🐾", "하나만 끝내도 하루가 달라져요"),
    ],
  },
  "D3:d3_restart": {
    variants: [
      staticCopy("오늘 다시 시작해봐요 🌱", "지금 필요한 일 하나만 적어봐요"),
      staticCopy("오늘 계획은 가볍게", "작은 일 하나부터 다시 해도 괜찮아요"),
      staticCopy("아이두랑 다시 한 걸음 🐾", "할 수 있는 만큼만 시작해봐요"),
    ],
  },
  "D7:d7_has_progress": {
    variants: [
      staticCopy("첫 주 기록이 모였어요 🎉", "일주일 동안 해낸 일을 구경해봐요"),
      staticCopy("첫 주에 해낸 일을 모아봤어요", "기록을 보며 이번 주를 계획해봐요 🐾"),
      staticCopy("일주일 동안의 나, 어땠을까요?", "기록 보고 다음 계획도 세워봐요"),
    ],
  },
  "D7:d7_restart": {
    variants: [
      staticCopy("오늘 필요한 작은 계획부터", "지금 할 수 있는 일 하나만 적어봐요"),
      staticCopy("언제 다시 시작해도 괜찮아요", "할 일 하나면 다시 시작할 수 있어요"),
      staticCopy("아이두랑 오늘 계획해볼까요? 🐾", "지금 필요한 할 일을 정해봐요"),
    ],
  },
} satisfies RetentionNotificationCopyCatalog;
