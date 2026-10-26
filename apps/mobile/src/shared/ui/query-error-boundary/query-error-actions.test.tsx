import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { exitSheetRoute, type SheetRouteNavigator } from '../bottom-sheet/sheet-route';
import {
  BUG_REPORT_INQUIRY_HREF,
  INQUIRY_SHEET_EXIT,
  QueryErrorActions,
} from './query-error-actions';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

jest.mock('heroui-native', () => {
  const { View } = require('react-native');
  return {
    PressableFeedback: Object.assign(
      ({ children, ...props }: { children: ReactNode }) => <View {...props}>{children}</View>,
      { Highlight: () => null },
    ),
    Spinner: () => <View testID="spinner" />,
  };
});

describe('QueryErrorActions', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('다시 시도를 누르면 onRetry를 부른다', async () => {
    // Given
    const onRetry = jest.fn();
    const screen = await render(<QueryErrorActions onRetry={onRetry} />);

    // When
    fireEvent.press(screen.getByText('다시 시도'));

    // Then
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('문의하기는 기본으로 오류 신고 분류를 고른 문의 화면을 연다', async () => {
    // Given
    const screen = await render(<QueryErrorActions onRetry={jest.fn()} />);

    // When
    fireEvent.press(screen.getByTestId('query-error-inquiry'));

    // Then
    expect(jest.mocked(router.push)).toHaveBeenCalledWith(BUG_REPORT_INQUIRY_HREF);
  });

  it('onInquiry를 주면 이동 대신 그것을 부른다 (시트·다이얼로그가 먼저 닫는다)', async () => {
    // Given
    const onInquiry = jest.fn();
    const screen = await render(<QueryErrorActions onRetry={jest.fn()} onInquiry={onInquiry} />);

    // When
    fireEvent.press(screen.getByTestId('query-error-inquiry'));

    // Then
    expect(onInquiry).toHaveBeenCalledTimes(1);
    expect(jest.mocked(router.push)).not.toHaveBeenCalled();
  });

  it('시트 안 문의는 시트 route를 문의 화면으로 바꿔, 문의에서 돌아오면 시트 아래 화면이 보인다', () => {
    // Given
    const navigator: jest.Mocked<SheetRouteNavigator> = {
      canGoBack: jest.fn(() => true),
      back: jest.fn(),
      replace: jest.fn(),
    };

    // When
    exitSheetRoute(navigator, INQUIRY_SHEET_EXIT, '/');

    // Then
    expect(navigator.replace).toHaveBeenCalledWith(BUG_REPORT_INQUIRY_HREF);
    expect(navigator.back).not.toHaveBeenCalled();
  });
});
