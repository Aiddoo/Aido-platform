import type { BreadcrumbCategory } from '@src/core/observability/telemetry-keys';
import type { Severity } from '@src/core/ports/severity';

export interface Breadcrumb {
  category: BreadcrumbCategory;
  message: string;
  level?: Severity;
  data?: Record<string, unknown>;
}
