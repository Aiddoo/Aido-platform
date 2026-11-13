import { MemoIdempotencyKeyTakenError } from "#api/modules/notes/memos/application/memos.errors";
import type { MemoRepositoryPort } from "#api/modules/notes/memos/application/ports/memo.repository.port";
import type { Memo, MemoPrimitives } from "#api/modules/notes/memos/domain/memo.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createMemoFixture,
  MEMO_FIXTURE_NOW,
  MEMO_FIXTURE_OTHER_USER_ID,
  MEMO_FIXTURE_USER_ID,
} from "#test/fixtures/notes/memo.fixture";

const USER_ID = UserId.reconstitute(MEMO_FIXTURE_USER_ID);
const OTHER_USER_ID = UserId.reconstitute(MEMO_FIXTURE_OTHER_USER_ID);
const LATER = MEMO_FIXTURE_NOW.add({ minutes: 1 });

async function saveMemo(
  repository: MemoRepositoryPort,
  overrides: Partial<MemoPrimitives> = {},
): Promise<Memo> {
  const memo = createMemoFixture({ id: (await repository.nextId()).value, ...overrides });
  await repository.save(memo);
  return memo;
}

export function describeMemoRepositoryContract(
  createRepository: () => Promise<MemoRepositoryPort>,
): void {
  describe("메모 저장소 계약", () => {
    it("nextId는 부를 때마다 다른 id를 준다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const ids = [await repository.nextId(), await repository.nextId()];

      // Then
      expect(ids[0]?.equals(ids[1] ?? ids[0])).toBe(false);
    });

    it("저장한 메모는 주인에게만 보이고 다시 저장하면 생성 시각을 두고 나머지를 덮어쓴다", async () => {
      // Given
      const repository = await createRepository();
      const memo = await saveMemo(repository, { content: "처음 내용", sortOrder: 3 });
      const changed = createMemoFixture({
        ...memo.toPrimitives(),
        content: "바뀐 내용",
        isPinned: true,
        sortOrder: 0,
        updatedAt: LATER,
      });

      // When
      await repository.save(changed);
      const found = await repository.findByIdAndUserId(memo.id, USER_ID);
      const foreign = await repository.findByIdAndUserId(memo.id, OTHER_USER_ID);

      // Then
      expect(found?.toPrimitives()).toEqual(changed.toPrimitives());
      expect(foreign).toBeNull();
    });

    it("Idempotency-Key로는 그 사용자가 그 키로 만든 메모만 찾는다", async () => {
      // Given
      const repository = await createRepository();
      const memo = await saveMemo(repository, { idempotencyKey: "memo-create-1" });
      await saveMemo(repository, { idempotencyKey: null });
      await saveMemo(repository, {
        userId: MEMO_FIXTURE_OTHER_USER_ID,
        idempotencyKey: "memo-create-2",
      });

      // When
      const found = await repository.findByIdempotencyKey(USER_ID, "memo-create-1");
      const foreign = await repository.findByIdempotencyKey(USER_ID, "memo-create-2");

      // Then
      expect(found?.toPrimitives()).toEqual(memo.toPrimitives());
      expect(foreign).toBeNull();
    });

    it("같은 사용자의 같은 Idempotency-Key로 다른 메모를 저장하면 MemoIdempotencyKeyTakenError다", async () => {
      // Given
      const repository = await createRepository();
      await saveMemo(repository, { idempotencyKey: "memo-create-1", requestHash: "a".repeat(64) });
      const duplicate = createMemoFixture({
        id: (await repository.nextId()).value,
        idempotencyKey: "memo-create-1",
        requestHash: "a".repeat(64),
      });

      // When
      const saving = repository.save(duplicate);

      // Then
      await expect(saving).rejects.toBeInstanceOf(MemoIdempotencyKeyTakenError);
    });

    it("고정 메모가 먼저, 그다음 정렬 순서·id 내림차순으로 나열하고 after 메모 뒤부터 이어 준다", async () => {
      // Given
      const repository = await createRepository();
      const low = await saveMemo(repository, { sortOrder: 0 });
      const pinned = await saveMemo(repository, { sortOrder: 0, isPinned: true });
      const tiedOlder = await saveMemo(repository, { sortOrder: 2 });
      const tiedNewer = await saveMemo(repository, { sortOrder: 2 });
      await saveMemo(repository, { userId: MEMO_FIXTURE_OTHER_USER_ID, sortOrder: 9 });

      // When
      const firstPage = await repository.listByUserId({
        userId: USER_ID,
        afterMemoId: null,
        limit: 2,
      });
      const nextPage = await repository.listByUserId({
        userId: USER_ID,
        afterMemoId: tiedNewer.id,
        limit: 5,
      });

      // Then
      expect(firstPage.map((memo) => memo.id.value)).toEqual([pinned.id.value, tiedNewer.id.value]);
      expect(nextPage.map((memo) => memo.id.value)).toEqual([tiedOlder.id.value, low.id.value]);
    });

    it("after 메모가 없거나 남의 메모면 빈 목록이다", async () => {
      // Given
      const repository = await createRepository();
      await saveMemo(repository);
      const foreign = await saveMemo(repository, { userId: MEMO_FIXTURE_OTHER_USER_ID });
      const missingId = await repository.nextId();

      // When
      const pages = [
        await repository.listByUserId({ userId: USER_ID, afterMemoId: missingId, limit: 5 }),
        await repository.listByUserId({ userId: USER_ID, afterMemoId: foreign.id, limit: 5 }),
      ];

      // Then
      expect(pages).toEqual([[], []]);
    });

    it("개수와 최대 정렬 순서는 그 사용자 메모만 보고, 메모가 없으면 최대 순서는 null이다", async () => {
      // Given
      const repository = await createRepository();
      const emptyMax = await repository.findMaxSortOrder(USER_ID);
      await saveMemo(repository, { sortOrder: 4 });
      await saveMemo(repository, { sortOrder: 7 });
      await saveMemo(repository, { userId: MEMO_FIXTURE_OTHER_USER_ID, sortOrder: 50 });

      // When
      const count = await repository.countByUserId(USER_ID);
      const maxSortOrder = await repository.findMaxSortOrder(USER_ID);

      // Then
      expect({ emptyMax, count, maxSortOrder }).toEqual({
        emptyMax: null,
        count: 2,
        maxSortOrder: 7,
      });
    });

    it.each([
      {
        name: "닫힌 구간",
        shift: { fromSortOrder: 1, toSortOrder: 2, delta: 1 },
        expectedSortOrders: [0, 2, 3, 3, 1],
        expectedShifted: [false, true, true, false, false],
      },
      {
        name: "끝이 열린 구간",
        shift: { fromSortOrder: 2, toSortOrder: null, delta: -1 },
        expectedSortOrders: [0, 1, 1, 2, 1],
        expectedShifted: [false, false, true, true, false],
      },
    ] as const)(
      "$name 순서 밀기는 그 사용자 구간 안 메모만 옮기고 그 메모의 수정 시각을 바꾼다",
      async ({ shift, expectedSortOrders, expectedShifted }) => {
        // Given
        const repository = await createRepository();
        const memos = [];
        for (const sortOrder of [0, 1, 2, 3]) {
          memos.push(await saveMemo(repository, { sortOrder }));
        }
        memos.push(
          await saveMemo(repository, { userId: MEMO_FIXTURE_OTHER_USER_ID, sortOrder: 1 }),
        );

        // When
        await repository.shiftSortOrders(USER_ID, shift, LATER);

        // Then
        const saved = [];
        for (const memo of memos) {
          saved.push((await repository.findByIdAndUserId(memo.id, memo.userId))?.toPrimitives());
        }
        expect(saved.map((memo) => memo?.sortOrder)).toEqual(expectedSortOrders);
        expect(saved.map((memo) => memo?.updatedAt.equals(LATER))).toEqual(expectedShifted);
      },
    );

    it("지운 메모는 다시 찾을 수 없고 개수에서 빠진다", async () => {
      // Given
      const repository = await createRepository();
      const memo = await saveMemo(repository);
      await saveMemo(repository);

      // When
      await repository.delete(memo);

      // Then
      expect(await repository.findByIdAndUserId(memo.id, USER_ID)).toBeNull();
      expect(await repository.countByUserId(USER_ID)).toBe(1);
    });
  });
}
