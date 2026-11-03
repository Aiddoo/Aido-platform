import type { LocationGeocodedAddress } from 'expo-location';

import { toPlaceName } from './place-name';

const createPlace = (
  overrides: Partial<LocationGeocodedAddress> = {},
): Pick<LocationGeocodedAddress, 'city' | 'district' | 'subregion' | 'region' | 'name'> => ({
  city: null,
  district: null,
  subregion: null,
  region: null,
  name: null,
  ...overrides,
});

describe('toPlaceName', () => {
  test('도시와 동네를 나눈다', () => {
    // Given
    const place = createPlace({ city: '서울특별시', district: '암사동', region: '서울특별시' });

    // When
    const name = toPlaceName(place);

    // Then
    expect(name).toEqual({ city: '서울특별시', district: '암사동' });
  });

  test('Android에서 도시가 비면 광역 행정구역으로 채운다', () => {
    // Given
    const place = createPlace({ district: '강동구', region: '서울특별시', name: '3층' });

    // When
    const name = toPlaceName(place);

    // Then
    expect(name).toEqual({ city: '서울특별시', district: '강동구' });
  });

  test('Android가 동네 이름의 악센트를 빼면 같은 지명의 악센트 표기를 쓴다', () => {
    // Given
    const place = createPlace({
      district: 'Se',
      name: 'Sé',
      subregion: 'São Paulo',
      region: 'São Paulo',
    });

    // When
    const name = toPlaceName(place);

    // Then
    expect(name).toEqual({ city: 'São Paulo', district: 'Sé' });
  });

  test('분해형(NFD) 문자를 조합형(NFC)으로 바꾸고 공백을 지운다', () => {
    // Given
    const place = createPlace({ city: ' São Paulo ', district: 'Sé ' });

    // When
    const name = toPlaceName(place);

    // Then
    expect(name).toEqual({ city: 'São Paulo', district: 'Sé' });
  });

  test('도시와 동네가 같은 이름이면 동네를 비운다', () => {
    // Given
    const place = createPlace({ city: 'São Paulo', district: 'Sao Paulo' });

    // When
    const name = toPlaceName(place);

    // Then
    expect(name).toEqual({ city: 'São Paulo', district: null });
  });

  test('도시를 모르면 동네 이름을 큰 제목으로 쓴다', () => {
    // Given
    const place = createPlace({ district: '암사동' });

    // When
    const name = toPlaceName(place);

    // Then
    expect(name).toEqual({ city: '암사동', district: null });
  });

  test('표시할 이름이 없으면 null을 돌려준다', () => {
    // Given
    const place = createPlace({ city: '  ', name: '3층' });

    // When
    const name = toPlaceName(place);

    // Then
    expect(name).toBeNull();
  });
});
