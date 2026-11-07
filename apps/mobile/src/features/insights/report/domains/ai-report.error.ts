import { classifyBoundaryError } from '@src/shared/errors';

/** 지워졌거나 볼 수 없는 리포트(AI_1304 등 404)는 다시 시도해도 같다 */
export function isReportUnavailable(error: unknown) {
  return classifyBoundaryError(error) === 'expected-state';
}
