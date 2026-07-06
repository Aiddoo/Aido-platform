import enAchievement from './locales/en/achievement.json';
import enAi from './locales/en/ai.json';
import enAppIcon from './locales/en/appIcon.json';
import enAuth from './locales/en/auth.json';
import enCommon from './locales/en/common.json';
import enErrors from './locales/en/errors.json';
import enFriend from './locales/en/friend.json';
import enInquiry from './locales/en/inquiry.json';
import enMemo from './locales/en/memo.json';
import enNotification from './locales/en/notification.json';
import enSettings from './locales/en/settings.json';
import enSubscription from './locales/en/subscription.json';
import enTodo from './locales/en/todo.json';
import enUser from './locales/en/user.json';
import enValidation from './locales/en/validation.json';
import enWeather from './locales/en/weather.json';
import koAchievement from './locales/ko/achievement.json';
import koAi from './locales/ko/ai.json';
import koAppIcon from './locales/ko/appIcon.json';
import koAuth from './locales/ko/auth.json';
import koCommon from './locales/ko/common.json';
import koErrors from './locales/ko/errors.json';
import koFriend from './locales/ko/friend.json';
import koInquiry from './locales/ko/inquiry.json';
import koMemo from './locales/ko/memo.json';
import koNotification from './locales/ko/notification.json';
import koSettings from './locales/ko/settings.json';
import koSubscription from './locales/ko/subscription.json';
import koTodo from './locales/ko/todo.json';
import koUser from './locales/ko/user.json';
import koValidation from './locales/ko/validation.json';
import koWeather from './locales/ko/weather.json';

// ko 카탈로그가 원문(소스 오브 트루스) — i18next.d.ts의 타입 소스로 사용된다
export const resources = {
  ko: {
    common: koCommon,
    errors: koErrors,
    validation: koValidation,
    settings: koSettings,
    todo: koTodo,
    auth: koAuth,
    memo: koMemo,
    friend: koFriend,
    notification: koNotification,
    user: koUser,
    subscription: koSubscription,
    ai: koAi,
    achievement: koAchievement,
    inquiry: koInquiry,
    weather: koWeather,
    appIcon: koAppIcon,
  },
  en: {
    common: enCommon,
    errors: enErrors,
    validation: enValidation,
    settings: enSettings,
    todo: enTodo,
    auth: enAuth,
    memo: enMemo,
    friend: enFriend,
    notification: enNotification,
    user: enUser,
    subscription: enSubscription,
    ai: enAi,
    achievement: enAchievement,
    inquiry: enInquiry,
    weather: enWeather,
    appIcon: enAppIcon,
  },
} as const;

export type Namespace = keyof (typeof resources)['ko'];
