import type { LocationGeocodedAddress } from 'expo-location';

type PlaceNameSource = Pick<
  LocationGeocodedAddress,
  'city' | 'district' | 'subregion' | 'region' | 'name'
>;

const COMBINING_MARKS = /[̀-ͯ]/g;

function clean(value: string | null): string | null {
  const text = value?.normalize('NFC').trim();
  return text ? text : null;
}

function fold(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

/**
 * 역지오코딩 결과를 "도시 동네" 표기로 만든다.
 *
 * Android Geocoder는 locality가 비는 지역이 많아(서울·상파울루) 상위 행정구역으로 도시를 채우고,
 * subLocality에서 발음 구별 기호를 빼기도 해(Sé → Se) 같은 지명인 featureName이 있으면 그 표기를 쓴다.
 */
export function toPlaceName(place: PlaceNameSource): string | null {
  const city = clean(place.city) ?? clean(place.subregion) ?? clean(place.region);
  const rawDistrict = clean(place.district);
  const featureName = clean(place.name);
  const district =
    rawDistrict != null && featureName != null && fold(rawDistrict) === fold(featureName)
      ? featureName
      : rawDistrict;

  if (city == null) {
    return district;
  }
  if (district == null || fold(district) === fold(city)) {
    return city;
  }
  return `${city} ${district}`;
}
