import { fromEpochMs } from '@src/shared/date/instant';

import { createToastLayers, type ToastLayer, type ToastLayerEntry } from './toast-layers';

function createRecordingLayer() {
  const entries: ToastLayerEntry<string>[] = [];
  const layer: ToastLayer<string> = { show: (entry) => entries.push(entry) };

  return { layer, entries };
}

describe('createToastLayers', () => {
  it('열린 시트 면이 있으면 루트가 아니라 가장 위 시트 면에 띄운다', () => {
    // Given
    const layers = createToastLayers<string>({ now: () => fromEpochMs(0) });
    const root = createRecordingLayer();
    const sheet = createRecordingLayer();
    layers.add(sheet.layer);
    layers.add(root.layer, { isBase: true });

    // When
    layers.show('저장하지 못했어요', 4000);

    // Then
    expect(sheet.entries.map((entry) => entry.render)).toEqual(['저장하지 못했어요']);
    expect(root.entries).toEqual([]);
  });

  it('시트가 닫히면 아직 보이는 토스트를 남은 시간만큼 움직임 없이 아래 면으로 옮긴다', () => {
    // Given
    let nowMs = 0;
    const layers = createToastLayers<string>({ now: () => fromEpochMs(nowMs) });
    const root = createRecordingLayer();
    const sheet = createRecordingLayer();
    layers.add(root.layer, { isBase: true });
    const closeSheet = layers.add(sheet.layer);
    layers.show('카테고리를 추가했어요', 4000);
    nowMs = 300;

    // When
    closeSheet();

    // Then
    expect(root.entries).toEqual([
      expect.objectContaining({ render: '카테고리를 추가했어요', duration: 3700, isMoved: true }),
    ]);
  });

  it('닫았거나 시간이 다 된 토스트는 시트가 닫혀도 다시 띄우지 않는다', () => {
    // Given
    let nowMs = 0;
    const layers = createToastLayers<string>({ now: () => fromEpochMs(nowMs) });
    const root = createRecordingLayer();
    const sheet = createRecordingLayer();
    layers.add(root.layer, { isBase: true });
    const closeSheet = layers.add(sheet.layer);
    layers.show('밀어서 닫은 토스트', 4000);
    layers.show('시간이 다 된 토스트', 1000);
    sheet.entries[0]?.onHide();
    nowMs = 1000;

    // When
    closeSheet();

    // Then
    expect(root.entries).toEqual([]);
  });
});
