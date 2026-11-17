import { applyDecorators } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Throttle, type ThrottlerOptions } from "@nestjs/throttler";

import { DAY_MS, HOUR_MS, MINUTE_MS } from "#api/shared/domain/time/time-units";

const DAILY_THROTTLER = "daily";

interface PerMinuteLimit {
  readonly limitPerMinute: number;
  readonly limitPerHour?: never;
}

interface PerHourLimit {
  readonly limitPerHour: number;
  readonly limitPerMinute?: never;
}

// 짧은 창은 분·시간 중 하나만 고르고, 하루 한도는 그 위에 따로 더 센다
type RateLimitDefinition = (PerMinuteLimit | PerHourLimit) & { readonly limitPerDay?: number };

export function defineRateLimits<
  const TLimits extends Readonly<Record<string, RateLimitDefinition>>,
>(limits: TLimits): Readonly<TLimits> {
  for (const limit of Object.values(limits)) {
    Object.freeze(limit);
  }
  return Object.freeze(limits);
}

const CountsDailyLimit = Reflector.createDecorator<void, true>({ transform: () => true });

// throttler 옵션은 DI 밖의 값이라 Reflector를 주입받지 못한다. Reflector는 의존성이 없어 직접 만든다
const optionsReflector = new Reflector();

// limitPerDay가 없는 라우트는 하루 한도를 세지 않는다
export const DAILY_THROTTLER_OPTIONS: ThrottlerOptions = {
  name: DAILY_THROTTLER,
  ttl: DAY_MS,
  limit: Number.MAX_SAFE_INTEGER,
  skipIf: (context) =>
    optionsReflector.getAllAndOverride(CountsDailyLimit, [
      context.getHandler(),
      context.getClass(),
    ]) !== true,
};

export function RateLimit(limit: RateLimitDefinition): MethodDecorator & ClassDecorator {
  const window =
    limit.limitPerMinute == null
      ? { ttl: HOUR_MS, limit: limit.limitPerHour }
      : { ttl: MINUTE_MS, limit: limit.limitPerMinute };
  if (limit.limitPerDay == null) {
    return Throttle({ default: window });
  }
  return applyDecorators(
    CountsDailyLimit(),
    Throttle({ default: window, [DAILY_THROTTLER]: { ttl: DAY_MS, limit: limit.limitPerDay } }),
  );
}
