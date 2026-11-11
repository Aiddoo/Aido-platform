/**
 * process.env의 유일한 접근점이다. Nest 설정 모듈이 뜨기 전에 필요한 값(Sentry 초기화, .env 경로, npm 버전)만
 * 여기서 읽고, 나머지는 검증을 거친 namespace 설정(`*.config.ts`)으로 읽는다.
 */
export const processEnv: Readonly<Record<string, string | undefined>> = process.env;
