import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createUserConsentRepositoryMock } from "#test/mocks/ports/user-settings.mock";

import {
  type UserConsentRecord,
  type UserConsentRepositoryPort,
} from "../../ports/settings/user-consent.repository.port.js";
import { GetConsentRecord } from "./get-consent-record.use-case.js";

const userId = "user-1";

const record: UserConsentRecord = {
  termsAgreedAt: new Date("2024-01-01T00:00:00.000Z"),
  privacyAgreedAt: new Date("2024-01-01T00:00:00.000Z"),
  agreedTermsVersion: "1.0",
  marketingAgreedAt: null,
  marketingPushAgreedAt: new Date("2024-02-01T00:00:00.000Z"),
};

describe("GetConsentRecord", () => {
  let useCase: GetConsentRecord;
  let repo: Mocked<UserConsentRepositoryPort>;

  beforeEach(async () => {
    const getConsentRecordDependencies = mockDeep<
      ConstructorParameters<typeof GetConsentRecord>[0]
    >({ consentRepository: createUserConsentRepositoryMock() });
    const unit = new GetConsentRecord(getConsentRecordDependencies);
    useCase = unit;
    repo = getConsentRecordDependencies.consentRepository;
  });

  it("원본 레코드를 그대로 반환한다(뷰 매핑 없음)", async () => {
    // Given: 리포지토리에 동의 레코드가 존재
    repo.findByUserId.mockResolvedValue(record);

    // When: 단건 조회
    const result = await useCase.execute(userId);

    // Then: Date 객체가 담긴 원본 레코드를 그대로 반환
    expect(repo.findByUserId).toHaveBeenCalledWith(userId);
    expect(result).toBe(record);
  });

  it("레코드가 없으면 null을 반환한다", async () => {
    // Given: 동의 레코드 미존재
    repo.findByUserId.mockResolvedValue(null);

    // When: 단건 조회
    const result = await useCase.execute(userId);

    // Then: null 그대로 전달
    expect(result).toBeNull();
  });
});
