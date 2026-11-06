import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useCallback } from 'react';

import {
  categorySettingsParamsSchema,
  type CategorySettingsView,
} from '../schemas/category-settings-params.schema';

/** 카테고리 설정 화면의 편집·순서 탭 */
export function useCategorySettingsViewParam() {
  const [{ view }, setParams] = useRouteParams(categorySettingsParamsSchema);
  const setView = useCallback(
    (next: CategorySettingsView) => setParams({ view: next }),
    [setParams],
  );

  return [view, setView] as const;
}
