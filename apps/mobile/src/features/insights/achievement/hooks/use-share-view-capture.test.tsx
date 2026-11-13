import '@src/shared/i18n/init';
import {
  createSystemShareGatewayStub,
  createViewCaptureGatewayStub,
  createTestDi,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { act } from '@testing-library/react-native';

import { useShareViewCapture } from './use-share-view-capture';

async function setup() {
  const systemShare = createSystemShareGatewayStub();
  const viewCapture = createViewCaptureGatewayStub();
  const viewRef = { current: { capture: async () => 'file:///ref.png' } };
  const hook = await renderScreenHook(() => useShareViewCapture(viewRef), {
    di: createTestDi({ ports: { systemShare, viewCapture } }),
  });
  return { ...hook, systemShare, viewCapture, viewRef };
}

describe('useShareViewCapture', () => {
  it('찍은 이미지를 OS 공유 시트로 보낸다', async () => {
    // Given
    const { result, systemShare, viewCapture, viewRef } = await setup();
    viewCapture.capture.mockResolvedValue('file:///captured.png');

    // When
    await act(async () => result.current.shareCapture());

    // Then
    expect(viewCapture.capture).toHaveBeenCalledWith(viewRef.current);
    expect(systemShare.shareImage).toHaveBeenCalledWith('file:///captured.png');
  });

  it('이미지 공유가 안 되는 기기에서는 찍지 않는다', async () => {
    // Given
    const { result, systemShare, viewCapture } = await setup();
    systemShare.isImageShareAvailable.mockResolvedValue(false);

    // When
    await act(async () => result.current.shareCapture());

    // Then
    expect(viewCapture.capture).not.toHaveBeenCalled();
    expect(systemShare.shareImage).not.toHaveBeenCalled();
  });

  it('찍지 못하면 공유하지 않는다', async () => {
    // Given
    const { result, systemShare, viewCapture } = await setup();
    viewCapture.capture.mockResolvedValue(null);

    // When
    await act(async () => result.current.shareCapture());

    // Then
    expect(systemShare.shareImage).not.toHaveBeenCalled();
    expect(result.current.isSharing).toBe(false);
  });
});
