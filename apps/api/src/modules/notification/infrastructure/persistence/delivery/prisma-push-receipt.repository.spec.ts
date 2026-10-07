import { createMockTransactionHost } from "#test/mocks/database.mock";
import { asMock, createMockDatabaseContext } from "#test/mocks/index";

import { PrismaPushReceiptRepository } from "./prisma-push-receipt.repository.js";
import { pushTokenFingerprint } from "./push-token-fingerprint.js";

describe("PrismaPushReceiptRepository — sent/current token identity", () => {
  it("returns only a current matching token and skips rotation or legacy null fingerprint", async () => {
    const db = createMockDatabaseContext();
    const repository = new PrismaPushReceiptRepository(createMockTransactionHost(db));
    asMock(db.query).mockResolvedValue([
      {
        userId: "matching",
        token: "token-current",
        tokenFingerprint: pushTokenFingerprint("token-current"),
      },
      {
        userId: "rotated",
        token: "token-new",
        tokenFingerprint: pushTokenFingerprint("token-old"),
      },
      { userId: "legacy", token: "token-legacy", tokenFingerprint: null },
    ]);
    await expect(
      repository.recordPushReceipts([
        { ticketId: "invalid", delivered: false, errorCode: "DeviceNotRegistered" },
      ]),
    ).resolves.toEqual([{ userId: "matching", token: "token-current" }]);
  });
});
