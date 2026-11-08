import { useAppLifecycleState } from './use-app-lifecycle-state';

/** 앱이 사용자 앞에 떠 있는지 */
export function useIsAppActive(): boolean {
  return useAppLifecycleState() === 'active';
}
