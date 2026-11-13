import type { LocationGateway } from '@src/core/ports/location-gateway';

import { mockMethod } from '../mock-method';

function failUnset(method: 'getCoordinates' | 'getPlace') {
  return async (): Promise<never> => {
    throw new Error(
      `createLocationGatewayStub: ${method} 결과를 정하지 않았습니다. mockResolvedValue로 정하세요`,
    );
  };
}

/** 아직 권한을 묻지 않은 기기가 기본값이다. 좌표와 장소는 필요한 테스트가 정한다 */
export function createLocationGatewayStub(): jest.Mocked<LocationGateway> {
  return {
    getPermission: mockMethod<LocationGateway['getPermission']>(async () => ({
      isGranted: false,
      canAskAgain: true,
    })),
    requestPermission: mockMethod<LocationGateway['requestPermission']>(async () => ({
      isGranted: false,
      canAskAgain: true,
    })),
    recheckPermission: mockMethod<LocationGateway['recheckPermission']>(async () => ({
      isGranted: false,
      canAskAgain: true,
    })),
    getCoordinates: mockMethod<LocationGateway['getCoordinates']>(failUnset('getCoordinates')),
    getPlace: mockMethod<LocationGateway['getPlace']>(failUnset('getPlace')),
  };
}
