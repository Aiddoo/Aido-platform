import type { CurrentUserPayload } from "@aido/validators";
import {
	type CallHandler,
	type ExecutionContext,
	Injectable,
	Logger,
	type NestInterceptor,
	type OnModuleDestroy,
} from "@nestjs/common";
import type { Observable } from "rxjs";
import { normalizeIanaTimezone } from "@/shared/domain/date/utils/timezone";
import { UserSettingsFacade } from "../../application/facades/user-settings.facade";

/**
 * 인증 요청의 X-Timezone 헤더로 UserPreference.timezone을 자가치유하는 인터셉터.
 *
 * 앱은 매 인증요청에 실제 IANA 타임존을 보내지만, 과거에 헤더를 못 받은 유저는
 * timezone이 기본값 "UTC"에 머물러 발송 시각·야간 게이트가 어긋난다. 이 인터셉터가
 * 헤더를 읽어 저장값과 다를 때만 갱신한다(조건부 no-op 쓰기 — 클라이언트 변경 불필요).
 *
 * - fire-and-forget (응답 지연 없음)
 * - per-user 스로틀 + 마지막으로 반영한 tz 캐시: 같은 tz면 스로틀 창 안에서 재요청 안 함,
 *   tz가 바뀌면 즉시 반영(여행 등). 단일 인스턴스 in-memory Map으로 충분.
 * - THROTTLE_MS 주기로 만료 엔트리 정리 (메모리 누수 방지)
 */
@Injectable()
export class TimezoneSelfHealInterceptor
	implements NestInterceptor, OnModuleDestroy
{
	readonly #logger = new Logger(TimezoneSelfHealInterceptor.name);

	/** userId → 마지막으로 반영한 tz + 반영 시각(epoch ms) */
	readonly #seen = new Map<string, { tz: string; at: number }>();

	readonly #cleanupInterval: NodeJS.Timeout;

	static readonly THROTTLE_MS = 60 * 60 * 1000; // 1시간

	constructor(private readonly userSettings: UserSettingsFacade) {
		this.#cleanupInterval = setInterval(
			() => this.#cleanup(),
			TimezoneSelfHealInterceptor.THROTTLE_MS,
		);
	}

	onModuleDestroy(): void {
		clearInterval(this.#cleanupInterval);
	}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const request = context.switchToHttp().getRequest();
		const user = request.user as CurrentUserPayload | undefined;
		const timezone = normalizeIanaTimezone(request.headers?.["x-timezone"]);

		if (user?.userId && timezone) {
			this.#heal(user.userId, timezone);
		}

		return next.handle();
	}

	#heal(userId: string, timezone: string): void {
		const now = Date.now();
		const seen = this.#seen.get(userId);

		// 같은 tz를 스로틀 창 안에서 이미 반영했으면 재요청하지 않는다.
		if (
			seen &&
			seen.tz === timezone &&
			now - seen.at < TimezoneSelfHealInterceptor.THROTTLE_MS
		) {
			return;
		}

		this.#seen.set(userId, { tz: timezone, at: now });

		// fire-and-forget — 응답을 블로킹하지 않음. 저장값과 다를 때만 실제 쓰기가 발생.
		this.userSettings
			.refreshPushTimezoneIfChanged(userId, timezone)
			.catch((error) => {
				this.#logger.error(
					`Failed to self-heal timezone: userId=${userId}, tz=${timezone}, error=${error}`,
				);
			});
	}

	#cleanup(): void {
		const cutoff = Date.now() - TimezoneSelfHealInterceptor.THROTTLE_MS;
		let cleaned = 0;

		for (const [userId, entry] of this.#seen.entries()) {
			if (entry.at < cutoff) {
				this.#seen.delete(userId);
				cleaned++;
			}
		}

		if (cleaned > 0) {
			this.#logger.debug(
				`Timezone self-heal cleanup: removed ${cleaned} expired entries`,
			);
		}
	}
}
