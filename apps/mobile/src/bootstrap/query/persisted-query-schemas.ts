import { entitlementSnapshotSchema } from '@src/features/billing/subscription/domains/entitlement.model';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/queries/entitlement-query-keys';
import { preferenceSchema } from '@src/features/identity/preference/domains/preference.model';
import { PREFERENCE_QUERY_KEYS } from '@src/features/identity/preference/queries/preference-query-keys';
import { userSchema } from '@src/features/identity/user/domains/user.model';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { todoCategoriesResultSchema } from '@src/features/planning/category/domains/todo-category.model';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/planning/category/queries/todo-category-query-keys';
import { dailyCompletionsResultSchema } from '@src/features/planning/todo/domains/daily-completion.model';
import { todoListResultSchema } from '@src/features/planning/todo/domains/todo.model';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/queries/todo-query-keys';
import { friendUserPagesSchema } from '@src/features/social/friend/domains/friend.model';
import { FRIEND_QUERY_KEYS } from '@src/features/social/friend/queries/friend-query-keys';
import { locationReadingSchema } from '@src/features/weather/domains/weather-location.model';
import { weatherReportSchema } from '@src/features/weather/domains/weather-report.model';
import { WEATHER_QUERY_KEYS } from '@src/features/weather/queries/weather-query-keys';

import type { PersistedQuerySchema } from './query-cache-persistence';

/** `meta.persist`를 다는 조회마다 한 줄씩 둔다. 없으면 복원 때 검증할 수 없어 버려진다 */
export const PERSISTED_QUERY_SCHEMAS: readonly PersistedQuerySchema[] = [
  { queryKey: USER_QUERY_KEYS.me(), schema: userSchema },
  { queryKey: TODO_QUERY_KEYS.lists(), schema: todoListResultSchema },
  { queryKey: TODO_CATEGORY_QUERY_KEYS.list(), schema: todoCategoriesResultSchema },
  { queryKey: TODO_QUERY_KEYS.completionRanges(), schema: dailyCompletionsResultSchema },
  { queryKey: ENTITLEMENT_QUERY_KEYS.snapshot(), schema: entitlementSnapshotSchema },
  { queryKey: PREFERENCE_QUERY_KEYS.current(), schema: preferenceSchema },
  { queryKey: FRIEND_QUERY_KEYS.friends(), schema: friendUserPagesSchema },
  { queryKey: WEATHER_QUERY_KEYS.location(), schema: locationReadingSchema },
  { queryKey: WEATHER_QUERY_KEYS.reports(), schema: weatherReportSchema },
];
