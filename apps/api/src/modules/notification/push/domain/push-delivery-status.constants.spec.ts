import { pushDeliveryStatus, pushDispatchStatus } from "#api/platform/database/schema/index";

import {
  PUSH_DELIVERY_ATTEMPT_STATUSES,
  PUSH_DISPATCH_STATUSES,
} from "./push-delivery-status.constants.js";

describe("푸시 발송 상태 어휘", () => {
  it("도메인 상태 목록이 DB enum 값과 같다", () => {
    // Given / When / Then: 상태를 DB에 더하면 도메인 목록도 함께 바꿔야 집계가 값을 잃지 않는다
    expect(PUSH_DISPATCH_STATUSES).toEqual(pushDispatchStatus.enumValues);
    expect(PUSH_DELIVERY_ATTEMPT_STATUSES).toEqual(pushDeliveryStatus.enumValues);
  });
});
