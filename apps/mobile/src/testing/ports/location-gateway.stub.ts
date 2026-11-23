import type {
  LocationCoordinates,
  LocationGateway,
  LocationPermission,
} from '@src/core/ports/location-gateway';

import { mockMethod } from '../mock-method';

type Place = Awaited<ReturnType<LocationGateway['getPlace']>>;

interface LocationGatewayStubOptions {
  /** 세 권한 조회가 같은 값을 돌려준다 */
  permission?: LocationPermission;
  coordinates?: LocationCoordinates;
  place?: Place;
}

function failUnset(method: 'getCoordinates' | 'getPlace') {
  return async (): Promise<never> => {
    throw new Error(
      `createLocationGatewayStub: ${method} 결과를 정하지 않았습니다. 옵션이나 mockResolvedValue로 정하세요`,
    );
  };
}

/** 아직 권한을 묻지 않은 기기가 기본값이다. 좌표와 장소는 필요한 테스트가 정한다 */
export function createLocationGatewayStub({
  permission = { isGranted: false, canAskAgain: true },
  coordinates,
  place,
}: LocationGatewayStubOptions = {}): jest.Mocked<LocationGateway> {
  return {
    getPermission: mockMethod<LocationGateway['getPermission']>(async () => ({ ...permission })),
    requestPermission: mockMethod<LocationGateway['requestPermission']>(async () => ({
      ...permission,
    })),
    recheckPermission: mockMethod<LocationGateway['recheckPermission']>(async () => ({
      ...permission,
    })),
    getCoordinates: mockMethod<LocationGateway['getCoordinates']>(
      coordinates == null ? failUnset('getCoordinates') : async () => ({ ...coordinates }),
    ),
    getPlace: mockMethod<LocationGateway['getPlace']>(
      place == null ? failUnset('getPlace') : async () => place,
    ),
  };
}
