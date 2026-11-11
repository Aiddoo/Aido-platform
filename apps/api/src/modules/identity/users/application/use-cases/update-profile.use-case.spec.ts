import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryAuthUserRepository } from "#test/doubles/identity/in-memory-auth-user.repository";
import { createAuthCredentialFixture } from "#test/fixtures/auth-credential.fixture";

import { UpdateProfileUseCase } from "./update-profile.use-case.js";

const profileSaveFailure = new Error("프로필 저장 실패");

class FailingProfileUserRepository extends InMemoryAuthUserRepository {
  override async updateProfile(): Promise<never> {
    throw profileSaveFailure;
  }
}

describe("UpdateProfile — 프로필 변경", () => {
  function given(userRepository?: InMemoryAuthUserRepository) {
    const fixture = createAuthCredentialFixture();
    const useCase = new UpdateProfileUseCase({
      userRepository: userRepository ?? fixture.userRepository,
      cacheService: fixture.cacheService,
      logger: fixture.logger,
    });
    fixture.cacheService.userIds.add(fixture.user.id);
    return { ...fixture, useCase };
  }

  it.each(["https://example.com/avatar.png", "scottish_fold", null])(
    "프로필 이미지 %s를 저장하고 생략한 이름은 보존하며 캐시를 비운다",
    async (profileImage) => {
      // Given
      const fixture = given();

      // When
      const result = await fixture.useCase.execute({ userId: fixture.user.id, profileImage });

      // Then
      expect(result).toEqual({ message: "프로필이 수정되었습니다.", name: "사용자", profileImage });
      expect(fixture.userRepository.profileOf(fixture.user.id)).toEqual({
        name: "사용자",
        profileImage,
      });
      expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(false);
    },
  );

  it("이름만 수정하면 저장한 이미지를 유지하고 다른 사용자 캐시에 영향이 없다", async () => {
    // Given
    const fixture = given();
    await fixture.userRepository.createProfile(UserId.reconstitute(fixture.user.id), {
      name: "사용자",
      profileImage: "scottish_fold",
    });
    fixture.cacheService.userIds.add("other-user");

    // When
    await fixture.useCase.execute({ userId: fixture.user.id, name: "새 이름" });

    // Then
    expect(fixture.userRepository.profileOf(fixture.user.id)).toEqual({
      name: "새 이름",
      profileImage: "scottish_fold",
    });
    expect(fixture.cacheService.userIds).toEqual(new Set(["other-user"]));
  });

  it("프로필 저장이 실패하면 기존 캐시를 유지하고 성공 로그를 남기지 않는다", async () => {
    // Given
    const fixture = given(new FailingProfileUserRepository());

    // When
    const pending = fixture.useCase.execute({ userId: fixture.user.id, name: "새 이름" });

    // Then
    await expect(pending).rejects.toBe(profileSaveFailure);
    expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(true);
    expect(fixture.logger.messages).toEqual([]);
  });
});
