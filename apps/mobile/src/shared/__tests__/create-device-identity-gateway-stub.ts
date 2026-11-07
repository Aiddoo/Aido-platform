import type { InstallReferrerGateway } from '@src/core/ports/install-referrer';
import type { InstallationIdGateway } from '@src/core/ports/installation-id';
import type { VendorIdGateway } from '@src/core/ports/vendor-id';

/** 값을 읽을 수 없는 기기가 기본값이다 */
export const createInstallReferrerGatewayStub = (): jest.Mocked<InstallReferrerGateway> => ({
  read: jest.fn().mockResolvedValue(null),
});

export const createInstallationIdGatewayStub = (): jest.Mocked<InstallationIdGateway> => ({
  get: jest.fn().mockResolvedValue(null),
});

export const createVendorIdGatewayStub = (): jest.Mocked<VendorIdGateway> => ({
  get: jest.fn().mockResolvedValue(null),
});
