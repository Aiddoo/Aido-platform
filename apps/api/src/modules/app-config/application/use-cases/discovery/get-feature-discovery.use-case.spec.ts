import { mockDeep } from "vitest-mock-extended";

import { GetFeatureDiscovery } from "./get-feature-discovery.use-case.js";

describe("GetFeatureDiscovery — 기능 발견 설정 조회", () => {
  it("기능이 비활성화되어 있으면 사용자 정보 없이 비활성 설정을 반환한다", () => {
    // Given
    const getFeatureDiscoveryDependencies =
      mockDeep<ConstructorParameters<typeof GetFeatureDiscovery>[0]>();
    getFeatureDiscoveryDependencies.config.getFeatureDiscovery.mockReturnValue({ enabled: false });
    const unit = new GetFeatureDiscovery(getFeatureDiscoveryDependencies);

    // When
    const result = unit.execute();

    // Then
    expect(result).toEqual({ enabled: false });
  });
});
