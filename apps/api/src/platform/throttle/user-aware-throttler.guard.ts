import { type ExecutionContext, Injectable, SetMetadata } from "@nestjs/common";
import { ThrottlerGuard, type ThrottlerRequest } from "@nestjs/throttler";

const THROTTLE_BY_USER_KEY = "aido:throttle-by-user";

/**
 * 인증한 사용자 ID로 요청 수를 센다. 통신사 CGNAT처럼 IP를 나눠 쓰는 사용자끼리 서로의 한도를
 * 쓰지 않고, 한 사용자가 IP를 바꿔도 한도를 피하지 못하게 한다. 인증 전 요청은 IP로 센다.
 */
export const ThrottleByUser = (): MethodDecorator & ClassDecorator =>
  SetMetadata(THROTTLE_BY_USER_KEY, true);

function authenticatedUserId(request: Record<string, unknown>): string | null {
  const { user } = request;
  if (typeof user !== "object" || user === null || !("userId" in user)) return null;
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
        return userId === null ? ipTracker(request, context) : `user:${userId}`;
      },
    });
  }

  #isThrottledByUser(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean | undefined>(THROTTLE_BY_USER_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}
