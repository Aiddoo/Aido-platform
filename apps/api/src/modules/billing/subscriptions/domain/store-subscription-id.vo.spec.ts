import { ErrorCode } from "@aido/api/errors";

import { StoreSubscriptionId } from "./store-subscription-id.vo.js";

describe("StoreSubscriptionId — 스토어 체인 ID", () => {
  it.each([null, undefined, ""])("체인 ID가 %s이면 SUBSCRIPTION_1604로 거절한다", (raw) => {
    // Given
    const create = () => StoreSubscriptionId.create(raw);

    // When
    const result = create;

    // Then
    expect(result).toThrow(expect.objectContaining({ errorCode: ErrorCode.SUBSCRIPTION_1604 }));
  });

  it("같은 값의 ID는 같고 다른 값은 다르다", () => {
    // Given
    const chain = StoreSubscriptionId.create("original-1");

    // When
    const same = chain.equals(StoreSubscriptionId.reconstitute("original-1"));
    const different = chain.equals(StoreSubscriptionId.reconstitute("original-2"));

    // Then
    expect({ same, different }).toEqual({ same: true, different: false });
  });
});
