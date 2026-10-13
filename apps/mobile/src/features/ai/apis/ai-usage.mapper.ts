import type { AiUsageResponse } from '@aido/api';

import type { AiUsage } from '../domains/ai-usage.model';

export const toAiUsage = (dto: AiUsageResponse): AiUsage => ({
  ...dto.data,
  resetsAt: new Date(dto.data.resetsAt),
});
