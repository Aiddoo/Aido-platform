/** 앱 스토어 버전은 MAJOR.MINOR.PATCH만 받는다(프리릴리스·빌드 메타데이터 없음). */
export const APP_STORE_VERSION_PATTERN = "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$";

/** 서버가 저장하는 스토어 공개 버전의 길이 상한(DB 칸 길이와 같다). */
export const APP_STORE_VERSION_MAX_LENGTH = 32;

export const APP_PLATFORMS = ["ios", "android"] as const;
export type AppPlatform = (typeof APP_PLATFORMS)[number];
