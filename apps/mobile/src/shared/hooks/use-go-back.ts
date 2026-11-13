import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { type Href, router } from 'expo-router';

/** 돌아갈 화면이 없을 때(푸시·딥링크로 바로 연 경우) 할 일. 둘 다 없으면 아무것도 하지 않는다 */
type UseGoBackOptions =
  | {
      /** 대신 여는 화면 */
      fallbackHref?: Href;
      onFallback?: never;
    }
  | {
      fallbackHref?: never;
      /** 화면이 아닌 대신 할 일(같은 화면의 단계 바꾸기 등) */
      onFallback?: () => void;
    };

/** 이전 화면으로 돌아간다. 연타로 두 번 돌아가지 않는다 */
export function useGoBack({ fallbackHref, onFallback }: UseGoBackOptions = {}): () => void {
  return useSingleTap(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (fallbackHref != null) {
      router.replace(fallbackHref);
      return;
    }
    onFallback?.();
  });
}
