import type {
  AdminNoticeUser,
  SignupMethod,
} from "../../application/read-models/admin-notice.read-model.js";
import {
  type DiscordEmbedField,
  field,
  formatCode,
  formatJoined,
} from "./discord-notice-format.mapper.js";

const SIGNUP_METHOD_LABELS: Record<SignupMethod, string> = {
  CREDENTIAL: "이메일",
  APPLE: "Apple",
  GOOGLE: "Google",
  KAKAO: "Kakao",
  NAVER: "Naver",
};

/** 본문에 부를 이름. 닉네임이 없으면 이메일 앞부분이다. */
export function displayNameOf(user: AdminNoticeUser): string {
  if (user.nickname != null && user.nickname.trim() !== "") {
    return user.nickname;
  }
  const [localPart] = user.email.split("@");
  return localPart == null || localPart === "" ? user.email : localPart;
}

/**
 * 가입·결제 알림이 같은 모양·같은 순서로 쓰는 사용자 칸. 한 줄에 셋씩 놓인다.
 * 이메일은 가입 알림과 같은 규칙(가리지 않음)으로 적는다.
 */
export function renderUserBlock(user: AdminNoticeUser, at: string): DiscordEmbedField[] {
  return [
    field("닉네임", user.nickname),
    field("태그", user.userTag == null ? undefined : `#${user.userTag}`),
    field(
      "가입 방식",
      user.signupMethod == null ? undefined : SIGNUP_METHOD_LABELS[user.signupMethod],
    ),
    field("가입일", formatJoined(user.joinedAt, at)),
    field("이메일", user.email),
    field("사용자 ID", formatCode(user.userId)),
  ];
}
