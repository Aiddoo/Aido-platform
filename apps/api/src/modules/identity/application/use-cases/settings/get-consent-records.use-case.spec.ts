import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createUserConsentRepositoryMock } from "#test/mocks/ports/user-settings.mock";

import {
  type UserConsentRecordWithId,
  type UserConsentRepositoryPort,
} from "../../ports/settings/user-consent.repository.port.js";
import { GetConsentRecords } from "./get-consent-records.use-case.js";

const userIds = ["user-1", "user-2"];

const records: UserConsentRecordWithId[] = [
  {
    userId: "user-1",
    termsAgreedAt: new Date("2024-01-01T00:00:00.000Z"),
    privacyAgreedAt: null,
    agreedTermsVersion: "1.0",
    marketingAgreedAt: null,
    marketingPushAgreedAt: null,
  },
];

describe("GetConsentRecords", () => {
  let useCase: GetConsentRecords;
  let repo: Mocked<UserConsentRepositoryPort>;

  beforeEach(async () => {
    const getConsentRecordsDependencies = mockDeep<
      ConstructorParameters<typeof GetConsentRecords>[0]
    >({ consentRepository: createUserConsentRepositoryMock() });
    const unit = new GetConsentRecords(getConsentRecordsDependencies);
    useCase = unit;
    repo = getConsentRecordsDependencies.consentRepository;
  });

  it("사용자 ID 배열을 그대로 위임하고 레코드 배열을 반환한다", async () => {
    // Given: 배치 조회 결과 존재
    repo.findByUserIds.mockResolvedValue(records);

    // When: 배치 조회
    const result = await useCase.execute(userIds);

    // Then: userIds를 그대로 전달, 원본 레코드 배열 반환
    expect(repo.findByUserIds).toHaveBeenCalledWith(userIds);
    expect(result).toBe(records);
  });

  it("일치하는 레코드가 없으면 빈 배열을 반환한다", async () => {
    // Given: 배치 조회 결과 없음
    repo.findByUserIds.mockResolvedValue([]);

    // When: 배치 조회
    const result = await useCase.execute([]);

    // Then: 빈 배열
    expect(result).toEqual([]);
  });
});
