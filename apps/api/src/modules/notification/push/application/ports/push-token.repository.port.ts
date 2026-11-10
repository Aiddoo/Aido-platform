import type {
  FindPushTokensParams,
  RegisterPushTokenData,
} from "../../../inbox/application/ports/notification-draft.port.js";
import type { PushTokenRecord } from "../read-models/push-token.read-model.js";

export const PUSH_TOKEN_REPOSITORY = Symbol("PUSH_TOKEN_REPOSITORY");

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
   * 이 기기(deviceId)나 이 토큰을 다른 사용자·다른 기기가 가진 등록을 지우고 그 사용자 ID를 돌려준다.
   * 이전 사용자의 해제 요청이 실패한 기기에 새 사용자가 로그인했을 때 토큰 unique 충돌과 잘못된 수신을 막는다.
   */
  releasePushTokenHeldElsewhere(data: {
    readonly userId: string;
    readonly deviceId: string;
    readonly token: string | null;
  }): Promise<{ readonly userIds: readonly string[] }>;
  registerPushToken(data: RegisterPushTokenData): Promise<PushTokenRecord>;
  findPushTokensByUser(params: FindPushTokensParams): Promise<PushTokenRecord[]>;
  findActivePushTokensByUsers(userIds: string[]): Promise<PushTokenRecord[]>;
  deletePushTokensByDevice(userId: string, deviceId: string): Promise<{ count: number }>;
  deleteAllPushTokensByUser(userId: string): Promise<{ count: number }>;
  /** 지운 토큰마다 그 사용자 ID를 하나씩 돌려준다. */
  deletePushTokensBySessions(
    sessionIds: readonly string[],
  ): Promise<{ readonly userIds: readonly string[] }>;
  deactivateInvalidTokens(tokens: string[]): Promise<{ count: number }>;
}
