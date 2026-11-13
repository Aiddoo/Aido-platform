import { RevenueCatCustomerConsoleAdapter } from "./revenuecat-customer-console.adapter.js";

function adapterWith(projectId: string | undefined): RevenueCatCustomerConsoleAdapter {
  return new RevenueCatCustomerConsoleAdapter({
    revenuecat: { projectId, apiV2SecretKey: undefined },
  });
}

describe("RevenueCatCustomerConsoleAdapter", () => {
  it("프로젝트 ID가 있으면 프로젝트와 앱 사용자 ID를 인코딩한 고객 화면 주소를 만든다", () => {
    // Given
    const adapter = adapterWith("6a6ea506");

    // When
    const url = adapter.customerUrlOf("app user/1");

    // Then
    expect(url).toBe("https://app.revenuecat.com/projects/6a6ea506/customers/app%20user%2F1");
  });

  it("프로젝트 ID가 없으면 고객 화면 주소를 만들지 않는다", () => {
    // Given
    const adapter = adapterWith(undefined);

    // When
    const url = adapter.customerUrlOf("app-user-1");

    // Then
    expect(url).toBeNull();
  });
});
