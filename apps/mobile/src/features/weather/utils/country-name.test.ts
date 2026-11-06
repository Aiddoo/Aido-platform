import { getForeignCountryName } from './country-name';

describe('getForeignCountryName', () => {
  it('기기 지역과 다른 나라에 있으면 앱 언어로 나라 이름을 돌려준다', () => {
    // Given 베트남에 있고 기기 지역은 한국 When 한국어로 나라 이름을 구하면 Then 베트남이다
    const name = getForeignCountryName({ countryCode: 'VN' }, 'KR', 'ko');

    expect(name).toBe('베트남');
  });

  it('기기 지역과 같은 나라면 나라 이름을 붙이지 않는다', () => {
    // Given 한국에 있고 기기 지역도 한국 When 나라 이름을 구하면 Then 없다
    const name = getForeignCountryName({ countryCode: 'kr' }, 'KR', 'ko');

    expect(name).toBeNull();
  });

  it.each([
    [null, 'KR'],
    ['JP', null],
  ])('나라(%s)나 기기 지역(%s)을 모르면 나라 이름을 붙이지 않는다', (countryCode, region) => {
    // Given 나라나 기기 지역 중 하나를 모르고 When 나라 이름을 구하면 Then 없다
    const name = getForeignCountryName({ countryCode }, region, 'ko');

    expect(name).toBeNull();
  });
});
