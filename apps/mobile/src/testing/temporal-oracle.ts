// 앱은 Temporal 없이 날짜를 계산한다. 테스트는 서버와 같은 Node 26 네이티브 Temporal을 정답으로 비교한다
interface OracleInstant {
  toString(options: { fractionalSecondDigits: 3 }): string;
}

interface OraclePlainDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly dayOfWeek: number;
  readonly yearOfWeek: number;
  readonly daysInMonth: number;
  add(duration: { days?: number; months?: number }): OraclePlainDate;
  until(other: OraclePlainDate): { readonly days: number };
  toPlainDateTime(time: unknown): {
    toZonedDateTime(
      timeZone: string,
      options: { disambiguation: 'compatible' },
    ): { toInstant(): OracleInstant };
  };
  toString(): string;
}

interface NativeTemporal {
  PlainDate: { from(value: string): OraclePlainDate };
  PlainTime: { from(value: string): unknown };
}

function isNativeTemporal(value: unknown): value is NativeTemporal {
  return typeof value === 'object' && value != null && 'PlainDate' in value && 'PlainTime' in value;
}

function getNativeTemporal(): NativeTemporal {
  const temporal: unknown = Reflect.get(globalThis, 'Temporal');
  if (!isNativeTemporal(temporal)) {
    throw new Error('Node 26 이상의 네이티브 Temporal이 필요하다');
  }
  return temporal;
}

function toPlainDate(dateKey: string): OraclePlainDate {
  return getNativeTemporal().PlainDate.from(dateKey);
}

export const temporalOracle = {
  addDays: (dateKey: string, days: number) => toPlainDate(dateKey).add({ days }).toString(),
  addMonths: (dateKey: string, months: number) => toPlainDate(dateKey).add({ months }).toString(),
  /** 0=일 … 6=토 */
  dayOfWeek: (dateKey: string) => toPlainDate(dateKey).dayOfWeek % 7,
  isoWeekYear: (dateKey: string) => toPlainDate(dateKey).yearOfWeek,
  daysInMonth: (dateKey: string) => toPlainDate(dateKey).daysInMonth,
  diffDays: (from: string, to: string) => toPlainDate(from).until(toPlainDate(to)).days,
  /** 서버 toZonedInstant와 같은 규칙(겹치면 앞쪽, 없으면 전환 뒤) */
  toZonedInstant: (date: string, time: string, timeZone: string) =>
    toPlainDate(date)
      .toPlainDateTime(getNativeTemporal().PlainTime.from(time))
      .toZonedDateTime(timeZone, { disambiguation: 'compatible' })
      .toInstant()
      .toString({ fractionalSecondDigits: 3 }),
} as const;
