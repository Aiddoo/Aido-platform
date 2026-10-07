import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createUserPreferenceRepositoryMock } from "#test/mocks/ports/user-settings.mock";

import {
  type UserPreferenceRecordWithId,
  type UserPreferenceRepositoryPort,
} from "../../ports/settings/user-preference.repository.port.js";
import { GetPreferenceRecords } from "./get-preference-records.use-case.js";

const userIds = ["user-1", "user-2"];

const records: UserPreferenceRecordWithId[] = [
  {
    userId: "user-1",
    pushEnabled: true,
    nightPushEnabled: true,
    timezone: "Asia/Seoul",
    locale: "ko",
    morningReminderHour: 7,
    morningReminderMinute: 30,
    eveningReminderHour: 18,
    eveningReminderMinute: 0,
    timeFormat: "TWELVE_HOUR",
    weatherMorningEnabled: true,
    weatherMorningHour: 7,
    weatherMorningMinute: 0,
    weatherEveningEnabled: true,
    weatherEveningHour: 17,
    weatherEveningMinute: 30,
    currentStreak: 0,
    longestStreak: 0,
    lastCompletedDate: null,
  },
];

describe("GetPreferenceRecords", () => {
  let useCase: GetPreferenceRecords;
  let repo: Mocked<UserPreferenceRepositoryPort>;

  beforeEach(async () => {
    const getPreferenceRecordsDependencies = mockDeep<
      ConstructorParameters<typeof GetPreferenceRecords>[0]
    >({ preferenceRepository: createUserPreferenceRepositoryMock() });
    const unit = new GetPreferenceRecords(getPreferenceRecordsDependencies);
    useCase = unit;
    repo = getPreferenceRecordsDependencies.preferenceRepository;
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
