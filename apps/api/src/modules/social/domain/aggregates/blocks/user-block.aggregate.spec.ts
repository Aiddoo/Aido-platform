import { ErrorCode } from "@aido/api/errors";
import { describe, expect, it } from "vitest";

import { UserBlock } from "./user-block.aggregate.js";

const createdAt = new Date("2026-10-26T09:00:00.000Z");

describe("UserBlock", () => {
  it("자기 자신을 차단하려 하면 거부한다", () => {
    // Given
    const input = { blockerId: "same", blockedId: "same", createdAt };

    // When
    const plan = () => UserBlock.planCreation(input);

    // Then
    expect(plan).toThrow(expect.objectContaining({ errorCode: ErrorCode.BLOCK_2201 }));
  });

  it("차단 시각을 바깥 Date와 공유하지 않는다", () => {
    // Given
    const persisted = { id: "block-1", blockerId: "blocker", blockedId: "blocked", createdAt };
    const block = UserBlock.reconstitute(persisted);

    // When
    block.createdAt.setUTCFullYear(2000);
    persisted.createdAt.setUTCFullYear(2001);

    // Then
    expect(block.createdAt).toEqual(new Date("2026-10-26T09:00:00.000Z"));
  });
});
