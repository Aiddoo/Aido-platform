import { dateSchema } from '@aido/validators';
import type { Href } from 'expo-router';
import { z } from 'zod';

const WidgetFeedParametersSchema = z.object({
  date: z.union([dateSchema, z.literal('today')]),
  action: z.literal('add-todo').optional(),
});

export function resolveWidgetAppRoute(url: string | null): Href | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (!['aido:', 'aido-dev:', 'aido-preview:'].includes(parsed.protocol)) return null;
    if (parsed.username || parsed.password || parsed.hash) return null;

    const routePath = `/${parsed.hostname}${parsed.pathname}`.replace(/\/$/, '');
    if (routePath === '/feed') {
      const parameters = Object.fromEntries(parsed.searchParams);
      const result = WidgetFeedParametersSchema.strict().safeParse(parameters);
      return result.success ? { pathname: '/feed', params: result.data } : null;
    }

    const todoId = /^\/todo\/([1-9]\d*)$/.exec(routePath)?.[1];
    if (todoId && !parsed.search) {
      const id = Number(todoId);
      if (Number.isSafeInteger(id)) {
        return { pathname: '/todo/[todoId]', params: { todoId } };
      }
    }
    return null;
  } catch {
    return null;
  }
}
