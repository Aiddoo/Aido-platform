import type { CurrentUserPayload } from "@aido/api";
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from "@nestjs/common";
import { LRUCache } from "lru-cache";
import type { Observable } from "rxjs";

import { RequestClientReader } from "#api/platform/http/request-client/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { PreferenceLogEvent } from "../../../application/preferences.log-events.js";
import { RefreshPushTimezoneUseCase } from "../../../application/use-cases/refresh-push-timezone.use-case.js";

export const TIMEZONE_SELF_HEAL_TTL_MS = 60 * 60 * 1_000;
// 한 시간에 이보다 많은 사용자가 오면 가장 오래 안 본 사용자를 잊는다. 잊힌 사용자는 시간대를 한 번 더 저장할 뿐이다
export const TIMEZONE_SELF_HEAL_MAX_ENTRIES = 10_000;

interface TimezoneAttempt {
  readonly tz: string;
  readonly at: number;
}

@Injectable()
export class TimezoneSelfHealInterceptor implements NestInterceptor {
  readonly #logger = new Logger(TimezoneSelfHealInterceptor.name);

  readonly #seen: LRUCache<string, TimezoneAttempt>;

  readonly #refreshPushTimezoneUseCase: RefreshPushTimezoneUseCase;
  readonly #requestClientReader: RequestClientReader;
  readonly #clock: ClockPort;

  constructor(
    refreshPushTimezoneUseCase: RefreshPushTimezoneUseCase,
    requestClientReader: RequestClientReader,
    clock: ClockPort,
  ) {
    this.#refreshPushTimezoneUseCase = refreshPushTimezoneUseCase;
    this.#requestClientReader = requestClientReader;
    this.#clock = clock;
    this.#seen = new LRUCache({
      max: TIMEZONE_SELF_HEAL_MAX_ENTRIES,
      ttl: TIMEZONE_SELF_HEAL_TTL_MS,
      // 스로틀 판단과 같은 시계로 만료를 재고, 시각을 타이머로 캐시하지 않는다
      perf: { now: () => this.#clock.now().epochMilliseconds },
      ttlResolution: 0,
    });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const user = context.switchToHttp().getRequest<{ user?: CurrentUserPayload }>().user;

    if (user?.userId) {
      const { timezone } = this.#requestClientReader.current();
      if (timezone != null) {
        this.#heal(user.userId, timezone);
      }
    }

    return next.handle();
  }

  #heal(userId: string, timezone: string): void {
    const now = this.#clock.now().epochMilliseconds;
    const seen = this.#seen.get(userId);

    if (seen && seen.tz === timezone && now - seen.at < TIMEZONE_SELF_HEAL_TTL_MS) {
      return;
    }

    const attempt = { tz: timezone, at: now };
    this.#seen.set(userId, attempt);

    void this.#refreshPushTimezoneUseCase.execute({ userId, timezone }).catch((error: unknown) => {
      if (this.#seen.peek(userId) === attempt) {
        this.#seen.delete(userId);
      }
      this.#logger.error({
        event: PreferenceLogEvent.TIMEZONE_HEAL_FAILED,
        userId,
        timezone,
        errorType: toErrorType(error),
      });
    });
  }
}
