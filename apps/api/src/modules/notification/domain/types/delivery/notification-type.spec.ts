import type { NotificationType as ContractNotificationType } from "@aido/api/vocabulary";

import {
  isPersistedNotificationType,
  type NotificationType as DomainNotificationType,
  UNPERSISTED_NOTIFICATION_TYPES,
} from "./notification-type.js";

type Extends<T, U> = [T] extends [U] ? true : false;
type Expect<T extends true> = T;

type DomainMatchesContract = Expect<Extends<DomainNotificationType, ContractNotificationType>>;
type ContractMatchesDomain = Expect<
  Extends<
    Exclude<ContractNotificationType, (typeof UNPERSISTED_NOTIFICATION_TYPES)[number]>,
    DomainNotificationType
  >
>;
type UnpersistedIsContractOnly = Expect<
  Extends<
    (typeof UNPERSISTED_NOTIFICATION_TYPES)[number],
    Exclude<ContractNotificationType, DomainNotificationType>
  >
>;

describe("NotificationType — 알림 유형 계약", () => {
  it("도메인과 공유 계약이 저장 전 타입을 뺀 같은 타입 집합을 사용한다", () => {
    // Given
    const domainMatchesContract: DomainMatchesContract = true;
    const contractMatchesDomain: ContractMatchesDomain = true;
    const unpersistedIsContractOnly: UnpersistedIsContractOnly = true;

    // When
    const result = domainMatchesContract && contractMatchesDomain && unpersistedIsContractOnly;

    // Then
    expect(result).toBe(true);
  });

  it("저장소에 아직 없는 알림 타입은 조회 조건에서 뺀다", () => {
    // Given
    const types: ContractNotificationType[] = [
      "INVITE_JOINED",
      "FOLLOW_NEW",
      "PREMIUM_GRANT_ENDING",
    ];

    // When
    const persisted = types.filter(isPersistedNotificationType);

    // Then
    expect(persisted).toEqual(["FOLLOW_NEW"]);
  });
});
