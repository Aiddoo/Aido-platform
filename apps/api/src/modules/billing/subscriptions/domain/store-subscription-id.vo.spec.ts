import { StoreSubscriptionId } from "./store-subscription-id.vo.js";

describe("StoreSubscriptionId", () => {
  it.each([undefined, null, ""])("체인 ID가 %s이면 SUBSCRIPTION_1604로 거절한다", (value) => {
    // Given
    const raw = value;

    // When
    const creating = () => StoreSubscriptionId.from(raw);

    // Then
    expect(creating).toThrow(expect.objectContaining({ errorCode: "SUBSCRIPTION_1604" }));
  });
});
