import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  NUDGE_FIXTURE_NOW,
  NUDGE_FIXTURE_RECEIVER_ID,
  NUDGE_FIXTURE_SENDER_ID,
} from "#test/fixtures/social/nudge.fixture";

import { ReminderNudgeId } from "./reminder-nudge-id.vo.js";
import { ReminderNudge } from "./reminder-nudge.aggregate.js";

describe("ReminderNudge — 리마인드 콕", () => {
  it("할 일 없이 보낸 사람·받은 사람·만든 시각을 남긴다", () => {
    // When
    const reminder = ReminderNudge.create({
      id: ReminderNudgeId.reconstitute(4),
      senderId: UserId.reconstitute(NUDGE_FIXTURE_SENDER_ID),
      receiverId: UserId.reconstitute(NUDGE_FIXTURE_RECEIVER_ID),
      message: null,
      now: NUDGE_FIXTURE_NOW,
    });

    // Then
    expect(reminder.toPrimitives()).toEqual({
      id: 4,
      senderId: NUDGE_FIXTURE_SENDER_ID,
      receiverId: NUDGE_FIXTURE_RECEIVER_ID,
      message: null,
      createdAt: NUDGE_FIXTURE_NOW,
    });
  });

  it("자기 자신에게 보내는 리마인드 콕은 만들지 않는다", () => {
    // When
    const create = () =>
      ReminderNudge.create({
        id: ReminderNudgeId.reconstitute(4),
        senderId: UserId.reconstitute(NUDGE_FIXTURE_SENDER_ID),
        receiverId: UserId.reconstitute(NUDGE_FIXTURE_SENDER_ID),
        message: null,
        now: NUDGE_FIXTURE_NOW,
      });

    // Then
    expect(create).toThrow(expect.objectContaining({ errorCode: ErrorCode.NUDGE_1104 }));
  });
});
