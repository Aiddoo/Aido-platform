import type { NotificationType as ContractNotificationType } from "@aido/api/vocabulary";

import type { NotificationType as DomainNotificationType } from "./notification-type.js";

type Extends<T, U> = [T] extends [U] ? true : false;
type Expect<T extends true> = T;

type DomainMatchesContract = Expect<Extends<DomainNotificationType, ContractNotificationType>>;
type ContractMatchesDomain = Expect<Extends<ContractNotificationType, DomainNotificationType>>;

describe("NotificationType — 알림 유형 계약", () => {
  it("도메인과 공유 계약이 같은 타입 집합을 사용한다", () => {
    const domainMatchesContract: DomainMatchesContract = true;
    const contractMatchesDomain: ContractMatchesDomain = true;

    expect(domainMatchesContract && contractMatchesDomain).toBe(true);
  });
});
