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

export const getCalendars = jest.fn(() => [
  {
    calendar: 'gregory',
    uses24hourClock: false,
    firstWeekday: 1,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    weekendDays: [1, 7],
  },
]);
