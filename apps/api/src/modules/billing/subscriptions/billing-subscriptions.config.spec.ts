import { billingSubscriptionsConfig } from "./billing-subscriptions.config.js";

describe("billingSubscriptionsConfig — 스토어 상태 대조 설정", () => {
  it.each([
    { label: "프로젝트 ID와 읽기 키가 모두 있으면", projectId: "proj", key: "sk", expected: true },
    { label: "읽기 키가 없으면", projectId: "proj", key: undefined, expected: false },
    { label: "프로젝트 ID가 없으면", projectId: undefined, key: "sk", expected: false },
  ])("$label 대조 예약은 $expected다", ({ projectId, key, expected }) => {
    // Given
    const env = {
      NODE_ENV: "test",
      REVENUECAT_PROJECT_ID: projectId,
      REVENUECAT_API_V2_SECRET_KEY: key,
    };

    // When
    const config = billingSubscriptionsConfig.parse(env);

    // Then
    expect(config.reconcilesStoreStatus).toBe(expected);
  });
});
