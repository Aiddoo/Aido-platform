import { uniq } from 'es-toolkit';
import { z } from 'zod';

import {
  type WidgetNavigationDestination,
  widgetFeedParametersSchema,
} from '../domains/widget-navigation.model';

const WIDGET_URI_PROTOCOLS = new Set(['aido:', 'aido-dev:', 'aido-preview:']);

function parseUrl(uri: string): URL | null {
  try {
    return new URL(uri);
  } catch {
    return null;
  }
}

function toDestination(uri: string): WidgetNavigationDestination | null {
  const parsed = parseUrl(uri);
  if (parsed == null || !WIDGET_URI_PROTOCOLS.has(parsed.protocol)) {
    return null;
  }
  if (parsed.username || parsed.password || parsed.hash || parsed.port) {
    return null;
  }

  const path = `/${parsed.hostname}${parsed.pathname}`.replace(/\/$/, '');
  if (path === '/feed') {
    const parameterKeys = [...parsed.searchParams.keys()];
    if (uniq(parameterKeys).length !== parameterKeys.length) {
      return null;
    }
    // 칸을 먼저 엄격하게 읽고 종류를 붙여 query가 목적지 종류를 정하지 못하게 한다
    const result = widgetFeedParametersSchema.safeParse(Object.fromEntries(parsed.searchParams));
    return result.success ? { kind: 'feed', ...result.data } : null;
  }

  const todoId = /^\/todo\/([1-9]\d*)$/.exec(path)?.[1];
  return todoId && !parsed.search && Number.isSafeInteger(Number(todoId))
    ? { kind: 'todo', todoId }
    : null;
}

/** 위젯이 넘기는 URI(`aido://feed?…`·`aido://todo/{id}`, 외부 계약)를 목적지로 읽는다. 허용하지 않거나 깨진 URI는 실패다 */
export const widgetNavigationUriSchema = z.string().transform((uri, context) => {
  const destination = toDestination(uri);
  if (destination == null) {
    context.addIssue({ code: 'custom', message: '위젯이 열 수 없는 주소' });
    return z.NEVER;
  }
  return destination;
});
