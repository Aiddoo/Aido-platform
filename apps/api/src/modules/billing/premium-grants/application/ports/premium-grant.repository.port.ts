import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { PremiumGrant } from "../../domain/premium-grant.aggregate.js";

export interface ListPremiumGrantUsersToReconcileParams {
  readonly now: Temporal.Instant;
  readonly afterUserId?: UserId;
  readonly limit: number;
}

export abstract class PremiumGrantRepositoryPort {
  /** 아직 끝나지 않은 BANKED·ACTIVE 기간을 한 번에 읽는다. */
  abstract listOpenByUserId(userId: UserId): Promise<PremiumGrant[]>;
  /** 출처 키로 상태와 무관하게 읽는다. 없으면 null이다. */
  abstract findBySourceKey(sourceKey: string): Promise<PremiumGrant | null>;
  /** ENDED로 정리한 기간 중 가장 늦은 끝 시각. 없으면 null이다. */
  abstract findLastEndedAt(userId: UserId): Promise<Temporal.Instant | null>;
  /** 출처 키 하나에 기간 하나다. 지급·끊고 남은 기간을 저장하기 전에 본다. */
  abstract existsBySourceKey(sourceKey: string): Promise<boolean>;
  /** 새 기간이면 넣고, 있으면 상태·시작·끝·갱신 시각을 바꾼다. 종료 안내 시각은 건드리지 않는다. */
  abstract save(grant: PremiumGrant): Promise<void>;
  /** 바뀐 기간들의 상태·시작·끝·갱신 시각을 한 문장으로 저장한다. 종료 안내 시각은 건드리지 않는다. */
  abstract saveAll(grants: readonly PremiumGrant[]): Promise<void>;
  /**
   * 정리할 것이 있는 사용자를 userId 순으로 읽는다. 끝난 ACTIVE 기간, 스토어도 진행 중인 기간도 없는
   * BANKED 기간, 스토어가 유효한데 끝나지 않은 ACTIVE 기간(시작 전이면 다시 쌓고 진행 중이면 끊는다)이
   * 대상이다.
   */
  abstract listUserIdsToReconcile(
    params: ListPremiumGrantUsersToReconcileParams,
  ): Promise<UserId[]>;
}
