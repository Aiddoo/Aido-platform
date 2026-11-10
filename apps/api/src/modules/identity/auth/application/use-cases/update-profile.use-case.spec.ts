import { vi } from "vitest";

import {
  AUTH_CREDENTIAL_TIME,
  createAuthCredentialFixture,
} from "#test/fixtures/auth-credential.fixture";

import { UpdateProfile } from "./update-profile.use-case.js";

describe("UpdateProfile — 프로필 변경", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AUTH_CREDENTIAL_TIME);
  });
  afterEach(() => vi.useRealTimers());

  function given(options: Parameters<typeof createAuthCredentialFixture>[0] = {}) {
    const fixture = createAuthCredentialFixture(options);
    const useCase = new UpdateProfile({
      userRepository: fixture.userRepository,
      cacheService: fixture.cacheService,
      logger: fixture.logger,
    });
    return { ...fixture, useCase };
  }

  it.each(["https://example.com/avatar.png", "scottish_fold", null])(
    "프로필 이미지 %s를 저장하고 생략한 이름은 보존하며 캐시를 비운다",
    async (profileImage) => {
      // Given
      const fixture = given();
      fixture.cacheService.userIds.add(fixture.user.id);
      // When
      const result = await fixture.useCase.execute({ userId: fixture.user.id, profileImage });
      // Then
      expect(result).toEqual({ message: "프로필이 수정되었습니다.", name: "사용자", profileImage });
      expect(fixture.userRepository.profiles.get(fixture.user.id)).toEqual({
        name: "사용자",
        profileImage,
      });
      expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(false);
    },
  );

  it("이름만 수정하면 저장한 이미지를 유지하고 다른 사용자 캐시에 영향이 없다", async () => {
    // Given
    const fixture = given();
    fixture.userRepository.profiles.set(fixture.user.id, {
      name: "사용자",
      profileImage: "scottish_fold",
    });
    fixture.cacheService.userIds.add(fixture.user.id);
    fixture.cacheService.userIds.add("other-user");
    // When
    await fixture.useCase.execute({ userId: fixture.user.id, name: "새 이름" });
    // Then
    expect(fixture.userRepository.profiles.get(fixture.user.id)).toEqual({
      name: "새 이름",
      profileImage: "scottish_fold",
    });
    expect(fixture.cacheService.userIds).toEqual(new Set(["other-user"]));
  });

  it("프로필 저장이 실패하면 기존 캐시를 유지하고 성공 로그를 남기지 않는다", async () => {
    // Given
    const fixture = given();
    fixture.cacheService.userIds.add(fixture.user.id);
    const failure = new Error("프로필 저장 실패");
    fixture.userRepository.updateProfile = async () => {
      throw failure;
    };

    // When
    const pending = fixture.useCase.execute({ userId: fixture.user.id, name: "새 이름" });

    // Then
    await expect(pending).rejects.toBe(failure);
    expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(true);
    expect(fixture.logger.log).not.toHaveBeenCalled();
  });
});
