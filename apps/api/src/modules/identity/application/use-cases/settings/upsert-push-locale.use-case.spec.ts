import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createUserPreferenceRepositoryMock } from "#test/mocks/ports/user-settings.mock";

import { type UserPreferenceRepositoryPort } from "../../ports/settings/user-preference.repository.port.js";
import { UpsertPushLocale } from "./upsert-push-locale.use-case.js";

const userId = "user-1";

describe("UpsertPushLocale", () => {
  let useCase: UpsertPushLocale;
  let repo: Mocked<UserPreferenceRepositoryPort>;

  beforeEach(async () => {
    const upsertPushLocaleDependencies = mockDeep<
      ConstructorParameters<typeof UpsertPushLocale>[0]
    >({ preferenceRepository: createUserPreferenceRepositoryMock() });
    const unit = new UpsertPushLocale(upsertPushLocaleDependencies);
    useCase = unit;
    repo = upsertPushLocaleDependencies.preferenceRepository;
  });

  it("전달된 로케일을 그대로 upsertLocale에 위임한다", async () => {
    // Given: 로케일 upsert 성공
    repo.upsertLocale.mockResolvedValue(undefined);

    // When: 로케일 upsert 실행
    await useCase.execute(userId, "ko");

    // Then: userId + 로케일이 변형 없이 그대로 전달
    expect(repo.upsertLocale).toHaveBeenCalledTimes(1);
    expect(repo.upsertLocale).toHaveBeenCalledWith(userId, "ko");
  });

  it("리전 포함 로케일도 변형 없이 그대로 전달한다", async () => {
    // Given: 로케일 upsert 성공
    repo.upsertLocale.mockResolvedValue(undefined);

    // When: en-US 로케일 upsert
    await useCase.execute(userId, "en-US");

    // Then: 정규화 없이 원본 문자열 전달(정규화는 어댑터 책임)
    expect(repo.upsertLocale).toHaveBeenCalledWith(userId, "en-US");
  });
});
