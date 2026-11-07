import type { HttpClient } from '@src/core/ports/http-client';
import {
  createHttpClientStub,
  createLoggerStub,
  createMemorySyncStorage,
} from '@src/shared/__tests__';

import { createInstallReferrerRepository } from '../apis/install-referrer.repository';
import { InviteService } from '../apis/invite.service';
import { createPendingRedemptionRepository } from '../apis/pending-redemption.repository';

interface StubInviteServiceOptions {
  publicHttpClient?: HttpClient;
  authHttpClient?: HttpClient;
}

/** 화면·훅 테스트용 실제 InviteService. 저장소는 메모리, 기기 API는 빈 값을 돌려주는 stub이다 */
export function createStubInviteService({
  publicHttpClient = createHttpClientStub(),
  authHttpClient = createHttpClientStub(),
}: StubInviteServiceOptions = {}) {
  const storage = createMemorySyncStorage();

  return new InviteService({
    publicHttpClient,
    authHttpClient,
    pendingRedemptionRepository: createPendingRedemptionRepository(storage),
    installReferrerRepository: createInstallReferrerRepository(storage, {
      get: async () => null,
    }),
    installationIdGateway: { get: async () => null },
    logger: createLoggerStub(),
  });
}
