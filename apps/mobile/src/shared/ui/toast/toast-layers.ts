type ToastDuration = number | 'persistent';

/** heroui-native 토스트의 기본 표시 시간과 같다 */
export const TOAST_DURATION_MS = 4000;

export interface ToastLayerEntry<TRender> {
  id: string;
  render: TRender;
  duration: ToastDuration;
  /** 걷힌 면에서 옮겨 온 토스트. 이미 보이던 것이라 등장 움직임 없이 그린다 */
  isMoved: boolean;
  /** 시간이 다 되거나 밀어 닫거나 버튼으로 닫으면 불린다. 면이 걷힐 때는 불리지 않는다 */
  onHide: () => void;
}

/** 토스트를 그리는 면 하나(앱 루트, 열린 시트 route) */
export interface ToastLayer<TRender> {
  show: (entry: ToastLayerEntry<TRender>) => void;
}

interface ShownToast<TRender> {
  layer: ToastLayer<TRender>;
  render: TRender;
  expiresAtMs: number | null;
}

export interface ToastLayers<TRender> {
  /** 가장 위 면에 띄운다 */
  show: (render: TRender, duration: ToastDuration) => void;
  /**
   * 면을 쌓고 걷는 함수를 돌려준다. 걷으면 그 면에 아직 보이는 토스트를 남은 시간만큼 가장 위 면으로 옮긴다.
   * 앱 루트 면은 isBase로 맨 아래에 둔다. 시트 route가 앱과 함께 마운트되면 루트보다 먼저 쌓이기 때문이다
   */
  add: (layer: ToastLayer<TRender>, options?: { isBase?: boolean }) => () => void;
}

/**
 * iOS 시트 route는 루트 위에 따로 뜨는 모달이라 루트에 그린 토스트가 시트 배경 아래에 깔리고 VoiceOver가 읽지 못한다.
 * 그래서 열린 시트 route마다 면을 쌓아 가장 위 면에 띄우고, 시트가 닫히면 아직 보이는 토스트를 아래 면으로 옮긴다
 */
export function createToastLayers<TRender>({ now }: { now: () => number }): ToastLayers<TRender> {
  const layers: ToastLayer<TRender>[] = [];
  const shown = new Map<string, ShownToast<TRender>>();
  let sequence = 0;

  function showOn(
    layer: ToastLayer<TRender>,
    render: TRender,
    duration: ToastDuration,
    isMoved: boolean,
  ) {
    sequence += 1;
    const id = `app-toast-${sequence}`;
    shown.set(id, {
      layer,
      render,
      expiresAtMs: duration === 'persistent' ? null : now() + duration,
    });
    layer.show({ id, render, duration, isMoved, onHide: () => shown.delete(id) });
  }

  return {
    show: (render, duration) => {
      const top = layers.at(-1);
      if (top != null) {
        showOn(top, render, duration, false);
      }
    },
    add: (layer, { isBase = false } = {}) => {
      if (isBase) {
        layers.unshift(layer);
      } else {
        layers.push(layer);
      }

      return () => {
        const index = layers.lastIndexOf(layer);
        if (index === -1) {
          return;
        }
        layers.splice(index, 1);
        const top = layers.at(-1);
        for (const [id, toast] of shown) {
          if (toast.layer !== layer) {
            continue;
          }
          shown.delete(id);
          const remaining = toast.expiresAtMs == null ? 'persistent' : toast.expiresAtMs - now();
          if (top != null && (remaining === 'persistent' || remaining > 0)) {
            showOn(top, toast.render, remaining, true);
          }
        }
      };
    },
  };
}
