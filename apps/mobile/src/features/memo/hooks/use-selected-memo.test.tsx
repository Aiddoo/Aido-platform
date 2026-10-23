import { renderHook } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useWindowDimensions } from 'react-native';

import { useSelectedMemo } from './use-selected-memo';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedUseLocalSearchParams = jest.mocked(useLocalSearchParams);
const mockedUseWindowDimensions = jest.mocked(useWindowDimensions);

function givenWindow(width: number, params: Record<string, string> = {}) {
  mockedUseWindowDimensions.mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 });
  mockedUseLocalSearchParams.mockReturnValue(params);
}

describe('useSelectedMemo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('URL의 id를 숫자로 읽는다', async () => {
    // Given
    givenWindow(700, { id: '12' });

    // When
    const { result } = await renderHook(() => useSelectedMemo());

    // Then
    expect(result.current[0]).toBe(12);
  });

  it('잘못된 id는 선택 없음으로 본다', async () => {
    // Given
    givenWindow(700, { id: 'abc' });

    // When
    const { result } = await renderHook(() => useSelectedMemo());

    // Then
    expect(result.current[0]).toBeUndefined();
  });

  it('compact에서는 상세 라우트로 push한다', async () => {
    // Given
    givenWindow(390);
    const { result } = await renderHook(() => useSelectedMemo());

    // When
    result.current[1](5);

    // Then
    expect(router.push).toHaveBeenCalledWith({ pathname: '/memo/[id]', params: { id: 5 } });
    expect(router.setParams).not.toHaveBeenCalled();
  });

  it('medium 이상에서는 메모 탭 URL param을 바꾼다', async () => {
    // Given
    givenWindow(700);
    const { result } = await renderHook(() => useSelectedMemo());

    // When
    result.current[1](5);

    // Then
    expect(router.setParams).toHaveBeenCalledWith({ id: '5' });
    expect(router.push).not.toHaveBeenCalled();
  });

  it('medium 이상에서 undefined를 고르면 선택을 해제한다', async () => {
    // Given
    givenWindow(900, { id: '5' });
    const { result } = await renderHook(() => useSelectedMemo());

    // When
    result.current[1](undefined);

    // Then
    expect(router.setParams).toHaveBeenCalledWith({ id: undefined });
  });
});
