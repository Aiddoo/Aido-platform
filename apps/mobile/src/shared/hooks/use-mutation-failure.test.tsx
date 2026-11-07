import { createHapticsGatewayStub } from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { NetworkError } from '@src/shared/errors/infra-error';
import { act, screen } from '@testing-library/react-native';

import { useMutationFailure } from './use-mutation-failure';

async function renderFailure(defaultFallback?: string) {
  const haptics = createHapticsGatewayStub();
  let showFailure: ReturnType<typeof useMutationFailure> | undefined;
  function Capture() {
    showFailure = useMutationFailure(defaultFallback);
    return null;
  }
  await renderUi(<Capture />, { di: { haptics } });

  return { haptics, fail: (error: unknown, fallback?: string) => showFailure?.(error, fallback) };
}

describe('useMutationFailure', () => {
  it('연결 문제는 오류 문구를 토스트로 알리고 햅틱을 한 번 울린다', async () => {
    // Given
    const { haptics, fail } = await renderFailure('폴백 문구');

    // When
    await act(async () => fail(new NetworkError()));

    // Then
    expect(haptics.notify).toHaveBeenCalledTimes(1);
    expect(haptics.notify).toHaveBeenCalledWith('error');
    expect(await screen.findAllByText(new NetworkError().message)).not.toHaveLength(0);
  });

  it('사용자에게 보여 줄 수 없는 오류는 기본 폴백 문구로 바꾼다', async () => {
    // Given
    const { fail } = await renderFailure('폴백 문구');

    // When
    await act(async () =>
      fail(new TypeError("Cannot read properties of undefined (reading 'id')")),
    );

    // Then
    expect(await screen.findAllByText('폴백 문구')).not.toHaveLength(0);
  });

  it('호출마다 다른 폴백 문구를 넘기면 그 문구를 쓴다', async () => {
    // Given
    const { fail } = await renderFailure('폴백 문구');

    // When
    await act(async () => fail(new Error('개발자용'), '삭제하지 못했어요'));

    // Then
    expect(await screen.findAllByText('삭제하지 못했어요')).not.toHaveLength(0);
    expect(screen.queryByText('폴백 문구')).toBeNull();
  });
});
