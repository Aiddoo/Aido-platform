import { createEntitlementSnapshot } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/queries/entitlement-query-keys';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import {
  createAnalyticsStub,
  createAppIconGatewayStub,
  createErrorReporterStub,
  createTestDi,
  createTestQueryClient,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';

import AppIconScreen from '../../../../../app/(app)/(tabs)/(me,memos,todos)/settings/app-icon';

const ICON_NAMES = [
  '기본',
  '스코티시폴드',
  '치즈 태비',
  '검은 고양이',
  '하얀 고양이',
  '샴',
  '러시안 블루',
  '크림 고양이',
  '턱시도 고양이',
];

async function renderAppIconScreen({
  gateway = createAppIconGatewayStub(),
}: { gateway?: ReturnType<typeof createAppIconGatewayStub> } = {}) {
  const analytics = createAnalyticsStub();
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(
    ENTITLEMENT_QUERY_KEYS.snapshot(),
    createEntitlementSnapshot({ tier: 'PREMIUM' }),
  );
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser());
  await renderScreen(<AppIconScreen />, {
    di: createTestDi({
      ports: { appIcon: gateway, analytics, errorReporter: createErrorReporterStub(), queryClient },
    }),
    withLocalDate: true,
    withOverlay: true,
  });

  return {
    gateway,
    changedIcons: () =>
      analytics.trackEvent.mock.calls.flatMap(([name, params]) =>
        name === 'settings_changed' ? [params] : [],
      ),
  };
}

type HostNode = ReturnType<typeof screen.getByTestId>;

/** 줄(role=radio) 안에 그려진 라디오 원. 스크린리더에는 숨긴 자기 Pressable로 터치를 받아 줄의 누름을 거치지 않는다 */
function findInnerRadio(row: HostNode): HostNode {
  const visit = (node: HostNode): HostNode | null => {
    for (const child of node.children) {
      if (typeof child === 'string') {
        continue;
      }
      if (child.props.onResponderRelease != null) {
        return child;
      }
      const found = visit(child);
      if (found != null) {
        return found;
      }
    }
    return null;
  };
  const inner = visit(row);
  if (inner == null) {
    throw new Error('줄 안의 라디오 원을 찾지 못했습니다');
  }
  return inner;
}

describe('AppIconScreen', () => {
  it('고를 수 있는 아이콘 아홉 개를 보이고 지금 아이콘을 고른 채로 둔다', async () => {
    // Given
    const gateway = createAppIconGatewayStub();
    gateway.getCurrentIcon.mockResolvedValue('siamese');

    // When
    await renderAppIconScreen({ gateway });

    // Then
    expect(await screen.findByRole('radio', { name: '샴' })).toBeChecked();
    expect(screen.getAllByRole('radio').map((radio) => radio.props.accessibilityLabel)).toEqual(
      ICON_NAMES,
    );
  });

  it('아이콘을 고르면 그 이름으로 바꾸고 OS가 확정한 아이콘을 한 번 남긴다', async () => {
    // Given
    const user = userEvent.setup();
    const { gateway, changedIcons } = await renderAppIconScreen();

    // When
    await user.press(await screen.findByRole('radio', { name: '러시안 블루' }));

    // Then
    await waitFor(() => expect(screen.getByRole('radio', { name: '러시안 블루' })).toBeChecked());
    expect(gateway.changeIcon.mock.calls).toEqual([['russian_blue']]);
    expect(changedIcons()).toEqual([{ setting: 'app_icon', value: 'russian_blue' }]);
  });

  it('줄 오른쪽의 라디오 원을 직접 눌러도 그 아이콘으로 바꾼다', async () => {
    // Given
    const { gateway } = await renderAppIconScreen();
    const row = await screen.findByRole('radio', { name: '하얀 고양이' });

    // When
    await fireEvent.press(findInnerRadio(row));

    // Then
    await waitFor(() => expect(screen.getByRole('radio', { name: '하얀 고양이' })).toBeChecked());
    expect(gateway.changeIcon.mock.calls).toEqual([['white_cat']]);
  });

  it('아이콘을 바꿀 수 없는 기기는 목록 대신 지원하지 않는다고 알린다', async () => {
    // Given
    const gateway = createAppIconGatewayStub();
    gateway.isAvailable.mockReturnValue(false);

    // When
    await renderAppIconScreen({ gateway });

    // Then
    expect(screen.getByText('이 기기에서는 앱 아이콘 변경을 지원하지 않아요')).toBeOnTheScreen();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(gateway.getCurrentIcon).not.toHaveBeenCalled();
  });

  it('지금 아이콘을 읽지 못하면 목록 자리에 실패를 알리고 다시 시도하면 목록을 보인다', async () => {
    // Given
    const user = userEvent.setup();
    const gateway = createAppIconGatewayStub();
    gateway.getCurrentIcon.mockRejectedValueOnce(new Error('native unavailable'));
    await renderAppIconScreen({ gateway });
    expect(await screen.findByText('아이콘을 변경하지 못했어요')).toBeOnTheScreen();

    // When
    await user.press(screen.getByRole('button', { name: '다시 시도' }));

    // Then
    expect(await screen.findByRole('radio', { name: '기본' })).toBeChecked();
  });

  it('아이콘을 바꾸지 못하면 고르기 전 아이콘을 고른 채로 둔다', async () => {
    // Given
    const user = userEvent.setup();
    const gateway = createAppIconGatewayStub();
    gateway.changeIcon.mockRejectedValue(new Error('native failure'));
    const { changedIcons } = await renderAppIconScreen({ gateway });

    // When
    await user.press(await screen.findByRole('radio', { name: '샴' }));

    // Then
    await waitFor(() => expect(gateway.changeIcon).toHaveBeenCalledWith('siamese'));
    await waitFor(() => expect(screen.getByRole('radio', { name: '샴' })).toBeEnabled());
    expect(screen.getByRole('radio', { name: '기본' })).toBeChecked();
    expect(changedIcons()).toEqual([]);
  });

  it('같은 프레임에 같은 아이콘을 두 번 누르면 바꾼 기록이 두 번 남는다(지금 동작)', async () => {
    // Given
    const { changedIcons } = await renderAppIconScreen();
    const radio = await screen.findByRole('radio', { name: '샴' });

    // When
    await act(async () => {
      await fireEvent.press(radio);
      await fireEvent.press(radio);
    });

    // Then
    await waitFor(() => expect(screen.getByRole('radio', { name: '샴' })).toBeChecked());
    expect(changedIcons()).toEqual([
      { setting: 'app_icon', value: 'siamese' },
      { setting: 'app_icon', value: 'siamese' },
    ]);
  });

  it('지금 아이콘 줄을 누른 바로 뒤 다른 아이콘을 눌러도 그 아이콘으로 바꾼다', async () => {
    // Given
    const { gateway } = await renderAppIconScreen();
    const current = await screen.findByRole('radio', { name: '기본' });
    const next = screen.getByRole('radio', { name: '검은 고양이' });

    // When
    await act(async () => {
      await fireEvent.press(current);
      await fireEvent.press(next);
    });

    // Then
    await waitFor(() => expect(screen.getByRole('radio', { name: '검은 고양이' })).toBeChecked());
    expect(gateway.changeIcon.mock.calls).toEqual([['black_cat']]);
  });
});
