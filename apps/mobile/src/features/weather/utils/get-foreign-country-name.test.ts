import { getForeignCountryName } from './get-foreign-country-name';

describe('getForeignCountryName', () => {
  it('기기 지역과 다른 나라에 있으면 앱 언어로 나라 이름을 돌려준다', () => {
    // When
    const name = getForeignCountryName({ countryCode: 'VN' }, 'KR', 'ko');

    // Then
    expect(name).toBe('베트남');
  });

  it('기기 지역과 같은 나라면 나라 이름을 붙이지 않는다', () => {
    // When
    const name = getForeignCountryName({ countryCode: 'kr' }, 'KR', 'ko');

    // Then
    expect(name).toBeNull();
  });

  it.each([
    [null, 'KR'],
    ['JP', null],
  ])('나라(%s)나 기기 지역(%s)을 모르면 나라 이름을 붙이지 않는다', (countryCode, region) => {
    // When
    const name = getForeignCountryName({ countryCode }, region, 'ko');

    // Then
    expect(name).toBeNull();
  });
});
