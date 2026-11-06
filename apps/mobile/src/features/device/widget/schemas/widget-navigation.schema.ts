import { dateSchema } from '@aido/api';
import { z } from 'zod';

const widgetFeedParametersSchema = z.strictObject({
  date: z.union([dateSchema, z.literal('today')]),
  action: z.literal('add-todo').optional(),
});

const widgetNavigationDestinationSchema = z.discriminatedUnion('kind', [
  widgetFeedParametersSchema.extend({ kind: z.literal('feed') }),
  z.object({ kind: z.literal('todo'), todoId: z.string() }),
]);
export type WidgetNavigationDestination = z.infer<typeof widgetNavigationDestinationSchema>;

/** URI는 원시값으로만 해석한다. Router·현재 계정·시계는 호출자가 제공한다. */
export function parseWidgetNavigationUri(uri: string | null): WidgetNavigationDestination | null {
  if (!uri) {
    return null;
  }

  try {
    const parsed = new URL(uri);
    if (!['aido:', 'aido-dev:', 'aido-preview:'].includes(parsed.protocol)) {
      return null;
    }
    if (parsed.username || parsed.password || parsed.hash || parsed.port) {
      return null;
    }

    const path = `/${parsed.hostname}${parsed.pathname}`.replace(/\/$/, '');
    if (path === '/feed') {
      const parameterKeys = [...parsed.searchParams.keys()];
      if (new Set(parameterKeys).size !== parameterKeys.length) {
        return null;
      }
      const parameters = Object.fromEntries(parsed.searchParams);
      const result = widgetFeedParametersSchema.safeParse(parameters);
      return result.success ? { kind: 'feed', ...result.data } : null;
    }

    const todoId = /^\/todo\/([1-9]\d*)$/.exec(path)?.[1];
    return todoId && !parsed.search && Number.isSafeInteger(Number(todoId))
      ? { kind: 'todo', todoId }
      : null;
  } catch {
    return null;
  }
}

export const widgetNavigationCommandSchema = z.object({
  id: z.string().min(1),
  uri: z.string().refine((uri) => parseWidgetNavigationUri(uri) != null),
  userId: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
});
export type WidgetNavigationCommand = z.infer<typeof widgetNavigationCommandSchema>;
