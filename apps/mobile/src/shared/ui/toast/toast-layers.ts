import { type Instant, toEpochMs } from '@src/shared/date/instant';

type ToastDuration = number | 'persistent';

/** heroui-native 토스트의 기본 표시 시간과 같다 */
export const TOAST_DURATION_MS = 4000;

export interface ToastLayerEntry<TRender> {
  id: string;
  render: TRender;
  duration: ToastDuration;
  /** 다른 면에서 이미 보이던 토스트. 등장 움직임 없이 그린다 */
  isMoved: boolean;
  /** 면이 토스트를 화면에 올리면 부른다. 오르기 전에 옮겨지면 옮긴 면에서 처음 뜨는 것처럼 움직인다 */
  onPresent: () => void;
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
  isPresented: boolean;
}

export interface ToastLayers<TRender> {
  /** 닫히는 중이 아닌 가장 위 면에 띄운다 */
  show: (render: TRender, duration: ToastDuration) => void;
  /**
   * 면을 쌓고 걷는 함수를 돌려준다. 걷으면 그 면에 아직 보이는 토스트를 남은 시간만큼 가장 위 면으로 옮긴다.
   * 앱 루트 면은 isBase로 맨 아래에 둔다. 시트 route가 앱과 함께 마운트되면 루트보다 먼저 쌓이기 때문이다
   */
  add: (layer: ToastLayer<TRender>, options?: { isBase?: boolean }) => () => void;
  /**
   * 면이 닫히기 시작했다. 새 토스트는 그 아래 면에 띄우고, 이 면의 토스트는 지금 남은 시간만큼 아래 면으로 옮긴다.
   * 걷힐 때까지 기다리면 닫히는 시트와 함께 사라졌다가 아래 면에 다시 떠 두 번 뜬 것처럼 보인다
   */
  startClosing: (layer: ToastLayer<TRender>) => void;
}

/**
 * iOS 시트 route는 루트 위에 따로 뜨는 모달이라 루트에 그린 토스트가 시트 배경 아래에 깔리고 VoiceOver가 읽지 못한다.
 * 그래서 열린 시트 route마다 면을 쌓아 가장 위 면에 띄우고, 시트가 닫히기 시작하면 아직 보이는 토스트를 아래 면으로 옮긴다
 */
export function createToastLayers<TRender>({ now }: { now: () => Instant }): ToastLayers<TRender> {
  const layers: ToastLayer<TRender>[] = [];
  const closingLayers = new Set<ToastLayer<TRender>>();
  const shown = new Map<string, ShownToast<TRender>>();
  let sequence = 0;

  function findTopLayer() {
    return layers.findLast((layer) => !closingLayers.has(layer));
  }

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
      expiresAtMs: duration === 'persistent' ? null : toEpochMs(now()) + duration,
      isPresented: isMoved,
    });
    layer.show({
      id,
      render,
      duration,
      isMoved,
      onPresent: () => {
        const toast = shown.get(id);
        if (toast != null) {
          shown.set(id, { ...toast, isPresented: true });
        }
      },
      onHide: () => shown.delete(id),
    });
  }

  function moveToastsFrom(layer: ToastLayer<TRender>) {
    const target = findTopLayer();
    const leaving = [...shown].filter(([, toast]) => toast.layer === layer);
    for (const [id, toast] of leaving) {
      shown.delete(id);
      const remaining =
        toast.expiresAtMs == null ? 'persistent' : toast.expiresAtMs - toEpochMs(now());
      if (target != null && (remaining === 'persistent' || remaining > 0)) {
        showOn(target, toast.render, remaining, toast.isPresented);
      }
    }
  }

  return {
    show: (render, duration) => {
      const top = findTopLayer();
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
        closingLayers.delete(layer);
        moveToastsFrom(layer);
      };
    },
    startClosing: (layer) => {
      if (!layers.includes(layer) || closingLayers.has(layer)) {
        return;
      }
      closingLayers.add(layer);
      moveToastsFrom(layer);
    },
  };
}
