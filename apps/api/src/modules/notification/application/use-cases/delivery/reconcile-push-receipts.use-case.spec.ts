import { mockDeep } from "vitest-mock-extended";

import { ReconcilePushReceipts } from "./reconcile-push-receipts.use-case.js";

describe("ReconcilePushReceipts", () => {
  it("provider receipt를 기록하고 유효하지 않은 토큰을 비활성화한다", async () => {
    const reconcilePushReceiptsDependencies = mockDeep<
      ConstructorParameters<typeof ReconcilePushReceipts>[0]
    >({});
    const unit = new ReconcilePushReceipts(reconcilePushReceiptsDependencies);
    const receipts = reconcilePushReceiptsDependencies.pushReceiptRepository;
    const tokens = reconcilePushReceiptsDependencies.pushTokenRepository;
    const provider = reconcilePushReceiptsDependencies.pushProvider;
    receipts.findPendingPushReceipts.mockResolvedValue([
      { ticketId: "ticket-1", token: "token-1" },
    ]);
    provider.getReceipts.mockResolvedValue([{ ticketId: "ticket-1", delivered: false }]);
    receipts.recordPushReceipts.mockResolvedValue(["token-1"]);

    await unit.execute();

    expect(receipts.findPendingPushReceipts).toHaveBeenCalledWith(900);
    expect(provider.getReceipts).toHaveBeenCalledWith(["ticket-1"]);
    expect(tokens.deactivateInvalidTokens).toHaveBeenCalledWith(["token-1"]);
  });
});
