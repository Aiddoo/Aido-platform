/** 관리자 알림을 보내는 채널. admin은 가입·운영 알림, payment는 결제 알림이다. */
export const ADMIN_NOTIFICATION_CHANNELS = ["admin", "payment"] as const;

export type AdminNotificationChannel = (typeof ADMIN_NOTIFICATION_CHANNELS)[number];

/** 가입 이벤트가 싣는 로그인 방식. identity의 계정 공급자(대문자)를 소문자로 옮긴 값이다. */
const SIGNUP_EVENT_PROVIDERS = ["credential", "apple", "google", "kakao", "naver"] as const;

export type SignupEventProvider = (typeof SIGNUP_EVENT_PROVIDERS)[number];
