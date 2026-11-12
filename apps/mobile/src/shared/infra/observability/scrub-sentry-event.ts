import type { Breadcrumb, Event } from '@sentry/react-native';
import { TELEMETRY_DATA_KEYS } from '@src/core/observability/telemetry-keys';
import { isNil, mapValues, omitBy, pickBy } from 'es-toolkit';

const MAX_TEXT_LENGTH = 500;

/** 목록(`TELEMETRY_DATA_KEYS`)에 없는 키는 지운다. 로그·breadcrumb 타입이 같은 목록이라 새 키는 타입 오류로 먼저 걸린다 */
const ALLOWED_CONTEXT_KEYS: ReadonlySet<string> = new Set(TELEMETRY_DATA_KEYS);

const TEXT_PATTERNS: readonly (readonly [RegExp, string])[] = [
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]'],
  [/Bearer\s+\S+/gi, 'Bearer [token]'],
  [/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]'],
  [/[A-Za-z0-9_-]{40,}/g, '[token]'],
];

const SENSITIVE_HEADERS: ReadonlySet<string> = new Set(['authorization', 'cookie', 'set-cookie']);

function stripQuery(url: string): string {
  return url.replace(/[?#].*$/, '');
}

/** 이메일·토큰 모양을 가리고 길이를 자른다 */
export function scrubText(text: string): string {
  const scrubbed = TEXT_PATTERNS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text,
  );
  return scrubbed.length > MAX_TEXT_LENGTH ? `${scrubbed.slice(0, MAX_TEXT_LENGTH)}…` : scrubbed;
}

function scrubValue(key: string, value: unknown): unknown {
  if (typeof value === 'string') {
    return scrubText(key === 'url' ? stripQuery(value) : value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return undefined;
}

/** 객체·배열 값은 사용자 글이 섞일 수 있어 지운다 */
export function scrubContext(
  context: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (context == null) {
    return undefined;
  }
  const allowed = pickBy(context, (_value, key) => ALLOWED_CONTEXT_KEYS.has(key));
  return omitBy(
    mapValues(allowed, (value, key) => scrubValue(key, value)),
    isNil,
  );
}

/** 콘솔 출력(로거 context가 그대로 담긴다)은 breadcrumb로 남기지 않는다 */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === 'console') {
    return null;
  }
  if (breadcrumb.message != null) {
    breadcrumb.message = scrubText(breadcrumb.message);
  }
  if (breadcrumb.data != null) {
    breadcrumb.data = scrubContext(breadcrumb.data);
  }
  return breadcrumb;
}

function scrubRequest(request: NonNullable<Event['request']>): NonNullable<Event['request']> {
  const headers = Object.fromEntries(
    Object.entries(request.headers ?? {}).filter(
      ([name]) => !SENSITIVE_HEADERS.has(name.toLowerCase()),
    ),
  );
  return {
    ...(request.url != null && { url: stripQuery(request.url) }),
    ...(request.method != null && { method: request.method }),
    headers,
  };
}

/** `beforeSend`: 이벤트에서 사용자 글·토큰·이메일을 지운다. 사용자는 내부 id만 남긴다 */
export function scrubSentryEvent<T extends Event>(event: T): T {
  if (event.message != null) {
    event.message = scrubText(event.message);
  }
  for (const exception of event.exception?.values ?? []) {
    if (exception.value != null) {
      exception.value = scrubText(exception.value);
    }
  }
  if (event.extra != null) {
    event.extra = scrubContext(event.extra);
  }
  if (event.breadcrumbs != null) {
    event.breadcrumbs = event.breadcrumbs.flatMap((breadcrumb) => {
      const scrubbed = scrubBreadcrumb(breadcrumb);
      return scrubbed == null ? [] : [scrubbed];
    });
  }
  if (event.request != null) {
    event.request = scrubRequest(event.request);
  }
  if (event.user != null) {
    event.user = event.user.id != null ? { id: event.user.id } : undefined;
  }
  return event;
}
