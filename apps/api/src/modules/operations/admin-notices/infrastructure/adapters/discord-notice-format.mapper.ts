import {
  calendarDaysBetween,
  localDateInTimezone,
  toLocalTimeString,
} from "#api/shared/domain/date/utils/timezone";

/** 운영자가 한국에서 보므로 시각은 KST로 적는다. */
const OPERATOR_TIMEZONE = "Asia/Seoul";
const DAY_MS = 24 * 60 * 60 * 1_000;
const FIELD_VALUE_MAX_LENGTH = 1_024;
const TRANSACTION_ID_MAX_LENGTH = 20;

export const EMPTY = "—";

export interface DiscordEmbedField {
  readonly name: string;
  readonly value: string;
  readonly inline?: boolean;
}

/** @see https://discord.com/developers/docs/resources/message#embed-object */
export interface DiscordEmbed {
  readonly title: string;
  readonly description: string;
  readonly color: number;
  readonly fields: readonly DiscordEmbedField[];
  readonly url?: string;
  readonly timestamp: string;
}

/** Discord는 빈 값·1024자 넘는 값의 필드를 거절하므로 표시 값을 그 안으로 맞춘다. */
export function field(name: string, value: string | undefined, inline = true): DiscordEmbedField {
  const shown = value == null || value.trim() === "" ? EMPTY : value;
  return {
    name,
    value:
      shown.length > FIELD_VALUE_MAX_LENGTH
        ? `${shown.slice(0, FIELD_VALUE_MAX_LENGTH - 1)}…`
        : shown,
    inline,
  };
}

function dateOf(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `2026-12-10 09:00 KST`. 읽을 수 없는 값은 원문 그대로 둔다. */
export function formatKst(iso: string | undefined): string | undefined {
  if (iso == null) {
    return undefined;
  }
  const date = dateOf(iso);
  if (date == null) {
    return iso;
  }
  return `${localDateInTimezone(date, OPERATOR_TIMEZONE)} ${toLocalTimeString(date, OPERATOR_TIMEZONE)} KST`;
}

/** KST 시각 뒤에 Discord 상대 시각(`3일 후`)을 붙인다. 상대 시각은 보는 사람의 앱이 그린다. */
export function formatKstWithRelative(iso: string | undefined): string | undefined {
  const kst = formatKst(iso);
  const date = iso == null ? null : dateOf(iso);
  return date == null ? kst : `${kst} · <t:${Math.floor(date.getTime() / 1_000)}:R>`;
}

/** 가입일과 가입 뒤 지난 날(KST 달력). 예: `2026-10-01 (D+40)` */
export function formatJoined(joinedAt: string | undefined, at: string): string | undefined {
  const joined = joinedAt == null ? null : dateOf(joinedAt);
  const now = dateOf(at);
  if (joined == null || now == null) {
    return joinedAt;
  }
  const days = calendarDaysBetween(joined, now, OPERATOR_TIMEZONE);
  const date = localDateInTimezone(joined, OPERATOR_TIMEZONE);
  return days <= 0 ? `${date} (D+0, 오늘 가입)` : `${date} (D+${days})`;
}

/** 지금부터 끝나는 시각까지 남은 날. 하루가 안 남았어도 1일로 센다. */
export function daysUntil(endsAt: string, at: string): number | null {
  const end = dateOf(endsAt);
  const now = dateOf(at);
  if (end == null || now == null) {
    return null;
  }
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
}

/** 통화 기호를 붙인 금액. 모르는 통화 코드는 숫자 뒤에 코드를 적는다. 웹훅 값(음수 포함)을 그대로 쓴다. */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("ko-KR", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toLocaleString("ko-KR")} ${currency}`;
  }
}

const REGION_NAMES = new Intl.DisplayNames(["ko"], { type: "region", fallback: "none" });

function regionNameOf(code: string): string | undefined {
  try {
    return REGION_NAMES.of(code);
  } catch {
    return undefined;
  }
}

/** `🇰🇷 대한민국 (KR)`. 두 글자 국가 코드가 아니면 원문을 적는다. */
export function formatCountry(countryCode: string | undefined): string | undefined {
  if (countryCode == null || countryCode === "") {
    return undefined;
  }
  const code = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    return code;
  }
  const flag = String.fromCodePoint(
    ...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  );
  const name = regionNameOf(code);
  return name == null ? `${flag} ${code}` : `${flag} ${name} (${code})`;
}

export function formatCode(value: string | undefined): string | undefined {
  return value == null || value === "" ? undefined : `\`${value}\``;
}

/** 긴 거래 ID는 앞뒤만 남긴다. 전체 값은 공급자 고객 화면에서 본다. */
export function formatTransactionId(transactionId: string | undefined): string | undefined {
  if (transactionId == null || transactionId === "") {
    return undefined;
  }
  if (transactionId.length <= TRANSACTION_ID_MAX_LENGTH) {
    return `\`${transactionId}\``;
  }
  return `\`${transactionId.slice(0, 8)}…${transactionId.slice(-6)}\``;
}
