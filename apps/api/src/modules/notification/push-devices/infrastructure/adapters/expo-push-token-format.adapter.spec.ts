import { ExpoPushTokenFormatAdapter } from "./expo-push-token-format.adapter.js";

describe("ExpoPushTokenFormatAdapter", () => {
  const tokenFormat = new ExpoPushTokenFormatAdapter();

  it.each([
    "ExponentPushToken[notification14-synthetic-token]",
    "ExpoPushToken[notification14-synthetic-token]",
    "12345678-1234-1234-1234-123456789012",
  ])("SDK 토큰 형식 %s을 받아들인다", (value) => {
    // When
    const acceptsToken = tokenFormat.accepts("EXPO", value);
    const acceptsInvalidToken = tokenFormat.accepts("EXPO", "invalid-token");

    // Then
    expect(acceptsToken).toBe(true);
    expect(acceptsInvalidToken).toBe(false);
  });
});
