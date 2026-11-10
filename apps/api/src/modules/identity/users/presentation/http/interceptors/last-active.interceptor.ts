import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  type NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { LRUCache } from "lru-cache";
import type { Observable } from "rxjs";

import { AuthLogEvent } from "#api/modules/identity/auth/application/auth.log-events";
import { AuthUserActivityWriterPort } from "#api/modules/identity/auth/application/ports/auth-collaboration.port";
import { RequestClientReader, requestTimezoneOrUtc } from "#api/platform/http/request-client/index";
import { readRequestUserId } from "#api/platform/http/request-user-id";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { localDateIn } from "#api/shared/domain/time/time-zone-name";

export const LAST_ACTIVE_THROTTLE_TTL_MS = 60 * 60 * 1000;
// 한 시간에 이보다 많은 키가 생기면 가장 오래 안 본 키를 잊는다. 잊힌 사용자는 같은 값을 한 번 더 쓸 뿐이다
export const LAST_ACTIVE_THROTTLE_MAX_ENTRIES = 10_000;

/**
 * 인증된 API 요청 시 User.lastActiveAt과 요청한 앱 버전(X-App-Version)을 갱신하는 인터셉터
 *
 * - 1시간 이내 중복 갱신 방지 (in-memory throttle). 앱 버전이 바뀌면 throttle과 무관하게 바로 남긴다
 * - 앱 버전은 같은 UPDATE로 남겨 요청마다 쓰기가 늘지 않는다
 * - fire-and-forget 패턴 (응답 지연 없음)
 */
@Injectable()
export class LastActiveInterceptor implements NestInterceptor {
  readonly #logger = new Logger(LastActiveInterceptor.name);

  /** `${userId}:${localDate}:${appVersion}` → lastUpdatedAt (epoch ms) */
  readonly #throttle: LRUCache<string, number>;

  readonly #userActivityWriter: AuthUserActivityWriterPort;
  readonly #requestClientReader: RequestClientReader;
  readonly #clock: ClockPort;

  constructor(
    @Inject(AuthUserActivityWriterPort)
    userActivityWriter: AuthUserActivityWriterPort,
    requestClientReader: RequestClientReader,
    clock: ClockPort,
  ) {
    this.#userActivityWriter = userActivityWriter;
    this.#requestClientReader = requestClientReader;
    this.#clock = clock;
    this.#throttle = new LRUCache({
      max: LAST_ACTIVE_THROTTLE_MAX_ENTRIES,
      ttl: LAST_ACTIVE_THROTTLE_TTL_MS,
      // throttle 판단과 같은 시계로 만료를 재고, 시각을 타이머로 캐시하지 않는다
      perf: { now: () => this.#clock.now().epochMilliseconds },
      ttlResolution: 0,
    });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const userId = readRequestUserId(request);

    if (userId) {
      const client = this.#requestClientReader.current();
      this.#touchLastActive(userId, requestTimezoneOrUtc(client), client.appVersion ?? undefined);
    }

    return next.handle();
  }

  #touchLastActive(userId: string, timezone: string, appVersion: string | undefined): void {
    const seenAt = this.#clock.now();
    const touchedAt = seenAt.epochMilliseconds;
    const localDate = localDateIn(seenAt, timezone).toString();
    const throttleKey = `${userId}:${localDate}:${appVersion ?? ""}`;
    const lastUpdated = this.#throttle.get(throttleKey);

    if (lastUpdated && touchedAt - lastUpdated < LAST_ACTIVE_THROTTLE_TTL_MS) {
      return;
    }

    this.#throttle.set(throttleKey, touchedAt);

    // fire-and-forget — 응답을 블로킹하지 않음
    this.#userActivityWriter
      .updateLastActiveAt({ userId: UserId.reconstitute(userId), timezone, seenAt, appVersion })
      .catch((error) => {
        if (this.#throttle.peek(throttleKey) === touchedAt) {
          this.#throttle.delete(throttleKey);
        }
        this.#logger.error({
          event: AuthLogEvent.LAST_ACTIVE_UPDATE_FAILED,
          userId,
          errorType: toErrorType(error),
        });
      });
  }
}
