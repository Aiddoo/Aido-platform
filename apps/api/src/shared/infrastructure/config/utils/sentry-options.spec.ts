/**
 * resolveSentryOptions 단위 테스트
 *
 * @description
 * Sentry 활성화 여부를 배포 환경(APP_ENV) 기준으로 결정하는 규칙 검증.
 * 핵심: 개발서버는 production 빌드(NODE_ENV=production)로 돌기 때문에
 * NODE_ENV만으로는 구분할 수 없다 — APP_ENV가 배포 환경의 단일 진실.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test sentry-options
 * ```
 */
import { resolveSentryOptions } from "./sentry-options";

const DSN = "https://key@o0.ingest.sentry.io/0";

describe("resolveSentryOptions — Sentry 환경 게이트", () => {
	it("개발서버(production 빌드 + APP_ENV=development)에서는 비활성화된다", () => {
		// Given — 배포된 개발서버: production 빌드지만 개발 환경
		const options = resolveSentryOptions({
			APP_ENV: "development",
			NODE_ENV: "production",
			SENTRY_DSN: DSN,
		});

		// Then
		expect(options.enabled).toBe(false);
		expect(options.environment).toBe("development");
	});

	it("APP_ENV=production + DSN이면 활성화된다", () => {
		// When
		const options = resolveSentryOptions({
			APP_ENV: "production",
			NODE_ENV: "production",
			SENTRY_DSN: DSN,
		});

		// Then
		expect(options.enabled).toBe(true);
		expect(options.environment).toBe("production");
	});

	it("APP_ENV 미설정 시 NODE_ENV=production이면 production으로 폴백한다 (기존 프로덕션 하위호환)", () => {
		// Given — 기존 프로덕션 배포는 APP_ENV를 설정하지 않음
		const options = resolveSentryOptions({
			NODE_ENV: "production",
			SENTRY_DSN: DSN,
		});

		// Then — 배포 인프라 변경 없이 기존 알림 유지
		expect(options.enabled).toBe(true);
		expect(options.environment).toBe("production");
	});

	it("로컬 개발(NODE_ENV=development)에서는 비활성화된다", () => {
		// When
		const options = resolveSentryOptions({
			NODE_ENV: "development",
			SENTRY_DSN: DSN,
		});

		// Then
		expect(options.enabled).toBe(false);
		expect(options.environment).toBe("development");
	});

	it("production이어도 DSN이 없으면 비활성화된다", () => {
		// When
		const options = resolveSentryOptions({
			APP_ENV: "production",
			NODE_ENV: "production",
		});

		// Then
		expect(options.enabled).toBe(false);
	});

	it("staging은 이벤트를 보내지 않는다 (production만 발송)", () => {
		// When
		const options = resolveSentryOptions({
			APP_ENV: "staging",
			NODE_ENV: "production",
			SENTRY_DSN: DSN,
		});

		// Then
		expect(options.enabled).toBe(false);
		expect(options.environment).toBe("staging");
	});

	it("잘못된 APP_ENV 값은 NODE_ENV 폴백을 따른다", () => {
		// When
		const options = resolveSentryOptions({
			APP_ENV: "prod-typo",
			NODE_ENV: "production",
			SENTRY_DSN: DSN,
		});

		// Then
		expect(options.environment).toBe("production");
		expect(options.enabled).toBe(true);
	});

	describe("tracesSampleRate", () => {
		it("명시된 SENTRY_TRACES_SAMPLE_RATE가 최우선이다", () => {
			const options = resolveSentryOptions({
				APP_ENV: "production",
				SENTRY_TRACES_SAMPLE_RATE: "0.05",
			});
			expect(options.tracesSampleRate).toBe(0.05);
		});

		it("production 기본값은 0.2, 그 외는 1.0이다", () => {
			expect(
				resolveSentryOptions({ APP_ENV: "production" }).tracesSampleRate,
			).toBe(0.2);
			expect(
				resolveSentryOptions({ APP_ENV: "development" }).tracesSampleRate,
			).toBe(1.0);
		});
	});
});
