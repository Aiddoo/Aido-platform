import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  notificationActionSchema,
  notificationNavigationSchema,
  notificationRoutingSchema,
  notificationTypeSchema,
} from '@aido/api';
import { z } from 'zod';

import type { NotificationDestinationSource } from '../utils/notification-destination';

const FIXTURE_PATH = join(
  __dirname,
  '../../../../../../packages/api/test-fixtures/notification-navigation.cases.json',
);

const navigationCaseSchema = z.object({
  name: z.string(),
  source: z.object({
    type: notificationTypeSchema,
    action: notificationActionSchema.optional(),
    todoId: z.number().optional(),
    friendId: z.string().optional(),
    nudgeId: z.number().optional(),
    cheerId: z.number().optional(),
    routing: notificationRoutingSchema.optional(),
  }),
  navigation: notificationNavigationSchema.nullable(),
  knownDifference: z.string().optional(),
});

export type NavigationCase = z.infer<typeof navigationCaseSchema>;

/** 서버 spec과 함께 읽는 대조표. `dist`에 들어가지 않는 packages/api 테스트 데이터다 */
export const NAVIGATION_CASES = z
  .array(navigationCaseSchema)
  .parse(JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')));

/** 서버가 푸시 data에 싣는 구 필드 모양으로 바꾼다 */
export function toLegacySource({
  type,
  action,
  todoId,
  friendId,
  nudgeId,
  cheerId,
  routing,
}: NavigationCase['source']): NotificationDestinationSource {
  return { type, action, routing, context: { todoId, friendId, nudgeId, cheerId } };
}
