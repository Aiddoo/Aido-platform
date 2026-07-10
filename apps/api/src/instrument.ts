import * as Sentry from "@sentry/nestjs";
import { resolveSentryOptions } from "./common/config/utils/sentry-options";

const options = resolveSentryOptions(process.env);

Sentry.init({
	dsn: process.env.SENTRY_DSN,
	// production(APP_ENV 기준)에서만 발송 — 개발서버/스테이징/로컬은 무발송.
	// enabled: false면 SDK가 transport를 만들지 않아 capture가 전부 no-op이다.
	enabled: options.enabled,
	environment: options.environment,
	// TODO: 서비스 스케일업 시 릴리스 버저닝 추가 (e.g., release: process.env.SENTRY_RELEASE)
	tracesSampleRate: options.tracesSampleRate,

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
