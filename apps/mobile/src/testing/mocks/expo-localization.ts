// expo-localization 네이티브 모듈 mock (jest.config.js moduleNameMapper에서 매핑)
import { UTC_EQUIVALENT_TIMEZONE_NAMES } from '@aido/api/vocabulary';

const PROCESS_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const UTC_EQUIVALENT_NAMES = new Set<string>(UTC_EQUIVALENT_TIMEZONE_NAMES);
// 기기 시간대는 프로세스 시간대(테스트의 로컬 Date)와 같은 벽시계여야 한다. 앱은 UTC 계열 이름을 못 읽은 값으로 보므로
// 프로세스가 UTC(CI)면 1912년부터 늘 +0인 지역 이름을 보고한다
const DEVICE_TIMEZONE = UTC_EQUIVALENT_NAMES.has(PROCESS_TIMEZONE)
  ? 'Africa/Abidjan'
  : PROCESS_TIMEZONE;

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
    timeZone: DEVICE_TIMEZONE,
    weekendDays: [1, 7],
  },
];

export const getLocales = jest.fn(() => DEVICE_LOCALES);

export const getCalendars = jest.fn(() => DEVICE_CALENDARS);

// 실제 훅처럼 OS 설정이 바뀌기 전까지 같은 참조를 돌려준다.
export const useLocales = () => DEVICE_LOCALES;

export const useCalendars = () => DEVICE_CALENDARS;
