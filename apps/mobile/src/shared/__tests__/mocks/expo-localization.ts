// expo-localization 네이티브 모듈 mock (jest.config.js moduleNameMapper에서 매핑)
export const getLocales = jest.fn(() => [
  {
    languageCode: 'ko',
    languageTag: 'ko-KR',
    regionCode: 'KR',
    currencyCode: 'KRW',
    currencySymbol: '₩',
    decimalSeparator: '.',
    digitGroupingSeparator: ',',
    textDirection: 'ltr',
    measurementSystem: 'metric',
    temperatureUnit: 'celsius',
  },
]);
