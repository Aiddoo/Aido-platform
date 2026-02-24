import * as Sentry from "@sentry/nestjs";

Sentry.init({
	dsn: process.env.SENTRY_DSN,
	environment: process.env.NODE_ENV || "development",
	// TODO: 서비스 스케일업 시 릴리스 버저닝 추가 (e.g., release: process.env.SENTRY_RELEASE)
	tracesSampleRate:
		process.env.SENTRY_TRACES_SAMPLE_RATE !== undefined
			? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
			: process.env.NODE_ENV === "production"
				? 0.2
				: 1.0,

	beforeSend(event) {
		// 요청 헤더에서 민감 정보 제거
		if (event.request?.headers) {
			delete event.request.headers.authorization;
			delete event.request.headers.cookie;
			delete event.request.headers["x-forwarded-for"];
		}

		// 쿼리스트링에서 token 파라미터 마스킹
		if (event.request?.query_string) {
			event.request.query_string = String(event.request.query_string).replace(
				/token=[^&]+/gi,
				"token=[FILTERED]",
			);
		}

		return event;
	},
});
