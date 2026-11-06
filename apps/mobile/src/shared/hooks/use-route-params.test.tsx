import { renderHook } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

import { routeIdSchema } from '../utils/route-params';
import { useRouteParams } from './use-route-params';

const schema = z.object({
  id: routeIdSchema.optional().catch(undefined),
  ids: z
    .codec(z.string(), z.array(routeIdSchema), {
      decode: (value) => value.split(','),
      encode: (ids) => ids.join(','),
    })
    .optional()
    .catch(undefined),
  sort: z.enum(['LATEST', 'POPULAR']).catch('LATEST'),
  isEditing: z.stringbool().catch(false),
});

const mockedUseLocalSearchParams = jest.mocked(useLocalSearchParams);

describe('useRouteParams', () => {
  it('URL 값을 스키마로 읽는다', async () => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({
      id: '12',
      ids: '12,15',
      sort: 'POPULAR',
      isEditing: 'true',
    });

    // When
    const { result } = await renderHook(() => useRouteParams(schema));

    // Then
    expect(result.current[0]).toEqual({
      id: 12,
      ids: [12, 15],
      sort: 'POPULAR',
      isEditing: true,
    });
  });

  it.each([
    ['글자', { id: 'abc', sort: 'OLDEST', isEditing: 'maybe' }],
    ['빈 값', { id: '', sort: '', isEditing: '' }],
    ['0으로 시작', { id: '012', sort: 'latest', isEditing: 'x' }],
    ['반복 키', { id: ['1', '2'], sort: ['LATEST'], isEditing: ['true'] }],
  ])('잘못된 값(%s)은 .catch의 기본값으로 읽는다', async (_name, params) => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue(params);

    // When
    const { result } = await renderHook(() => useRouteParams(schema));

    // Then
    expect(result.current[0]).toEqual({
      id: undefined,
      ids: undefined,
      sort: 'LATEST',
      isEditing: false,
    });
  });

  it('숫자는 코덱을 지나 문자열로 쓴다', async () => {
    // Given
    const { result } = await renderHook(() => useRouteParams(schema));

    // When
    result.current[1]({ id: 12 });

    // Then
    expect(router.setParams).toHaveBeenCalledWith({ id: '12' });
  });

  it('배열은 쉼표 문자열 하나로 쓴다', async () => {
    // Given
    const { result } = await renderHook(() => useRouteParams(schema));

    // When
    result.current[1]({ ids: [12, 15] });

    // Then
    expect(router.setParams).toHaveBeenCalledWith({ ids: '12,15' });
  });

  it('값을 지우면 얕은 병합이 지울 수 있게 키를 undefined로 남긴다', async () => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({ id: '12', sort: 'POPULAR' });
    const { result } = await renderHook(() => useRouteParams(schema));

    // When
    result.current[1]({ id: undefined });

    // Then
    expect(router.setParams).toHaveBeenCalledTimes(1);
    expect(jest.mocked(router.setParams).mock.calls[0]?.[0]).toStrictEqual({ id: undefined });
  });

  it('넘긴 필드만 쓰고 나머지 URL 값은 건드리지 않는다', async () => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({ id: '12', sort: 'POPULAR', other: 'keep' });
    const { result } = await renderHook(() => useRouteParams(schema));

    // When
    result.current[1]({ sort: 'LATEST' });

    // Then
    expect(jest.mocked(router.setParams).mock.calls[0]?.[0]).toStrictEqual({ sort: 'LATEST' });
  });

  it('boolean은 끄면 지우는 값으로 넘겨 ?isEditing=false를 남기지 않는다', async () => {
    // Given
    const { result } = await renderHook(() => useRouteParams(schema));

    // When
    result.current[1]({ isEditing: true });
    result.current[1]({ isEditing: undefined });

    // Then
    expect(router.setParams).toHaveBeenNthCalledWith(1, { isEditing: 'true' });
    expect(jest.mocked(router.setParams).mock.calls[1]?.[0]).toStrictEqual({
      isEditing: undefined,
    });
  });

  it('스키마가 같으면 렌더가 바뀌어도 세터 참조가 같다', async () => {
    // Given
    const { result, rerender } = await renderHook(() => useRouteParams(schema));
    const [, setParams] = result.current;

    // When
    await rerender({});

    // Then
    expect(result.current[1]).toBe(setParams);
  });
});
