import type { Severity } from '@src/core/observability/severity';
import type { BreadcrumbCategory } from '@src/core/observability/telemetry-keys';

export interface Breadcrumb {
  category: BreadcrumbCategory;
  message: string;
  level?: Severity;
  data?: Record<string, unknown>;
}
