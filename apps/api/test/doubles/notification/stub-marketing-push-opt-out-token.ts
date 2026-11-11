import { MarketingPushOptOutTokenPort } from "#api/modules/notification/push/application/ports/marketing-push-opt-out-token.port";

// 서명하지 않고 "opt-out:<userId>"를 토큰으로 준다. verify는 등록한 토큰만 사용자로 푼다
export class StubMarketingPushOptOutToken extends MarketingPushOptOutTokenPort {
  readonly issuedUserIds: string[] = [];
  readonly #userIdsByToken = new Map<string, string>();

  issue(userId: string): string {
    this.issuedUserIds.push(userId);
    const token = `opt-out:${userId}`;
    this.#userIdsByToken.set(token, userId);
    return token;
  }

  verify(token: string): string | null {
    return this.#userIdsByToken.get(token) ?? null;
  }

  // 다른 서명 키로 발급된 토큰처럼 사용자를 바로 풀 수 있게 등록한다
  register(token: string, userId: string): void {
    this.#userIdsByToken.set(token, userId);
  }
}
