import type {
  AdminNoticeUser,
  SignupNotice,
} from "../../application/read-models/admin-notice.read-model.js";
import { type DiscordEmbed, field } from "./discord-notice-format.mapper.js";
import { displayNameOf, renderUserBlock } from "./discord-user-block.mapper.js";

const SIGNUP_COLOR = 0x57f287;

const DEVICE_PLATFORM_LABELS: Record<NonNullable<SignupNotice["devicePlatform"]>, string> = {
  IOS: "🍎 iOS",
  ANDROID: "🤖 Android",
  WEB: "🌐 Web",
};

/** 기기 정보가 없으면 가입 방식으로 추측하지 않고 비워 둔다. */
function deviceLabel(signup: SignupNotice): string | undefined {
  const platform =
    signup.devicePlatform == null ? undefined : DEVICE_PLATFORM_LABELS[signup.devicePlatform];
  const system =
    platform != null && signup.osVersion != null ? `${platform} ${signup.osVersion}` : platform;
  const label = [system, signup.deviceModel].filter((part) => part != null).join(" · ");
  return label === "" ? undefined : label;
}

function appVersionLabel(signup: SignupNotice): string | undefined {
  if (signup.appVersion == null) {
    return undefined;
  }
  return signup.appBuild == null
    ? `v${signup.appVersion}`
    : `v${signup.appVersion} (${signup.appBuild})`;
}

function localeLabel(signup: SignupNotice): string | undefined {
  const label = [signup.locale, signup.timezone].filter((part) => part != null).join(" · ");
  return label === "" ? undefined : label;
}

/** 가입 채널 embed. 결제 알림과 같은 사용자 블록 뒤에 가입 요청의 기기·앱 정보를 둔다. */
export function renderSignupNoticeEmbed(
  user: AdminNoticeUser,
  signup: SignupNotice,
  at: string,
): DiscordEmbed {
  return {
    title: "👋 새로운 회원가입",
    description: `**${displayNameOf(user)}** 님이 가입했습니다.`,
    color: SIGNUP_COLOR,
    fields: [
      ...renderUserBlock(user, at),
      field("기기", deviceLabel(signup)),
      field("앱 버전", appVersionLabel(signup)),
      field("언어·시간대", localeLabel(signup)),
    ],
    timestamp: at,
  };
}
