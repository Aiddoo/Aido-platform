import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { type Href, router } from 'expo-router';

interface UseGoBackOptions {
  /** 돌아갈 화면이 없을 때(푸시·딥링크로 바로 연 경우) 대신 여는 화면. 없으면 아무것도 하지 않는다 */
  fallbackHref?: Href;
}

/** 이전 화면으로 돌아간다. 연타로 두 번 돌아가지 않는다 */
export function useGoBack({ fallbackHref }: UseGoBackOptions = {}): () => void {
  return useSingleTap(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (fallbackHref != null) {
      router.replace(fallbackHref);
    }
  });
}
