import { pushDeliveryLaneOf } from "./push-delivery-lane.domain-service.js";

describe("푸시 발송 차선", () => {
  it("리마인더·소셜·결제·시스템 알림은 거래성 차선이다", () => {
    // Given / When / Then
    expect(pushDeliveryLaneOf({ purpose: "SCHEDULED_SERVICE", type: "TODO_REMINDER" })).toBe(
      "TRANSACTIONAL",
    );
    expect(pushDeliveryLaneOf({ purpose: "TRANSACTIONAL", type: "FOLLOW_NEW" })).toBe(
      "TRANSACTIONAL",
    );
    expect(pushDeliveryLaneOf({ purpose: "TRANSACTIONAL", type: "SYSTEM_NOTICE" })).toBe(
      "TRANSACTIONAL",
    );
    expect(pushDeliveryLaneOf({ purpose: "TRANSACTIONAL", type: "ADMIN_TARGETED" })).toBe(
      "TRANSACTIONAL",
    );
  });

  it("참여 유도·마케팅 타입·관리자 브로드캐스트는 마케팅 차선이다", () => {
    // Given / When / Then: 브로드캐스트는 purpose가 TRANSACTIONAL로 저장돼도 대량 발송이다
    expect(pushDeliveryLaneOf({ purpose: "ENGAGEMENT", type: "SYSTEM_NOTICE" })).toBe("MARKETING");
    expect(pushDeliveryLaneOf({ purpose: "TRANSACTIONAL", type: "WINBACK" })).toBe("MARKETING");
    expect(pushDeliveryLaneOf({ purpose: "TRANSACTIONAL", type: "ADMIN_BROADCAST" })).toBe(
      "MARKETING",
    );
  });
});
