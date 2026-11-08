/** 기기 지역과 같은 나라, 모르는 나라, Intl.DisplayNames가 없는 런타임이면 null이다 */
export function findForeignCountryName(
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
