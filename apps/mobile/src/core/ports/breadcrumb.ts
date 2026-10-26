import type { Severity } from '@src/core/ports/severity';
import type { BreadcrumbCategory } from '@src/shared/observability/telemetry-keys';

export interface Breadcrumb {
  category: BreadcrumbCategory;
  message: string;
  level?: Severity;
  data?: Record<string, unknown>;
}
