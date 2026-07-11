/**
 * Sentry 초기화 옵션 결정 (instrument.ts에서 사용)
 *
 * 배포 환경 구분은 APP_ENV가 단일 진실이다:
 * - 개발서버도 production 빌드(NODE_ENV=production)로 돌기 때문에
 *   NODE_ENV만으로는 "실제 프로덕션"을 구분할 수 없다.
 * - APP_ENV 미설정 시 NODE_ENV로 폴백 — 기존 프로덕션 배포(APP_ENV 없음)의
 *   알림이 인프라 변경 없이 유지된다 (하위호환).
 * - 이벤트 발송(enabled)은 production에서만. environment 태그는 항상
 *   설정되므로 Sentry 서버측 알림 규칙에서도 이중으로 필터 가능하다.
 */

const APP_ENVIRONMENTS = ["development", "staging", "production"] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export interface SentryInstrumentOptions {
	enabled: boolean;
	environment: AppEnvironment;
	tracesSampleRate: number;
}

/** process.env 호환 — 필요한 키(APP_ENV/NODE_ENV/SENTRY_*)만 읽는다 */
type SentryEnvSource = Record<string, string | undefined>;

export function resolveSentryOptions(
	env: SentryEnvSource,
): SentryInstrumentOptions {
	const environment = resolveAppEnvironment(env);
	const isProduction = environment === "production";

	return {
		enabled: isProduction && Boolean(env.SENTRY_DSN),
		environment,
		tracesSampleRate:
			env.SENTRY_TRACES_SAMPLE_RATE !== undefined
				? Number(env.SENTRY_TRACES_SAMPLE_RATE)
				: isProduction
					? 0.2
					: 1.0,
	};
}

function resolveAppEnvironment(env: SentryEnvSource): AppEnvironment {
	const appEnv = APP_ENVIRONMENTS.find((value) => value === env.APP_ENV);
	if (appEnv) {
		return appEnv;
	}

	return env.NODE_ENV === "production" ? "production" : "development";
}
