import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createNudgeFixture,
  NUDGE_FIXTURE_NOW,
  NUDGE_FIXTURE_RECEIVER_ID,
  NUDGE_FIXTURE_SENDER_ID,
} from "#test/fixtures/social/nudge.fixture";

import { NudgeMessage } from "../../shared/domain/nudge-message.vo.js";
import { NudgeId } from "./nudge-id.vo.js";
import { Nudge } from "./nudge.aggregate.js";

const SENDER_ID = UserId.reconstitute(NUDGE_FIXTURE_SENDER_ID);
const RECEIVER_ID = UserId.reconstitute(NUDGE_FIXTURE_RECEIVER_ID);
const REPLIED_AT = NUDGE_FIXTURE_NOW.add({ hours: 1 });
const UPDATED_AT = NUDGE_FIXTURE_NOW.add({ hours: 2 });

describe("Nudge — 콕", () => {
  it("새 콕은 읽음·답장·감사 없이 만든 시각을 남긴다", () => {
    // When
    const nudge = Nudge.create({
      id: NudgeId.reconstitute(3),
      senderId: SENDER_ID,
      receiverId: RECEIVER_ID,
      todoId: 10,
      message: NudgeMessage.create("같이 해요"),
      now: NUDGE_FIXTURE_NOW,
    });

    // Then
    expect(nudge.toPrimitives()).toEqual({
      id: 3,
      senderId: NUDGE_FIXTURE_SENDER_ID,
      receiverId: NUDGE_FIXTURE_RECEIVER_ID,
      todoId: 10,
      message: "같이 해요",
      readAt: null,
      createdAt: NUDGE_FIXTURE_NOW,
      replyKind: null,
      repliedAt: null,
      replyUpdatedAt: null,
      thankedAt: null,
    });
    expect([nudge.isReceivedBy(RECEIVER_ID), nudge.isReceivedBy(SENDER_ID)]).toEqual([true, false]);
  });

  it("자기 자신에게 보내는 콕은 만들지 않는다", () => {
    // When
    const create = () =>
      Nudge.create({
        id: NudgeId.reconstitute(3),
        senderId: SENDER_ID,
        receiverId: SENDER_ID,
        todoId: 10,
        message: null,
        now: NUDGE_FIXTURE_NOW,
      });

    // Then
    expect(create).toThrow(expect.objectContaining({ errorCode: ErrorCode.NUDGE_1104 }));
  });

  it("읽음은 처음 한 번만 바뀌고 처음 시각을 둔다", () => {
    // Given
    const nudge = createNudgeFixture();

    // When
    const first = nudge.markRead(REPLIED_AT);
    const second = nudge.markRead(UPDATED_AT);

    // Then
    expect({ first, second }).toEqual({ first: true, second: false });
    expect(nudge.readAt).toEqual(REPLIED_AT);
  });

  it("첫 답장은 답장·변경·읽음 시각을 함께 남긴다", () => {
    // Given
    const nudge = createNudgeFixture();

    // When
    const changed = nudge.reply("STARTING", REPLIED_AT);

    // Then
    expect(changed).toBe(true);
    expect(nudge.toPrimitives()).toMatchObject({
      replyKind: "STARTING",
      repliedAt: REPLIED_AT,
      replyUpdatedAt: REPLIED_AT,
      readAt: REPLIED_AT,
      thankedAt: null,
    });
    expect(nudge.hasReplied()).toBe(true);
  });

  it("같은 답장은 바꾸지 않고, 다른 답장은 첫 답장·읽음 시각을 두고 변경 시각만 바꾼다", () => {
    // Given
    const nudge = createNudgeFixture();
    nudge.reply("LATER", REPLIED_AT);

    // When
    const same = nudge.reply("LATER", UPDATED_AT);
    const different = nudge.reply("THANKFUL", UPDATED_AT);

    // Then
    expect({ same, different }).toEqual({ same: false, different: true });
    expect(nudge.toPrimitives()).toMatchObject({
      replyKind: "THANKFUL",
      repliedAt: REPLIED_AT,
      replyUpdatedAt: UPDATED_AT,
      readAt: REPLIED_AT,
    });
  });

  it("감사는 한 번만 남긴다", () => {
    // Given
    const nudge = createNudgeFixture();

    // When
    const first = nudge.markThanked(REPLIED_AT);
    const second = nudge.markThanked(UPDATED_AT);

    // Then
    expect({ first, second }).toEqual({ first: true, second: false });
    expect(nudge.thankedAt).toEqual(REPLIED_AT);
  });
});
