import { pushDeliveryJobKey } from "./push-delivery-job-keys.constants.js";

describe("푸시 발송 작업 key", () => {
  it("delivery key는 publication 순서와 무관하고 generation이 바뀌면 달라진다", () => {
    // Given
    const publications = [
      { dispatchId: 2, publishAttempt: 1 },
      { dispatchId: 1, publishAttempt: 3 },
    ];

    // When
    const key = pushDeliveryJobKey(publications);
    const reversedKey = pushDeliveryJobKey([...publications].reverse());
    const otherGenerationKey = pushDeliveryJobKey([
      { dispatchId: 2, publishAttempt: 2 },
      { dispatchId: 1, publishAttempt: 3 },
    ]);

    // Then
    expect(key).toBe(reversedKey);
    expect(key).not.toBe(otherGenerationKey);
    expect(key).toMatch(/^push-delivery-[0-9a-f]{64}$/);
  });
});
