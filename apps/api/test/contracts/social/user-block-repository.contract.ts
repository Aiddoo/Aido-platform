import type { UserBlockRepositoryPort } from "#api/modules/social/blocks/application/ports/user-block.repository.port";
import { UserBlockId } from "#api/modules/social/blocks/domain/user-block-id.vo";
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

async function saveBlock(
  repository: UserBlockRepositoryPort,
  overrides: Partial<UserBlockPrimitives> = {},
): Promise<UserBlock> {
  const block = createUserBlockFixture({ id: UserBlockId.generate().value, ...overrides });
  await repository.save(block);
  return block;
}

// 세 fixture 사용자가 활성 사용자로 있는 저장소를 만든다
export function describeUserBlockRepositoryContract(
  createRepository: () => Promise<UserBlockRepositoryPort>,
): void {
  describe("사용자 차단 저장소 계약", () => {
    it("저장한 차단은 차단한 방향으로만 찾고, 같은 차단을 다시 저장해도 그대로다", async () => {
      // Given
      const repository = await createRepository();
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
      const repository = await createRepository();
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
      const repository = await createRepository();

      // When
      const exists = [
        await repository.existsActiveUser(BLOCKED_ID),
        await repository.existsActiveUser(MISSING_USER_ID),
      ];

      // Then
      expect(exists).toEqual([true, false]);
    });
  });
}
