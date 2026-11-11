import {
  createAppIconGatewayStub,
  createErrorReporterStub,
  createTestQueryClient,
  renderUi,
} from '@src/shared/__tests__';
import { useMutation } from '@tanstack/react-query';
import { screen } from '@testing-library/react-native';

import { AppIconService } from '../apis/app-icon.service';
import type { AppIconKey } from '../domains/app-icon.model';
import { APP_ICON_QUERY_KEYS } from './app-icon-query-keys';
import { useChangeAppIconMutationOptions } from './app-icon.mutations';

async function renderChange(gateway = createAppIconGatewayStub()) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(APP_ICON_QUERY_KEYS.current(), 'default');
  const errorReporter = createErrorReporterStub();
  let mutateAsync: ReturnType<typeof useChange> | undefined;
  function useChange() {
    return useMutation(useChangeAppIconMutationOptions()).mutateAsync;
  }
  function Capture() {
    mutateAsync = useChange();
    return null;
  }
  await renderUi(<Capture />, {
    queryClient,
    di: { appIconService: new AppIconService(gateway), errorReporter },
  });

  return {
    errorReporter,
    cached: () => queryClient.getQueryData(APP_ICON_QUERY_KEYS.current()),
    change: (key: AppIconKey) => mutateAsync?.(key),
  };
}

describe('앱 아이콘 바꾸기', () => {
  it('네이티브가 거절하면 현재 아이콘을 그대로 두고 알린 뒤 오류를 app_icon으로 보고한다', async () => {
    // Given
    const gateway = createAppIconGatewayStub();
    const failure = new Error('아이콘 변경 거절');
    gateway.changeIcon.mockRejectedValue(failure);
    const { cached, change, errorReporter } = await renderChange(gateway);

    // When
    const result = change('cream_cat');

    // Then
    await expect(result).rejects.toBe(failure);
    expect(cached()).toBe('default');
    expect(errorReporter.captureException).toHaveBeenCalledWith(failure, { feature: 'app_icon' });
    expect(await screen.findAllByText(/아이콘을 변경하지 못했어요/)).not.toHaveLength(0);
  });
});
