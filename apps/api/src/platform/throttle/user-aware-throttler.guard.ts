import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { HttpRequest } from "../http/http-request.js";
import { readRequestUserId } from "../http/request-user-id.js";

// 인증한 요청은 사용자 id로 센다. 통신사 NAT로 IP를 나눠 쓰는 사용자끼리 한도를 나누지 않고 IP를 바꿔도 피하지 못한다(JwtAuthGuard 다음에 돈다)
@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(request: HttpRequest): Promise<string> {
    const userId = readRequestUserId(request);
    return userId == null ? super.getTracker(request) : `user:${userId}`;
  }
}
