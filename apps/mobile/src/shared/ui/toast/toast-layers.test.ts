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
    sheet.entries[0]?.onPresent();
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

  describe('닫히기 시작한 시트 면', () => {
    it('닫히기 시작한 시트 면에는 띄우지 않고 아래 면에 처음 뜨는 것처럼 한 번 띄운다', () => {
      // Given
      const layers = createToastLayers<string>({ now: () => fromEpochMs(0) });
      const root = createRecordingLayer();
      const sheet = createRecordingLayer();
      layers.add(root.layer, { isBase: true });
      layers.add(sheet.layer);
      layers.startClosing(sheet.layer);

      // When
      layers.show('할 일을 추가했어요', 4000);

      // Then
      expect(sheet.entries).toEqual([]);
      expect(root.entries).toEqual([
        expect.objectContaining({ render: '할 일을 추가했어요', duration: 4000, isMoved: false }),
      ]);
    });

    it('시트에 띄운 토스트가 화면에 오르기 전에 시트가 닫히기 시작하면 아래 면에만 처음 뜨는 것처럼 띄운다', () => {
      // Given
      // 저장 성공 토스트를 띄운 바로 뒤에 같은 흐름이 시트를 닫는다
      const layers = createToastLayers<string>({ now: () => fromEpochMs(0) });
      const root = createRecordingLayer();
      const sheet = createRecordingLayer();
      layers.add(root.layer, { isBase: true });
      const removeSheet = layers.add(sheet.layer);
      layers.show('할 일을 추가했어요', 4000);

      // When
      layers.startClosing(sheet.layer);
      removeSheet();

      // Then
      expect(root.entries).toEqual([
        expect.objectContaining({ render: '할 일을 추가했어요', duration: 4000, isMoved: false }),
      ]);
    });

    it('시트에 보이던 토스트는 닫히기 시작할 때 한 번만 움직임 없이 옮기고 시트가 걷혀도 다시 옮기지 않는다', () => {
      // Given
      let nowMs = 0;
      const layers = createToastLayers<string>({ now: () => fromEpochMs(nowMs) });
      const root = createRecordingLayer();
      const sheet = createRecordingLayer();
      layers.add(root.layer, { isBase: true });
      const removeSheet = layers.add(sheet.layer);
      layers.show('저장하지 못했어요', 4000);
      sheet.entries[0]?.onPresent();
      nowMs = 300;

      // When
      layers.startClosing(sheet.layer);
      nowMs = 550;
      removeSheet();

      // Then
      expect(root.entries).toEqual([
        expect.objectContaining({ render: '저장하지 못했어요', duration: 3700, isMoved: true }),
      ]);
    });

    it('옮긴 토스트가 다시 옮겨져도 이미 보이던 것이라 움직임 없이 그린다', () => {
      // Given
      // 시트 위 시트가 닫히며 아래 시트로 옮긴 토스트가, 아래 시트도 닫히며 루트로 간다
      const layers = createToastLayers<string>({ now: () => fromEpochMs(0) });
      const root = createRecordingLayer();
      const lowerSheet = createRecordingLayer();
      const upperSheet = createRecordingLayer();
      layers.add(root.layer, { isBase: true });
      layers.add(lowerSheet.layer);
      layers.add(upperSheet.layer);
      layers.show('저장하지 못했어요', 4000);
      upperSheet.entries[0]?.onPresent();
      layers.startClosing(upperSheet.layer);

      // When
      layers.startClosing(lowerSheet.layer);

      // Then
      expect(lowerSheet.entries).toEqual([expect.objectContaining({ isMoved: true })]);
      expect(root.entries).toEqual([
        expect.objectContaining({ render: '저장하지 못했어요', isMoved: true }),
      ]);
    });
  });
});
