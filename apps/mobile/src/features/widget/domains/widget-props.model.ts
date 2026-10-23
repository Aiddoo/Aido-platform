import { z } from 'zod';

import { widgetRenderStateSchema } from './widget-snapshot.model';

const widgetPropsSchema = z.object({
  state: widgetRenderStateSchema,
  date: z.string(),
  opensApp: z.boolean(),
  maxRows: z.number(),
  totalTodos: z.number(),
  completedTodos: z.number(),
  completionRate: z.number(),
  isComplete: z.boolean(),
  currentStreak: z.number(),
  topTodos: z.array(
    z.object({
      id: z.number().int().positive().optional(),
      title: z.string(),
      completed: z.boolean(),
      color: z.string(),
      destination: z.string().optional(),
    }),
  ),
  weekDays: z
    .array(
      z.object({
        date: z.string(),
        weekdayLabel: z.string(),
        dayLabel: z.string(),
        isComplete: z.boolean(),
        hasTodos: z.boolean(),
        isToday: z.boolean(),
        destination: z.string(),
      }),
    )
    .optional(),
  weekTitle: z.string().optional(),
  weekRangeLabel: z.string().optional(),
  addTodoLabel: z.string().optional(),
  openTodoLabel: z.string().optional(),
  openAppUrl: z.string().optional(),
  addTodoUrl: z.string().optional(),
  progressTitle: z.string(),
  percentLabel: z.string(),
  streakLabel: z.string(),
  compactStreakLabel: z.string(),
  allDoneLabel: z.string(),
  moreLabelTemplate: z.string(),
  stateTitle: z.string(),
  stateCta: z.string(),
  staleTitle: z.string(),
  staleCta: z.string(),
});
export type WidgetProps = z.infer<typeof widgetPropsSchema>;
