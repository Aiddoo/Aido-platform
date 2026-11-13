import { createRuleTester } from '../rule-tester.mjs';
import rules from './location.mjs';

const tester = createRuleTester();

tester.run('track-location', rules['track-location'], {
  valid: [
    "import { useTrack } from '@src/shared/analytics/use-track-like';",
    "import type { Analytics } from '@src/core/ports/analytics';",
    "import { toTodo } from './todo.mapper';",
    'analytics.getAnalyticsId();',
  ],
  invalid: [
    { code: "import { useTrack } from '@src/shared/analytics';", errors: 1 },
    { code: "import { track } from '@src/shared/analytics/track';", errors: 1 },
    { code: "import { track, useTrack } from '@src/shared/analytics';", errors: 2 },
    { code: "import { track } from './track';", errors: 1 },
    {
      code: "class Sync { #analytics = port; run() { this.#analytics.trackEvent('todo_created', {}); } }",
      errors: 1,
    },
    { code: "const { trackEvent } = useTrack();\ntrackEvent('todo_created', {});", errors: 1 },
  ],
});

tester.run('query-client-location', rules['query-client-location'], {
  valid: [
    'const queryClient = useQueryClient();\nrefreshMemos(queryClient);',
    'const client = useQueryClient();\ninvalidateTodos(client, { todoId });',
    'api.getTodos();',
    'const { data } = useQuery(options);',
  ],
  invalid: [
    {
      code: 'const queryClient = useQueryClient();\nqueryClient.invalidateQueries({ queryKey: KEYS.all });',
      errors: 1,
    },
    {
      code: 'const client = useQueryClient();\nconst consent = client.getQueryData(options.queryKey);',
      errors: 1,
    },
    { code: 'function clear(cache: QueryClient) { cache.clear(); }', errors: 1 },
    { code: 'useQueryClient().ensureQueryData(options);', errors: 1 },
    { code: 'const client = new QueryClient();', errors: 1 },
  ],
});

tester.run('storage-key-location', rules['storage-key-location'], {
  valid: [
    'const key = calendarViewModeStoredValue.key;',
    "const label = 'aido';",
    'const id = `todo_${todoId}`;',
  ],
  invalid: [
    { code: "const KEY = 'aido_calendar_view_mode_v1';", errors: 1 },
    { code: 'const key = `aido_all_done_banner_v1:${accountId}`;', errors: 1 },
    { code: "storage.getString('aido_language');", errors: 1 },
  ],
});

tester.run('http-status-literal', rules['http-status-literal'], {
  valid: [
    'error.status === HttpStatus.NOT_FOUND;',
    'items.length === 404;',
    'response.status === 0;',
    'const RETRY_COUNT = 3;',
    "const NOTIFICATION_STATUS = 'READ';",
  ],
  invalid: [
    { code: 'isApiError(error) && error.status === 404;', errors: 1 },
    { code: 'if (response.status !== 401) {}', errors: 1 },
    { code: 'error.response.status >= 500;', errors: 1 },
    { code: '400 <= error.status && error.status < 500;', errors: 2 },
    { code: 'const NOT_FOUND_STATUS = 404;', errors: 1 },
    { code: 'const TOO_MANY_REQUESTS_STATUS = 429 as const;', errors: 1 },
    { code: 'switch (error.status) { case 409: break; default: break; }', errors: 1 },
  ],
});

tester.run('app-state-location', rules['app-state-location'], {
  valid: [
    "import { type AppStateStatus, View } from 'react-native';",
    "import type { AppState } from 'react-native';",
    "import { AppState } from './app-state';",
  ],
  invalid: [
    { code: "import { AppState } from 'react-native';", errors: 1 },
    { code: "import { AppState, type AppStateStatus } from 'react-native';", errors: 1 },
  ],
});

tester.run('back-handler-location', rules['back-handler-location'], {
  valid: ["import { Keyboard } from 'react-native';"],
  invalid: [{ code: "import { BackHandler, Keyboard } from 'react-native';", errors: 1 }],
});
