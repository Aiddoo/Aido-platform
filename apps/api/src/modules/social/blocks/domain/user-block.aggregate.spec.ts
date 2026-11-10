import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { UserBlockId } from "./user-block-id.vo.js";
import { UserBlock } from "./user-block.aggregate.js";

const BLOCK_ID = UserBlockId.reconstitute("c0123456789abcdef01234567");
const NOW = Temporal.Instant.from("2026-10-26T09:00:00Z");

describe("UserBlock", () => {
  it("차단한 사람·차단당한 사람·차단 시각을 담아 만든다", () => {
    // When
    const block = UserBlock.create({
      id: BLOCK_ID,
      blockerId: UserId.reconstitute("blocker"),
      blockedId: UserId.reconstitute("blocked"),
      now: NOW,
    });

    // Then
    expect(block.toPrimitives()).toEqual({
      id: BLOCK_ID.value,
      blockerId: "blocker",
      blockedId: "blocked",
      createdAt: NOW,
    });
  });

  it("자기 자신을 차단하려 하면 BLOCK_2201로 거부한다", () => {
    // Given
    const userId = UserId.reconstitute("same");

    // When
    const create = () =>
      UserBlock.create({ id: BLOCK_ID, blockerId: userId, blockedId: userId, now: NOW });

    // Then
    expect(create).toThrow(expect.objectContaining({ errorCode: ErrorCode.BLOCK_2201 }));
  });
});
