import type { PushTokenRecord } from "../../read-models/delivery/push-token.read-model.js";
import type { FindPushTokensParams, RegisterPushTokenData } from "./notification-data.js";

export const PUSH_TOKEN_REPOSITORY = Symbol("PUSH_TOKEN_REPOSITORY");

export class PushTokenNotFoundError extends Error {
  constructor() {
    super("Push token not found");
    this.name = "PushTokenNotFoundError";
  }
}

/** 같은 토큰이 동시에 등록돼 다른 트랜잭션이 먼저 그 토큰을 가져갔다. 원인 DB 오류는 cause로 보존한다. */
export class PushTokenRegistrationConflictError extends Error {
  constructor(options?: ErrorOptions) {
    super("Push token registered concurrently", options);
    this.name = "PushTokenRegistrationConflictError";
  }
}

/** Expo 등록 토큰의 생명주기를 소유하는 영속성 포트. */
export interface PushTokenRepositoryPort {
  /**
   * 같은 기기 토큰을 다른 사용자나 다른 deviceId로 가진 등록을 지우고 그 사용자 ID를 돌려준다.
   * 이전 사용자의 해제 요청이 실패한 기기에 새 사용자가 로그인했을 때 토큰 unique 충돌과 잘못된 수신을 막는다.
   */
  releasePushTokenHeldElsewhere(
    data: Pick<RegisterPushTokenData, "userId" | "token" | "deviceId">,
  ): Promise<{ readonly userIds: readonly string[] }>;
  registerPushToken(data: RegisterPushTokenData): Promise<PushTokenRecord>;
  findPushTokensByUser(params: FindPushTokensParams): Promise<PushTokenRecord[]>;
  findActivePushTokensByUsers(userIds: string[]): Promise<PushTokenRecord[]>;
  deletePushToken(userId: string, deviceId: string): Promise<PushTokenRecord>;
  deleteAllPushTokensByUser(userId: string): Promise<{ count: number }>;
  deactivateInvalidTokens(tokens: string[]): Promise<{ count: number }>;
}
