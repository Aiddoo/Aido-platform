import { useContext, useEffect, useId, useRef } from 'react';

import { OverlayItem, type OverlayRender } from './OverlayItem';
import { OverlayContext } from './OverlayProvider';

/**
 * 화면 밖(루트)에 무언가를 띄우고, 닫힐 때 값을 돌려받는다.
 *
 * ⚠️ **열 때의 화면이 스냅샷으로 굳는다.**
 * `open(render)`는 그 자리에서 element를 만들어 Provider에 넘긴다. 그 뒤 부모가 다시
 * 렌더돼도 이 element는 갱신되지 않으므로, **부모의 반응형 값을 props로 넘기면 그 값에
 * 얼어붙는다** — 예를 들어 `isSubmitting={mutation.isPending}`은 영원히 `false`로 남아
 * 로딩 표시도 중복 탭 방지도 동작하지 않는다.
 *
 * 그래서 **띄우는 내용이 자기 상태를 스스로 가져야 한다.** 진행 중 여부가 필요하면
 * 콜백을 `Promise`로 받아 안에서 `useState`로 재고, 서버 값이 필요하면 안에서 쿼리를 읽는다.
 * 열 때 정해지고 변하지 않는 것(대상, 초기값)만 인자로 넘긴다.
 *
 * @example
 * ```tsx
 * // ✅ 시트가 보내는 동안을 스스로 안다
 * onSubmit={async (value) => { await mutateAsync(value); close(value); }}
 *
 * // ❌ 부모의 isPending은 스냅샷에 얼어붙는다
 * isSubmitting={mutation.isPending}
 * ```
 */
export const useOverlay = () => {
  const controller = useContext(OverlayContext);

  if (!controller) {
    throw new Error('useOverlay must be used within OverlayProvider');
  }

  const id = useId();
  const generationRef = useRef(0);

  useEffect(() => {
    return () => controller.unmount(id);
  }, [controller, id]);

  const open = <T = void,>(render: OverlayRender<T>): Promise<T> => {
    const generation = ++generationRef.current;

    return new Promise<T>((resolve) => {
      controller.mount(
        id,
        <OverlayItem<T>
          render={render}
          onResolve={resolve}
          onUnmount={() => {
            if (generationRef.current === generation) {
              controller.unmount(id);
            }
          }}
        />,
      );
    });
  };

  return { open };
};
