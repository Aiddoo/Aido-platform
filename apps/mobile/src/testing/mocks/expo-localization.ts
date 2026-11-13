// expo-localization 네이티브 모듈 mock (jest.config.js moduleNameMapper에서 매핑)
const DEVICE_LOCALES = [
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
];

const DEVICE_CALENDARS = [
  {
    calendar: 'gregory',
    uses24hourClock: false,
    firstWeekday: 1,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    weekendDays: [1, 7],
  },
];

export const getLocales = jest.fn(() => DEVICE_LOCALES);

export const getCalendars = jest.fn(() => DEVICE_CALENDARS);

// 실제 훅처럼 OS 설정이 바뀌기 전까지 같은 참조를 돌려준다.
export const useLocales = () => DEVICE_LOCALES;

export const useCalendars = () => DEVICE_CALENDARS;
