import {
  notificationActionSchema,
  notificationNavigationSchema,
  notificationRoutingSchema,
  notificationTypeSchema,
} from '@aido/api';
import { z } from 'zod';

/** 서버 spec과 함께 읽는 대조표 한 줄. 푸시 data의 source와 기대하는 이동을 짝짓는다. */
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

export const navigationCasesSchema = z.array(navigationCaseSchema);
