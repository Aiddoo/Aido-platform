import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useRouter } from 'expo-router';

/** 카테고리 만들기를 연다. 한도에 막혔으면 만들기 대신 한도 안내를 띄운다 */
export function useOpenCategoryCreate() {
  const router = useRouter();
  const push = useSingleTap(router.push);
  const gate = useEntitlementGate('TODO_CATEGORY', { surface: 'category_create' });

  // 이름을 다 쓴 뒤에 막히지 않게 시트를 열기 전에 확인한다
  return () => {
    if (gate.promptIfBlocked()) {
      return;
    }
    push('/todo-categories/new');
  };
}
