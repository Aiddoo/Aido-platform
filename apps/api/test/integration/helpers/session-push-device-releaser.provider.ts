import type { Provider } from "@nestjs/common";

import { SessionPushDeviceReleaserPort } from "#api/modules/identity/auth/application/ports/session-push-device-releaser.port";
import { StubSessionPushDeviceReleaser } from "#test/mocks/ports/auth-session.stub";

/** 알림 모듈 전체를 조립하지 않는 인증 통합 테스트용 ACL 대역. */
export const sessionPushDeviceReleaserTestProvider: Provider<SessionPushDeviceReleaserPort> = {
  provide: SessionPushDeviceReleaserPort,
  useFactory: () => new StubSessionPushDeviceReleaser(),
};
