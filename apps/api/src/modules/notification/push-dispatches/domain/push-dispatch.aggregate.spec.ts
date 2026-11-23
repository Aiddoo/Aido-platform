import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NotificationId } from "../../notifications/domain/notification-id.vo.js";
import { PushDispatchId } from "./push-dispatch-id.vo.js";
import { PushDispatch } from "./push-dispatch.aggregate.js";

const NOW = Temporal.Instant.from("2026-11-18T00:00:00Z");

const params = {
  id: PushDispatchId.reconstitute(7),
  notificationId: NotificationId.reconstitute(3),
  recipientId: UserId.reconstitute("user-1"),
  purpose: "ENGAGEMENT" as const,
  campaignKey: "retention-d1",
  variantId: "B",
  deliveryMode: "BATCH" as const,
  force: false,
  now: NOW,
};

describe("PushDispatch", () => {
  it("새 발송은 PENDING으로 만들고 아웃박스 칸을 함께 담는다", () => {
    // When
    const dispatch = PushDispatch.create(params);

    // Then
    expect(dispatch.toPrimitives()).toEqual({
      id: 7,
      notificationId: 3,
      recipientId: "user-1",
      purpose: "ENGAGEMENT",
      campaignKey: "retention-d1",
      variantId: "B",
      status: "PENDING",
      deliveryMode: "BATCH",
      force: false,
      stagedAt: NOW,
    });
  });

  it("수신자가 비면 SYS_0002로 거절한다", () => {
    // When
    const create = () => PushDispatch.create({ ...params, recipientId: UserId.reconstitute("") });

    // Then
    expect(create).toThrow();
  });

  it.each(["campaignKey", "variantId"])("%s가 칸 길이 100자를 넘으면 거절한다", (field) => {
    // When
    const create = () => PushDispatch.create({ ...params, [field]: "x".repeat(101) });

    // Then
    expect(create).toThrow();
  });
});
