import { MUTATION_KEY_PREFIX } from "#api/shared/application/ports/mutation-lock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 문자열은 옮기기 전 공용 신고 잠금 키와 같아야 배포 중 옛 버전과 같은 잠금을 잡는다
export const UserReportLockKeys = {
  reporter: (reporterId: UserId): string =>
    `${MUTATION_KEY_PREFIX}:user-report:${reporterId.value}`,
} as const;
