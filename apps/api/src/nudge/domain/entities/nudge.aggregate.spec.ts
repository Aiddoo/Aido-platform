import { ErrorCode } from "@aido/errors";
import { describe, expect, it } from "vitest";

import { NudgeBuilder } from "#test/builders/nudge.builder";

import { Nudge } from "./nudge.aggregate.js";

const createdAt = new Date("2026-10-04T01:00:00.000Z");
const repliedAt = new Date("2026-10-04T02:00:00.000Z");
const updatedAt = new Date("2026-10-04T03:00:00.000Z");

describe("Nudge", () => {
  it("기존 영속 상태에서 답장·감사가 없어도 복원한다", () => {
    // Given
    const persisted = NudgeBuilder.create("sender", "receiver", 10)
      .withId(1)
      .withCreatedAt(createdAt)
      .withMessage("같이 해보자")
      .build();

    // When
    const nudge = Nudge.reconstitute(persisted);

    // Then
    expect(nudge.id).toBe(1);
    expect(nudge.senderId).toBe("sender");
    expect(nudge.todoId).toBe(10);
    expect(nudge.message).toBe("같이 해보자");
    expect(nudge.isRead()).toBe(false);
    expect(nudge.hasReplied()).toBe(false);
    expect(nudge.hasThanked()).toBe(false);
    expect(nudge.isReceivedBy("receiver")).toBe(true);
    expect(nudge.isReceivedBy("sender")).toBe(false);
  });

  it("자신에게 보내는 콕 생성은 거부한다", () => {
    // Given
    const input = { senderId: "same", receiverId: "same", todoId: 10, createdAt };

    // When
    const create = () => Nudge.planCreation(input);

    // Then
    expect(create).toThrow(expect.objectContaining({ errorCode: ErrorCode.NUDGE_1104 }));
  });

  it("읽음 처리를 반복해도 처음 확인한 시각을 유지한다", () => {
    // Given
    const nudge = Nudge.reconstitute(NudgeBuilder.create("sender", "receiver", 10).build());

    // When
    const first = nudge.markRead(repliedAt);
    const second = nudge.markRead(updatedAt);

    // Then
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(nudge.readAt).toEqual(repliedAt);
  });

  it("첫 답장을 저장하면서 읽음 상태로 바꾼다", () => {
    // Given
    const nudge = Nudge.reconstitute(NudgeBuilder.create("sender", "receiver", 10).build());

    // When
    const changed = nudge.reply("STARTING", repliedAt);

    // Then
    expect(changed).toBe(true);
    expect(nudge.replyKind).toBe("STARTING");
    expect(nudge.repliedAt).toEqual(repliedAt);
    expect(nudge.replyUpdatedAt).toEqual(repliedAt);
    expect(nudge.readAt).toEqual(repliedAt);
    expect(nudge.hasThanked()).toBe(false);
  });

  it("같은 답장을 다시 보내면 변경하지 않는다", () => {
    // Given
    const nudge = Nudge.reconstitute(NudgeBuilder.create("sender", "receiver", 10).build());
    nudge.reply("LATER", repliedAt);

    // When
    const changed = nudge.reply("LATER", updatedAt);

    // Then
    expect(changed).toBe(false);
    expect(nudge.replyUpdatedAt).toEqual(repliedAt);
  });

  it("답장을 변경해도 첫 답장·읽음 시각은 유지한다", () => {
    // Given
    const nudge = Nudge.reconstitute(NudgeBuilder.create("sender", "receiver", 10).build());
    nudge.reply("LATER", repliedAt);

    // When
    nudge.reply("THANKFUL", updatedAt);

    // Then
    expect(nudge.replyKind).toBe("THANKFUL");
    expect(nudge.repliedAt).toEqual(repliedAt);
    expect(nudge.replyUpdatedAt).toEqual(updatedAt);
    expect(nudge.readAt).toEqual(repliedAt);
  });

  it("감사 기록은 한 번만 변경한다", () => {
    // Given
    const nudge = Nudge.reconstitute(NudgeBuilder.create("sender", "receiver", 10).build());

    // When
    const first = nudge.markThanked(repliedAt);
    const second = nudge.markThanked(updatedAt);

    // Then
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(nudge.thankedAt).toEqual(repliedAt);
  });

  it("복원 입력·반환된 날짜를 변경해도 내부 상태는 바뀌지 않는다", () => {
    // Given
    const persisted = NudgeBuilder.create("sender", "receiver", 10)
      .withCreatedAt(new Date(createdAt))
      .build();
    const nudge = Nudge.reconstitute(persisted);
    const replyDate = new Date(repliedAt);
    nudge.reply("STARTING", replyDate);

    // When
    persisted.createdAt.setFullYear(2000);
    replyDate.setFullYear(2000);
    nudge.createdAt.setFullYear(2000);
    nudge.toPersistence().replyUpdatedAt?.setFullYear(2000);

    // Then
    expect(nudge.createdAt).toEqual(createdAt);
    expect(nudge.repliedAt).toEqual(repliedAt);
    expect(nudge.replyUpdatedAt).toEqual(repliedAt);
  });
});
