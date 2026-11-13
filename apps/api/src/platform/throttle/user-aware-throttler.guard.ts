import { applyDecorators, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  Throttle,
  ThrottlerGuard,
  type ThrottlerOptions,
  type ThrottlerRequest,
} from "@nestjs/throttler";

/**
 * 인증한 사용자 ID로 요청 수를 센다. 통신사 CGNAT처럼 IP를 나눠 쓰는 사용자끼리 서로의 한도를
 * 쓰지 않고, 한 사용자가 IP를 바꿔도 한도를 피하지 못하게 한다. 인증 전 요청은 IP로 센다.
 */
export const ThrottleByUser = Reflector.createDecorator<void, true>({ transform: () => true });

const DAILY_THROTTLER = "daily";
const DAY_MS = 24 * 60 * 60 * 1000;
const DailyThrottled = Reflector.createDecorator<void, true>({ transform: () => true });

/** 분당 한도와 함께 하루 한도도 세는 라우트. 붙이지 않은 라우트는 하루 한도를 세지 않는다. */
export const ThrottleDaily = (limit: number): MethodDecorator & ClassDecorator =>
  applyDecorators(DailyThrottled(), Throttle({ [DAILY_THROTTLER]: { ttl: DAY_MS, limit } }));

// throttler 옵션은 DI 밖의 값이라 Reflector를 주입받지 못한다. Reflector는 의존성이 없어 직접 만든다
const optionsReflector = new Reflector();

/** ThrottlerModule에 등록하는 하루 한도 throttler. 한도는 ThrottleDaily가 라우트마다 정한다. */
export const DAILY_THROTTLER_OPTIONS: ThrottlerOptions = {
  name: DAILY_THROTTLER,
  ttl: DAY_MS,
  limit: Number.MAX_SAFE_INTEGER,
  skipIf: (context) =>
    optionsReflector.getAllAndOverride(DailyThrottled, [
      context.getHandler(),
      context.getClass(),
    ]) !== true,
};

function authenticatedUserId(request: Record<string, unknown>): string | null {
  const { user } = request;
  if (typeof user !== "object" || user == null || !("userId" in user)) {
    return null;
  }
  return typeof user.userId === "string" ? user.userId : null;
}

/** 전역 ThrottlerGuard. JwtAuthGuard 다음에 돌므로 request.user를 읽을 수 있다. */
@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected override async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    if (!this.#isThrottledByUser(requestProps.context)) {
      return super.handleRequest(requestProps);
    }
    const ipTracker = requestProps.getTracker;
    return super.handleRequest({
      ...requestProps,
      getTracker: async (request, context) => {
        const userId = authenticatedUserId(request);
        return userId == null ? ipTracker(request, context) : `user:${userId}`;
      },
    });
  }

  #isThrottledByUser(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride(ThrottleByUser, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}
