import type { PlaceName } from '@src/core/ports/location-gateway';
import { deburr } from 'es-toolkit';
import type { LocationGeocodedAddress } from 'expo-location';

type PlaceNameSource = Pick<
  LocationGeocodedAddress,
  'city' | 'district' | 'subregion' | 'region' | 'name'
>;

function clean(value: string | null): string | null {
  const text = value?.normalize('NFC').trim();
  return text ? text : null;
}

function fold(value: string): string {
  return deburr(value).toLowerCase();
}

/** Android Geocoder는 locality가 빈 지역이 많고(서울·상파울루) subLocality의 발음 기호를 빼기도 해(Sé → Se) 상위 행정구역·featureName으로 채운다 */
export function toPlaceName(place: PlaceNameSource): PlaceName | null {
  const city = clean(place.city) ?? clean(place.subregion) ?? clean(place.region);
  const rawDistrict = clean(place.district);
  const featureName = clean(place.name);
  const district =
    rawDistrict != null && featureName != null && fold(rawDistrict) === fold(featureName)
      ? featureName
      : rawDistrict;

  if (city == null) {
    return district == null ? null : { city: district, district: null };
  }
  if (district == null || fold(district) === fold(city)) {
    return { city, district: null };
  }
  return { city, district };
}
