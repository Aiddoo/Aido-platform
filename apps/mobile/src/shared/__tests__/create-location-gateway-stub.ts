import type { LocationGateway } from '@src/core/ports/location-gateway';

/** 아직 권한을 묻지 않은 기기가 기본값이다. 좌표와 장소는 필요한 테스트가 정한다 */
export const createLocationGatewayStub = (): jest.Mocked<LocationGateway> => ({
  getPermission: jest.fn().mockResolvedValue({ isGranted: false, canAskAgain: true }),
  requestPermission: jest.fn().mockResolvedValue({ isGranted: false, canAskAgain: true }),
  getCoordinates: jest.fn(),
  getPlace: jest.fn(),
});
