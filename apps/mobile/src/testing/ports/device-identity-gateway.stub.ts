import type { InstallReferrerGateway } from '@src/core/ports/install-referrer-gateway';
import type { InstallationIdGateway } from '@src/core/ports/installation-id-gateway';
import type { VendorIdGateway } from '@src/core/ports/vendor-id-gateway';

import { mockMethod } from '../mock-method';

/** 값을 읽을 수 없는 기기가 기본값이다 */
export function createInstallReferrerGatewayStub(): jest.Mocked<InstallReferrerGateway> {
  return {
    get: mockMethod<InstallReferrerGateway['get']>(async () => null),
  };
}

export function createInstallationIdGatewayStub(): jest.Mocked<InstallationIdGateway> {
  return {
    get: mockMethod<InstallationIdGateway['get']>(async () => null),
  };
}

export function createVendorIdGatewayStub(): jest.Mocked<VendorIdGateway> {
  return {
    get: mockMethod<VendorIdGateway['get']>(async () => null),
  };
}
