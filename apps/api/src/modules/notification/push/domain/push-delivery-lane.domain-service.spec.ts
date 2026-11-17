import { pushDeliveryLaneOf } from "./push-delivery-lane.domain-service.js";

describe("푸시 발송 차선", () => {
  it("리마인더·소셜·결제·시스템 알림은 거래성 차선이다", () => {
    // When
    const reminder = pushDeliveryLaneOf({ purpose: "SCHEDULED_SERVICE", type: "TODO_REMINDER" });
    const social = pushDeliveryLaneOf({ purpose: "TRANSACTIONAL", type: "FOLLOW_NEW" });
    const notice = pushDeliveryLaneOf({ purpose: "TRANSACTIONAL", type: "SYSTEM_NOTICE" });
    const adminTargeted = pushDeliveryLaneOf({ purpose: "TRANSACTIONAL", type: "ADMIN_TARGETED" });

    // Then
    expect(reminder).toBe("TRANSACTIONAL");
    expect(social).toBe("TRANSACTIONAL");
    expect(notice).toBe("TRANSACTIONAL");
    expect(adminTargeted).toBe("TRANSACTIONAL");
  });

  it("참여 유도·마케팅 타입·관리자 브로드캐스트는 마케팅 차선이다", () => {
    // When
    const engagement = pushDeliveryLaneOf({ purpose: "ENGAGEMENT", type: "SYSTEM_NOTICE" });
    const winback = pushDeliveryLaneOf({ purpose: "TRANSACTIONAL", type: "WINBACK" });
    const broadcast = pushDeliveryLaneOf({ purpose: "TRANSACTIONAL", type: "ADMIN_BROADCAST" });

    // Then
    // 브로드캐스트는 purpose가 TRANSACTIONAL로 저장돼도 대량 발송이다
    expect(engagement).toBe("MARKETING");
    expect(winback).toBe("MARKETING");
    expect(broadcast).toBe("MARKETING");
  });
});
