import '@src/shared/i18n/init';
import { renderScreen } from '@src/testing/render';
import { act, screen, within } from '@testing-library/react-native';
import { View } from 'react-native';

import { SheetToastLayer } from './toast-layer';
import { useAppToast } from './use-app-toast';

/** 루트(시트 밖)에서 토스트를 띄우는 앱. 시트 route는 SheetToastLayer로 자기 면을 쌓는다 */
function createApp() {
  let rootToast: ReturnType<typeof useAppToast> | undefined;

  function RootToastCapture() {
    rootToast = useAppToast();
    return null;
  }

  function App({ isSheetOpen }: { isSheetOpen: boolean }) {
    return (
      <>
        <RootToastCapture />
        {isSheetOpen && (
          <View testID="sheet-route">
            <SheetToastLayer>
              <View testID="sheet" />
            </SheetToastLayer>
          </View>
        )}
      </>
    );
  }

  return { App, getRootToast: () => rootToast };
}

type HostNode = ReturnType<typeof screen.getByTestId>;

/** 나중에 그린 형제가 위에 보이므로 트리 순서가 겹침 순서다 */
function listInTreeOrder(root: HostNode, toast: HostNode | undefined) {
  const order: string[] = [];
  const visit = (node: HostNode) => {
    if (node === toast) {
      order.push('toast');
    }
    if (node.props.testID === 'sheet') {
      order.push('sheet');
    }
    node.children.forEach((child) => {
      if (typeof child !== 'string') {
        visit(child);
      }
    });
  };
  visit(root);
  return order;
}

describe('SheetToastLayer', () => {
  it('시트 route가 열린 동안 루트에서 띄운 오류 토스트도 시트 안, 시트 뒤에 그린다', async () => {
    // Given
    const { App, getRootToast } = createApp();
    await renderScreen(<App isSheetOpen />);

    // When
    await act(async () => {
      getRootToast()?.error('서버에 문제가 생겼어요');
    });

    // Then
    const sheetRoute = screen.getByTestId('sheet-route');
    const [visibleToast] = within(sheetRoute).getAllByText('서버에 문제가 생겼어요');
    expect(listInTreeOrder(sheetRoute, visibleToast)).toEqual(['sheet', 'toast']);
  });

  it('시트가 닫혀도 보이던 토스트는 루트 면으로 옮겨 남는다', async () => {
    // Given
    const { App, getRootToast } = createApp();
    const { rerender } = await renderScreen(<App isSheetOpen />);
    await act(async () => {
      getRootToast()?.success('카테고리를 추가했어요');
    });

    // When
    await rerender(<App isSheetOpen={false} />);

    // Then
    expect(screen.queryByTestId('sheet-route')).toBeNull();
    expect(screen.getAllByText('카테고리를 추가했어요').length).toBeGreaterThan(0);
  });
});
