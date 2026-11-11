import type { Provider } from "@nestjs/common";

import { RetentionEnrollerPort } from "#api/modules/identity/auth/application/ports/retention-enroller.port";

const retentionEnrollerTestDouble: RetentionEnrollerPort = {
  enrollNewUser: () => Promise.resolve(),
  activateNewUser: () => Promise.resolve(),
};

/** 리텐션 모듈 전체를 조립하지 않는 인증 통합 테스트용 ACL 대역. */
export const retentionEnrollerTestProvider: Provider<RetentionEnrollerPort> = {
  provide: RetentionEnrollerPort,
  useValue: retentionEnrollerTestDouble,
};
