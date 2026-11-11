import type { CheerReaderPort } from "#api/modules/social/cheers/application/ports/cheer.reader.port";
import type { CheerRepositoryPort } from "#api/modules/social/cheers/application/ports/cheer.repository.port";
import type { Cheer, CheerPrimitives } from "#api/modules/social/cheers/domain/cheer.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  CHEER_FIXTURE_NOW,
  CHEER_FIXTURE_OTHER_USER_ID,
  CHEER_FIXTURE_RECEIVER_ID,
  CHEER_FIXTURE_SENDER_ID,
  createCheerFixture,
} from "#test/fixtures/social/cheer.fixture";

type CheerStore = CheerRepositoryPort & CheerReaderPort;

const SENDER_ID = UserId.reconstitute(CHEER_FIXTURE_SENDER_ID);
const RECEIVER_ID = UserId.reconstitute(CHEER_FIXTURE_RECEIVER_ID);
const OTHER_USER_ID = UserId.reconstitute(CHEER_FIXTURE_OTHER_USER_ID);
const LATER = CHEER_FIXTURE_NOW.add({ minutes: 1 });

async function saveCheer(
  repository: CheerStore,
  overrides: Partial<CheerPrimitives> = {},
): Promise<Cheer> {
  const cheer = createCheerFixture({ id: (await repository.nextId()).value, ...overrides });
  await repository.save(cheer);
  return cheer;
}

function idsOf(cheers: readonly { readonly id: number }[]): number[] {
  return cheers.map((cheer) => cheer.id);
}

export function describeCheerRepositoryContract(createRepository: () => Promise<CheerStore>): void {
  describe("응원 저장소 계약", () => {
    it("nextId는 부를 때마다 다른 id를 준다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const ids = [await repository.nextId(), await repository.nextId()];

      // Then
      expect(ids[0]?.equals(ids[1] ?? ids[0])).toBe(false);
    });

    it("저장한 응원을 그대로 읽고 다시 저장하면 읽음 시각을 바꾼다", async () => {
      // Given
      const repository = await createRepository();
      const cheer = await saveCheer(repository, { message: "화이팅" });
      const read = createCheerFixture({ ...cheer.toPrimitives(), readAt: LATER });

      // When
      const saved = await repository.findById(cheer.id);
      await repository.save(read);
      const updated = await repository.findById(cheer.id);
      const missing = await repository.findById(await repository.nextId());

      // Then
      expect(saved?.toPrimitives()).toEqual(cheer.toPrimitives());
      expect(updated?.toPrimitives()).toEqual(read.toPrimitives());
      expect(missing).toBeNull();
    });

    it("같은 친구에게 보낸 응원 중 가장 늦게 만든 것을 찾고 다른 친구에게 보낸 것은 보지 않는다", async () => {
      // Given
      const repository = await createRepository();
      const emptyBefore = await repository.findLastSent(SENDER_ID, RECEIVER_ID);
      await saveCheer(repository, { createdAt: CHEER_FIXTURE_NOW });
      const latest = await saveCheer(repository, { createdAt: LATER });
      await saveCheer(repository, {
        receiverId: CHEER_FIXTURE_OTHER_USER_ID,
        createdAt: LATER.add({ hours: 1 }),
      });

      // When
      const last = await repository.findLastSent(SENDER_ID, RECEIVER_ID);

      // Then
      expect(emptyBefore).toBeNull();
      expect(last?.id.value).toBe(latest.id.value);
    });

    it("보낸 수는 시작 시각을 포함하고 끝 시각을 빼며 그 사람이 보낸 응원만 센다", async () => {
      // Given
      const repository = await createRepository();
      const startsAt = CHEER_FIXTURE_NOW;
      const endsAt = CHEER_FIXTURE_NOW.add({ hours: 24 });
      for (const createdAt of [
        startsAt.subtract({ milliseconds: 1 }),
        startsAt,
        endsAt.subtract({ milliseconds: 1 }),
        endsAt,
      ]) {
        await saveCheer(repository, { createdAt });
      }
      await saveCheer(repository, { senderId: CHEER_FIXTURE_OTHER_USER_ID, createdAt: startsAt });

      // When
      const used = await repository.countSentBetween(SENDER_ID, { startsAt, endsAt });

      // Then
      expect(used).toBe(2);
    });

    it("여러 응원 읽음은 받은 사람의 안 읽은 응원만 한 번씩 바꾸고 바꾼 수를 준다", async () => {
      // Given
      const repository = await createRepository();
      const unread = await saveCheer(repository);
      const alreadyRead = await saveCheer(repository, { readAt: CHEER_FIXTURE_NOW });
      const foreign = await saveCheer(repository, { receiverId: CHEER_FIXTURE_OTHER_USER_ID });
      const missingId = await repository.nextId();

      // When
      const count = await repository.markManyRead({
        receiverId: RECEIVER_ID,
        cheerIds: [unread.id, unread.id, alreadyRead.id, foreign.id, missingId],
        now: LATER,
      });
      const repeated = await repository.markManyRead({
        receiverId: RECEIVER_ID,
        cheerIds: [unread.id],
        now: LATER.add({ minutes: 1 }),
      });
      const empty = await repository.markManyRead({
        receiverId: RECEIVER_ID,
        cheerIds: [],
        now: LATER,
      });

      // Then
      expect({ count, repeated, empty }).toEqual({ count: 1, repeated: 0, empty: 0 });
      expect((await repository.findById(unread.id))?.readAt).toEqual(LATER);
      expect((await repository.findById(alreadyRead.id))?.readAt).toEqual(CHEER_FIXTURE_NOW);
      expect((await repository.findById(foreign.id))?.readAt).toBeNull();
    });

    it("받은 응원은 생성 시각·id 내림차순이고 after 응원 뒤부터 이어 주며 남의 응원은 빼고 센다", async () => {
      // Given
      const repository = await createRepository();
      const oldest = await saveCheer(repository, { createdAt: CHEER_FIXTURE_NOW });
      const tiedOlder = await saveCheer(repository, { createdAt: LATER, readAt: LATER });
      const tiedNewer = await saveCheer(repository, { createdAt: LATER });
      await saveCheer(repository, {
        receiverId: CHEER_FIXTURE_OTHER_USER_ID,
        createdAt: LATER.add({ hours: 1 }),
      });

      // When
      const firstPage = await repository.listReceived({
        userId: RECEIVER_ID,
        afterCheerId: null,
        limit: 2,
      });
      const nextPage = await repository.listReceived({
        userId: RECEIVER_ID,
        afterCheerId: tiedOlder.id,
        limit: 5,
      });
      const counts = {
        received: await repository.countReceived(RECEIVER_ID),
        unread: await repository.countUnreadReceived(RECEIVER_ID),
      };

      // Then
      expect(idsOf(firstPage)).toEqual([tiedNewer.id.value, tiedOlder.id.value]);
      expect(idsOf(nextPage)).toEqual([oldest.id.value]);
      expect(firstPage[0]).toMatchObject({
        senderId: CHEER_FIXTURE_SENDER_ID,
        receiverId: CHEER_FIXTURE_RECEIVER_ID,
        sender: { id: CHEER_FIXTURE_SENDER_ID },
        receiver: { id: CHEER_FIXTURE_RECEIVER_ID },
      });
      expect(counts).toEqual({ received: 3, unread: 2 });
    });

    it("보낸 응원은 보낸 사람 것만 나열·세고 after 응원이 없으면 빈 목록이다", async () => {
      // Given
      const repository = await createRepository();
      const first = await saveCheer(repository, { createdAt: CHEER_FIXTURE_NOW });
      const second = await saveCheer(repository, {
        receiverId: CHEER_FIXTURE_OTHER_USER_ID,
        createdAt: LATER,
      });
      await saveCheer(repository, {
        senderId: CHEER_FIXTURE_OTHER_USER_ID,
        receiverId: CHEER_FIXTURE_SENDER_ID,
      });

      // When
      const sent = await repository.listSent({ userId: SENDER_ID, afterCheerId: null, limit: 5 });
      const afterMissing = await repository.listSent({
        userId: SENDER_ID,
        afterCheerId: await repository.nextId(),
        limit: 5,
      });

      // Then
      expect(idsOf(sent)).toEqual([second.id.value, first.id.value]);
      expect(await repository.countSent(SENDER_ID)).toBe(2);
      expect(await repository.countSent(OTHER_USER_ID)).toBe(1);
      expect(afterMissing).toEqual([]);
    });
  });
}
