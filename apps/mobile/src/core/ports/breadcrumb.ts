import type { Severity } from '@src/core/ports/severity';

/**
 * Sentry breadcrumb 카테고리(벤더 중립).
 *
 * 이벤트/크래시 직전의 행적을 분류해 대시보드에서 필터할 수 있게 한다.
 * 자유 문자열 대신 union으로 고정해 오탈자·미정의 카테고리를 컴파일 타임에 막는다.
 */
export type BreadcrumbCategory = 'http' | 'navigation' | 'auth' | 'lifecycle' | 'ui' | 'widget';

export interface Breadcrumb {
  category: BreadcrumbCategory;
  message: string;
  level?: Severity;
  data?: Record<string, unknown>;
}
