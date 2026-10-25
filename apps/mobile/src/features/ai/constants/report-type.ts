import type { Chip } from 'heroui-native';
import type { ComponentProps } from 'react';

import type { ReportType } from '../domains/ai.model';

export const REPORT_TYPE_LABEL_KEYS = {
  WEEKLY: 'report.typeWeekly',
  MONTHLY: 'report.typeMonthly',
} as const satisfies Record<ReportType, string>;

export const REPORT_TYPE_CHIP_COLORS = {
  WEEKLY: 'accent',
  MONTHLY: 'success',
} as const satisfies Record<ReportType, ComponentProps<typeof Chip>['color']>;
