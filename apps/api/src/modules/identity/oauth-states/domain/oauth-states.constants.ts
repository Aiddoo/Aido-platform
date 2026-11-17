import type { OAUTH_MODES } from "@aido/api/vocabulary";

export const OAUTH_STATE_VALIDITIES = ["valid", "expired", "exchanged"] as const;
export type OAuthMode = (typeof OAUTH_MODES)[number];

/** 웹 OAuth가 앱으로 돌아가는 기본 딥링크. 출시 앱이 등록한 scheme이라 바꾸지 않는다 */
export const DEFAULT_OAUTH_REDIRECT_URI = "aido://auth/callback";

/** 웹 OAuth state가 콜백을 기다리는 시간 */
export const OAUTH_STATE_EXPIRY_MINUTES = 10;
