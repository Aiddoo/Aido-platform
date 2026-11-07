import { createHapticsGatewayStub, createHttpClientStub, renderUi } from '@src/shared/__tests__';
import { NetworkError } from '@src/shared/errors/infra-error';
import { useMutation } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';

import { useRotateInviteCodeMutationOptions } from './invite.mutations';

describe('초대 저장 실패', () => {
  it('연결이 끊겨 링크 새로 만들기가 실패하면 그 자리에서 실패를 알린다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.post.mockRejectedValue(new NetworkError());
    const haptics = createHapticsGatewayStub();
    let rotate: (() => Promise<unknown>) | undefined;
    function MyInviteScreen() {
      const mutation = useMutation(useRotateInviteCodeMutationOptions());
      rotate = () => mutation.mutateAsync().catch(() => undefined);
      return null;
    }
    await renderUi(<MyInviteScreen />, { withOverlay: true, di: { httpClient, haptics } });

    // When
    await act(async () => {
      await rotate?.();
    });

    // Then
    expect(haptics.notify).toHaveBeenCalledWith('error');
  });
});
