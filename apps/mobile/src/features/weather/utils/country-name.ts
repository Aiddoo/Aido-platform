/**
 * 기기 지역과 다른 나라에 있을 때만 그 나라 이름을 앱 언어로 돌려준다.
 * 나라를 모르거나 런타임이 Intl.DisplayNames를 지원하지 않으면 null이다.
 */
export function getForeignCountryName(
  location: { countryCode: string | null },
  deviceRegion: string | null,
  language: string,
): string | null {
  const { countryCode } = location;
  if (countryCode == null || deviceRegion == null) {
    return null;
  }
  if (countryCode.toUpperCase() === deviceRegion.toUpperCase()) {
    return null;
  }
  if (typeof Intl.DisplayNames !== 'function') {
    return null;
  }
  try {
    return (
      new Intl.DisplayNames([language], { type: 'region' }).of(countryCode.toUpperCase()) ?? null
    );
  } catch {
    return null;
  }
}
