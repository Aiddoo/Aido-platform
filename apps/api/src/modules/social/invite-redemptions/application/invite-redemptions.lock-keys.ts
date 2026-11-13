import { MUTATION_KEY_PREFIX } from "#api/shared/application/ports/mutation-lock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 문자열을 바꾸면 배포가 겹치는 동안 이전 버전과 다른 잠금을 잡으므로 바이트 단위로 유지한다
export const InviteRedemptionLockKeys = {
  // 같은 초대한 사람의 보상 상한을 여러 사용 시작이 동시에 읽지 않게 한다
  rewardLedger: (inviterId: UserId): string =>
    `${MUTATION_KEY_PREFIX}:invite-reward-ledger:${inviterId.value}`,
} as const;
