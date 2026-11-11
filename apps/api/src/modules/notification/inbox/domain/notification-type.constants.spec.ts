import type { NotificationType as ContractNotificationType } from "@aido/api/vocabulary";

import type { NotificationType as DomainNotificationType } from "./notification-type.constants.js";

type Extends<T, U> = [T] extends [U] ? true : false;
type Expect<T extends true> = T;

/** 앱 계약에 없고 앱에는 SYSTEM_NOTICE로 보내는 서버 전용 타입 */
type ServerOnlyNotificationType = "PREMIUM_TRIAL_ENDING" | "PREMIUM_RENEWAL_UPCOMING";

type DomainMatchesContract = Expect<
  Extends<Exclude<DomainNotificationType, ServerOnlyNotificationType>, ContractNotificationType>
>;
type ContractMatchesDomain = Expect<Extends<ContractNotificationType, DomainNotificationType>>;

describe("NotificationType — 알림 유형 계약", () => {
  it("도메인은 공유 계약 타입 집합에 서버 전용 타입만 더한다", () => {
    const domainMatchesContract: DomainMatchesContract = true;
    const contractMatchesDomain: ContractMatchesDomain = true;

    expect(domainMatchesContract && contractMatchesDomain).toBe(true);
  });
});
