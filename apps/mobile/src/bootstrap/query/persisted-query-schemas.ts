import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/constants/entitlement-query-keys';
import { entitlementSnapshotSchema } from '@src/features/billing/subscription/domains/entitlement.model';
import { PREFERENCE_QUERY_KEYS } from '@src/features/identity/preference/constants/preference-query-keys';
import { preferenceSchema } from '@src/features/identity/preference/domains/preference.model';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import { userSchema } from '@src/features/identity/user/domains/user.model';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/planning/category/constants/todo-category-query-keys';
import { todoCategoriesResultSchema } from '@src/features/planning/category/domains/todo-category.model';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/constants/todo-query-keys';
import { dailyCompletionsResultSchema } from '@src/features/planning/todo/domains/daily-completion.model';
import { todoListResultSchema } from '@src/features/planning/todo/domains/todo.model';
import { FRIEND_QUERY_KEYS } from '@src/features/social/friend/constants/friend-query-keys';
import { friendUserPagesSchema } from '@src/features/social/friend/domains/friend.model';
import { WEATHER_QUERY_KEYS } from '@src/features/weather/constants/weather-query-keys';
import { locationReadingSchema } from '@src/features/weather/domains/weather-location.model';
import { weatherReportSchema } from '@src/features/weather/domains/weather-report.model';

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
