import '@src/shared/i18n/init';
import { getLastGorhomSheetProps } from '@src/testing/mocks/gorhom-bottom-sheet';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { noop } from 'es-toolkit';
import { router } from 'expo-router';
import type { ReactElement } from 'react';
import { Text, View } from 'react-native';

import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { useOpenSheet } from '../overlay/use-open-sheet';
import { useAppToast } from '../toast/use-app-toast';
import { BottomSheet } from './bottom-sheet';
import { SheetRouteScreen } from './sheet-route-screen';
import { useSheetRoute } from './use-sheet-route';

type HostNode = ReturnType<typeof screen.getByTestId>;

function findLayoutHost(node: HostNode): HostNode | null {
  if ('onLayout' in node.props) {
    return node;
  }
  for (const child of node.children) {
    const found = typeof child === 'string' ? null : findLayoutHost(child);
    if (found != null) {
      return found;
    }
  }
  return null;
}

/** 시트 route 모달처럼 그린다. 모달은 크기를 받은 뒤 내용을 그린다 */
async function renderSheetRoute(route: ReactElement) {
  await renderScreen(
    <View testID="sheet-route">
      <SheetRouteScreen>{route}</SheetRouteScreen>
    </View>,
  );
  const layoutHost = findLayoutHost(screen.getByTestId('sheet-route'));
  if (layoutHost != null) {
    await fireEvent(layoutHost, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
    });
  }
}

/** 시트 route의 시트. 안에서 토스트를 띄우고 폼 피커 같은 overlay 시트를 연다 */
function createRouteSheet() {
  let toast: ReturnType<typeof useAppToast> | undefined;
  let openSheet: ReturnType<typeof useOpenSheet> | undefined;

  function RouteSheet() {
    const sheet = useSheetRoute('/feed');
    toast = useAppToast();
    openSheet = useOpenSheet();

    return (
      <BottomSheet isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
        <Text>할 일 시트</Text>
      </BottomSheet>
    );
  }

  return { RouteSheet, getToast: () => toast, getOpenSheet: () => openSheet };
}

describe('시트 route 토스트', () => {
  it('시트에 보이던 토스트는 끌어 내려 닫기 시작하면 시트에서 감추고 루트에 남긴다', async () => {
    // Given
    const { RouteSheet, getToast } = createRouteSheet();
    await renderSheetRoute(<RouteSheet />);
    await act(async () => {
      getToast()?.error('저장하지 못했어요');
    });
    const sheetRoute = screen.getByTestId('sheet-route');
    expect(within(sheetRoute).getAllByText('저장하지 못했어요')).not.toHaveLength(0);

    // When
    await act(async () => getLastGorhomSheetProps().onAnimate(0, -1));

    // Then
    expect(within(sheetRoute).queryAllByText('저장하지 못했어요')).toEqual([]);
    expect(screen.getAllByText('저장하지 못했어요')).not.toHaveLength(0);
  });

  it('폼 피커처럼 route 안에 띄운 overlay 시트가 닫혀도 route 시트의 오류 토스트는 시트 위에 남는다', async () => {
    // Given
    const { RouteSheet, getToast, getOpenSheet } = createRouteSheet();
    await renderSheetRoute(<RouteSheet />);
    await act(async () => {
      getOpenSheet()?.(() => <Text>날짜 고르기</Text>).catch(noop);
    });
    await act(async () => getLastGorhomSheetProps().onAnimate(0, -1));

    // When
    await act(async () => {
      getToast()?.error('저장하지 못했어요');
    });

    // Then
    expect(
      within(screen.getByTestId('sheet-route')).getAllByText('저장하지 못했어요'),
    ).not.toHaveLength(0);
  });

  it('route가 그린 확인 다이얼로그가 성공 토스트를 띄우고 떠나면 토스트를 route 안에 그리지 않고 루트에 띄운다', async () => {
    // Given
    function BlockDialogRoute() {
      const dialog = useSheetRoute('/feed');
      const toast = useAppToast();

      return (
        <ConfirmDialog
          isOpen={dialog.isOpen}
          title="차단할까요?"
          cancelLabel="취소"
          confirmLabel="차단하기"
          confirmTestID="block-confirm"
          onConfirm={async () => {
            toast.success('차단했어요');
          }}
          onFinish={() => dialog.exit()}
        />
      );
    }
    await renderSheetRoute(<BlockDialogRoute />);

    // When
    await fireEvent.press(await screen.findByTestId('block-confirm'));

    // Then
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(within(screen.getByTestId('sheet-route')).queryAllByText('차단했어요')).toEqual([]);
    expect(screen.getAllByText('차단했어요')).not.toHaveLength(0);
  });
});
