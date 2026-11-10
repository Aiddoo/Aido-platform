import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  CHEER_FIXTURE_NOW,
  CHEER_FIXTURE_RECEIVER_ID,
  CHEER_FIXTURE_SENDER_ID,
  createCheerFixture,
} from "#test/fixtures/social/cheer.fixture";

import { CheerId } from "./cheer-id.vo.js";
import { CheerMessage } from "./cheer-message.vo.js";
import { Cheer } from "./cheer.aggregate.js";

const SENDER_ID = UserId.reconstitute(CHEER_FIXTURE_SENDER_ID);
const RECEIVER_ID = UserId.reconstitute(CHEER_FIXTURE_RECEIVER_ID);
const LATER = CHEER_FIXTURE_NOW.add({ hours: 1 });

describe("Cheer — 응원", () => {
  it("새 응원은 안 읽은 상태로 만든 시각을 남긴다", () => {
    // When
    const cheer = Cheer.create({
      id: CheerId.reconstitute(7),
      senderId: SENDER_ID,
      receiverId: RECEIVER_ID,
      message: CheerMessage.create("화이팅"),
      now: CHEER_FIXTURE_NOW,
    });

    // Then
    expect(cheer.toPrimitives()).toEqual({
      id: 7,
      senderId: CHEER_FIXTURE_SENDER_ID,
      receiverId: CHEER_FIXTURE_RECEIVER_ID,
      message: "화이팅",
      readAt: null,
      createdAt: CHEER_FIXTURE_NOW,
    });
  });

  it("자기 자신에게는 응원을 만들지 않는다", () => {
    // When
    const create = () =>
      Cheer.create({
        id: CheerId.reconstitute(7),
        senderId: SENDER_ID,
        receiverId: SENDER_ID,
        message: null,
        now: CHEER_FIXTURE_NOW,
      });

    // Then
    expect(create).toThrow(expect.objectContaining({ errorCode: ErrorCode.CHEER_1204 }));
  });

  it("첫 읽음만 상태를 바꾸고 다시 읽어도 처음 읽은 시각을 둔다", () => {
    // Given
    const cheer = createCheerFixture();

    // When
    const first = cheer.markRead(CHEER_FIXTURE_NOW);
    const repeated = cheer.markRead(LATER);

    // Then
    expect({ first, repeated }).toEqual({ first: true, repeated: false });
    expect(cheer.readAt).toEqual(CHEER_FIXTURE_NOW);
  });

  it("이미 읽은 저장 상태는 복원 뒤에도 다시 바뀌지 않는다", () => {
    // Given
    const cheer = createCheerFixture({ readAt: CHEER_FIXTURE_NOW });

    // When
    const changed = cheer.markRead(LATER);

    // Then
    expect(changed).toBe(false);
    expect(cheer.readAt).toEqual(CHEER_FIXTURE_NOW);
  });

  it("받은 사람만 그 응원의 주인이다", () => {
    // Given
    const cheer = createCheerFixture();

    // When
    const owners = [RECEIVER_ID, SENDER_ID].map((userId) => cheer.isReceivedBy(userId));

    // Then
    expect(owners).toEqual([true, false]);
  });
});
