import type { NotificationType as ContractNotificationType } from "@aido/validators";

import type { NotificationType as DomainNotificationType } from "./notification-type";

type Extends<T, U> = [T] extends [U] ? true : false;
type Expect<T extends true> = T;

type DomainMatchesContract = Expect<Extends<DomainNotificationType, ContractNotificationType>>;
type ContractMatchesDomain = Expect<Extends<ContractNotificationType, DomainNotificationType>>;

describe("NotificationType contract", () => {
	it("도메인과 공유 계약이 같은 타입 집합을 사용한다", () => {
		const domainMatchesContract: DomainMatchesContract = true;
		const contractMatchesDomain: ContractMatchesDomain = true;

		expect(domainMatchesContract && contractMatchesDomain).toBe(true);
	});
});
