import { SERVICE_DEFAULT_TIMEZONE, UTC_EQUIVALENT_TIMEZONE_NAMES } from '@aido/api/vocabulary';
import { z } from 'zod';

import timezoneReportCases from '../../../../../packages/api/test/fixtures/timezone-report-cases.json';
import {
  isSupportedTimezone,
  parseDeviceReportedTimezone,
  resolveAppTimezone,
  type TimezoneSupport,
} from './timezone';

/** 서버 parseDeviceReportedTimezone(timezone-name.spec.ts)도 같은 표를 읽는다. 어긋나면 어느 한쪽이 깨진다 */
const SHARED_TIMEZONE_REPORT_CASES = z
  .object({
    deviceReportedTimezone: z.array(
      z.object({
        name: z.string(),
        value: z.string().nullable(),
        reported: z.string().nullable(),
      }),
    ),
  })
  .parse(timezoneReportCases);

// Hermes가 모르는 이름은 Jest(Node)에서 재현되지 않아 이름을 아는지 묻는 부분을 바꿔 끼운다
const knowsOnly =
  (...names: string[]): TimezoneSupport =>
  (timezone) =>
    names.includes(timezone);

describe('parseDeviceReportedTimezone', () => {
  it.each(SHARED_TIMEZONE_REPORT_CASES.deviceReportedTimezone)(
    '기기 보고 시간대 표: $name',
    ({ value, reported }) => {
      // When
      const timezone = parseDeviceReportedTimezone(value, isSupportedTimezone);

      // Then
      expect(timezone).toBe(reported);
    },
  );

  it.each(UTC_EQUIVALENT_TIMEZONE_NAMES.flatMap((name) => [name, name.toUpperCase()]))(
    '서버와 공유하는 UTC 계열 이름 %s는 대소문자와 상관없이 읽지 못한 것이다',
    (name) => {
      // When
      const timezone = parseDeviceReportedTimezone(name, isSupportedTimezone);

      // Then
      expect(timezone).toBeNull();
    },
  );

  it.each(['GMT+1', 'GMT+09:00', 'UTC+9', 'gmt-0530'])(
    '기기 설정의 사용자 지정 ID %s는 런타임이 받아도 읽지 못한 것이다',
    (value) => {
      // Given
      const runtimeAcceptsAnyName = () => true;

      // When
      const timezone = parseDeviceReportedTimezone(value, runtimeAcceptsAnyName);

      // Then
      expect(timezone).toBeNull();
    },
  );

  it('런타임 Intl이 모르는 이름은 읽지 못한 것이다', () => {
    // Given
    const hermesKnows = knowsOnly('Asia/Seoul');

    // When
    const unknown = parseDeviceReportedTimezone('Asia/Kolkata', hermesKnows);
    const known = parseDeviceReportedTimezone('Asia/Seoul', hermesKnows);

    // Then
    expect(unknown).toBeNull();
    expect(known).toBe('Asia/Seoul');
  });
});

describe('resolveAppTimezone', () => {
  it.each([
    {
      label: '기기 값을 읽으면 그 값이다',
      deviceTimezone: 'America/New_York',
      lastReadTimezone: 'Asia/Seoul',
      expected: { timezone: 'America/New_York', isDeviceRead: true },
    },
    {
      label: '오프셋이 0인 지역 이름은 읽은 값이다',
      deviceTimezone: 'Europe/London',
      lastReadTimezone: 'Asia/Seoul',
      expected: { timezone: 'Europe/London', isDeviceRead: true },
    },
    {
      label: '기기 값이 없으면 마지막으로 읽은 값이다',
      deviceTimezone: null,
      lastReadTimezone: 'Asia/Seoul',
      expected: { timezone: 'Asia/Seoul', isDeviceRead: false },
    },
    {
      label: '기기가 UTC를 주면 마지막으로 읽은 값이다',
      deviceTimezone: 'Etc/UTC',
      lastReadTimezone: 'America/New_York',
      expected: { timezone: 'America/New_York', isDeviceRead: false },
    },
    {
      label: '처음 설치해 읽은 적이 없으면 서비스 기본 시간대다',
      deviceTimezone: 'UTC',
      lastReadTimezone: null,
      expected: { timezone: SERVICE_DEFAULT_TIMEZONE, isDeviceRead: false },
    },
  ])('$label', ({ deviceTimezone, lastReadTimezone, expected }) => {
    // When
    const resolved = resolveAppTimezone({ deviceTimezone, lastReadTimezone }, isSupportedTimezone);

    // Then
    expect(resolved).toEqual(expected);
  });

  it('기기 값도 마지막 값도 런타임이 모르는 이름이면 서비스 기본 시간대다', () => {
    // Given
    const hermesKnows = knowsOnly(SERVICE_DEFAULT_TIMEZONE);

    // When
    const resolved = resolveAppTimezone(
      { deviceTimezone: 'Asia/Kolkata', lastReadTimezone: 'Asia/Calcutta' },
      hermesKnows,
    );

    // Then
    expect(resolved).toEqual({ timezone: SERVICE_DEFAULT_TIMEZONE, isDeviceRead: false });
  });
});
