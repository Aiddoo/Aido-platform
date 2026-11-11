import type { UserBlockRepositoryPort } from "#api/modules/social/blocks/application/ports/user-block.repository.port";
import type {
  UserBlock,
  UserBlockPrimitives,
} from "#api/modules/social/blocks/domain/user-block.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createUserBlockFixture,
  USER_BLOCK_FIXTURE_BLOCKED_ID,
  USER_BLOCK_FIXTURE_BLOCKER_ID,
  USER_BLOCK_FIXTURE_OTHER_USER_ID,
} from "#test/fixtures/social/user-block.fixture";

const BLOCKER_ID = UserId.reconstitute(USER_BLOCK_FIXTURE_BLOCKER_ID);
const BLOCKED_ID = UserId.reconstitute(USER_BLOCK_FIXTURE_BLOCKED_ID);
const OTHER_USER_ID = UserId.reconstitute(USER_BLOCK_FIXTURE_OTHER_USER_ID);
const MISSING_USER_ID = UserId.reconstitute("clz7x5p8k0999qz0z8z8z8z8z");

// 세 fixture 사용자가 활성 사용자로 있는 저장소와, 두 사람 사이 follow 행을 넣는 방법
export interface UserBlockRepositoryContractSubject {
  readonly repository: UserBlockRepositoryPort;
  readonly seedFollow: (followerId: string, followingId: string) => Promise<void>;
}

async function saveBlock(
  repository: UserBlockRepositoryPort,
  overrides: Partial<UserBlockPrimitives> = {},
): Promise<UserBlock> {
  const block = createUserBlockFixture({ id: (await repository.nextId()).value, ...overrides });
  await repository.save(block);
  return block;
}

export function describeUserBlockRepositoryContract(
  createSubject: () => Promise<UserBlockRepositoryContractSubject>,
): void {
  describe("사용자 차단 저장소 계약", () => {
    it("nextId는 부를 때마다 다른 id를 준다", async () => {
      // Given
      const { repository } = await createSubject();

      // When
      const ids = [await repository.nextId(), await repository.nextId()];

      // Then
      expect(ids[0]?.equals(ids[1] ?? ids[0])).toBe(false);
    });

    it("저장한 차단은 차단한 방향으로만 찾고, 같은 차단을 다시 저장해도 그대로다", async () => {
      // Given
      const { repository } = await createSubject();
      const block = await saveBlock(repository);

      // When
      await repository.save(block);
      const found = await repository.findByPair(BLOCKER_ID, BLOCKED_ID);
      const reversed = await repository.findByPair(BLOCKED_ID, BLOCKER_ID);

      // Then
      expect(found?.toPrimitives()).toEqual(block.toPrimitives());
      expect(reversed).toBeNull();
    });

    it("지운 차단은 다시 찾을 수 없고 다른 차단은 남는다", async () => {
      // Given
      const { repository } = await createSubject();
      const block = await saveBlock(repository);
      const other = await saveBlock(repository, { blockedId: USER_BLOCK_FIXTURE_OTHER_USER_ID });

      // When
      await repository.delete(block);

      // Then
      expect(await repository.findByPair(BLOCKER_ID, BLOCKED_ID)).toBeNull();
      expect((await repository.findByPair(BLOCKER_ID, OTHER_USER_ID))?.id.value).toBe(
        other.id.value,
      );
    });

    it("활성 사용자는 있다고 보고 없는 사용자는 없다고 본다", async () => {
      // Given
      const { repository } = await createSubject();

      // When
      const exists = [
        await repository.existsActiveUser(BLOCKED_ID),
        await repository.existsActiveUser(MISSING_USER_ID),
      ];

      // Then
      expect(exists).toEqual([true, false]);
    });

    it("두 사람 사이 follow 행을 방향과 상관없이 지우고 지운 수를 돌려주며 다른 사람과의 행은 남긴다", async () => {
      // Given
      const { repository, seedFollow } = await createSubject();
      await seedFollow(USER_BLOCK_FIXTURE_BLOCKER_ID, USER_BLOCK_FIXTURE_BLOCKED_ID);
      await seedFollow(USER_BLOCK_FIXTURE_BLOCKED_ID, USER_BLOCK_FIXTURE_BLOCKER_ID);
      await seedFollow(USER_BLOCK_FIXTURE_BLOCKER_ID, USER_BLOCK_FIXTURE_OTHER_USER_ID);

      // When
      const removedBetween = await repository.removeFriendshipsBetween(BLOCKED_ID, BLOCKER_ID);
      const removedAgain = await repository.removeFriendshipsBetween(BLOCKER_ID, BLOCKED_ID);
      const removedOther = await repository.removeFriendshipsBetween(BLOCKER_ID, OTHER_USER_ID);

      // Then
      expect({ removedBetween, removedAgain, removedOther }).toEqual({
        removedBetween: 2,
        removedAgain: 0,
        removedOther: 1,
      });
    });
  });
}
