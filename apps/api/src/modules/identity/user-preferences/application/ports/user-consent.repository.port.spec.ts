import { describeUserConsentRepositoryContract } from "#test/contracts/identity/user-consent-repository.contract";
import { InMemoryUserConsentRepository } from "#test/doubles/identity/in-memory-user-consent.repository";
import { USER_SETTINGS_FIXTURE_INACTIVE_USER_IDS } from "#test/fixtures/identity/user-settings.fixture";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeUserConsentRepositoryContract(
  async () =>
    new InMemoryUserConsentRepository({ inactiveUserIds: USER_SETTINGS_FIXTURE_INACTIVE_USER_IDS }),
);
