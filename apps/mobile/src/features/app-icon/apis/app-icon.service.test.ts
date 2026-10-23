import type { AppIconGateway } from '@src/core/ports/app-icon-gateway';

import { AppIconService } from './app-icon.service';

const createGateway = (): jest.Mocked<AppIconGateway> => ({
  isSupported: jest.fn().mockReturnValue(true),
  getCurrentIcon: jest.fn().mockResolvedValue(null),
  changeIcon: jest.fn().mockImplementation(async (name: string | null) => name),
});

describe('앱 아이콘 서비스', () => {
  test.each([
    [null, 'default'],
    ['russian_blue', 'russian_blue'],
    ['cream_cat', 'cream_cat'],
    ['tuxedo_cat', 'tuxedo_cat'],
    ['future_icon', 'default'],
  ])('네이티브 아이콘 %s를 선택 가능한 키 %s로 해석한다', async (nativeKey, expected) => {
    // Given
    const gateway = createGateway();
    gateway.getCurrentIcon.mockResolvedValue(nativeKey);
    const service = new AppIconService(gateway);

    // When
    const currentIcon = await service.getCurrentIcon();

    // Then
    expect(currentIcon).toBe(expected);
  });

  test('기본 아이콘으로 돌아갈 때 네이티브에 null을 전달한다', async () => {
    // Given
    const gateway = createGateway();
    const service = new AppIconService(gateway);

    // When
    const currentIcon = await service.changeIcon('default');

    // Then
    expect(gateway.changeIcon).toHaveBeenCalledWith(null);
    expect(currentIcon).toBe('default');
  });

  test('빠르게 다른 아이콘을 눌러도 진행 중인 변경 결과를 공유한다', async () => {
    // Given
    const gateway = createGateway();
    let completeChange: (name: string | null) => void = () => undefined;
    gateway.changeIcon.mockImplementation(
      () =>
        new Promise((resolve) => {
          completeChange = resolve;
        }),
    );
    const service = new AppIconService(gateway);

    // When
    const firstChange = service.changeIcon('russian_blue');
    const secondChange = service.changeIcon('tuxedo_cat');
    completeChange('russian_blue');
    const results = await Promise.all([firstChange, secondChange]);

    // Then
    expect(secondChange).toBe(firstChange);
    expect(gateway.changeIcon).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['russian_blue', 'russian_blue']);
  });

  test('변경이 실패한 뒤 새로운 변경을 다시 시도할 수 있다', async () => {
    // Given
    const gateway = createGateway();
    const failure = new Error('네이티브 변경 실패');
    gateway.changeIcon.mockRejectedValueOnce(failure);
    const service = new AppIconService(gateway);

    // When
    const failedChange = service.changeIcon('cream_cat');
    await expect(failedChange).rejects.toBe(failure);
    const retriedIcon = await service.changeIcon('tuxedo_cat');

    // Then
    expect(retriedIcon).toBe('tuxedo_cat');
    expect(gateway.changeIcon).toHaveBeenCalledTimes(2);
  });

  test('취소된 초기 조회의 결과를 반환하지 않는다', async () => {
    // Given
    const gateway = createGateway();
    const controller = new AbortController();
    gateway.getCurrentIcon.mockImplementation(async () => {
      controller.abort();
      return 'white_cat';
    });
    const service = new AppIconService(gateway);

    // When
    const lookup = service.getCurrentIcon(controller.signal);

    // Then
    await expect(lookup).rejects.toThrow('App icon lookup cancelled');
  });

  test('메서드를 분리해서 호출해도 주입한 네이티브 포트를 사용한다', async () => {
    // Given
    const gateway = createGateway();
    const { changeIcon, getCurrentIcon } = new AppIconService(gateway);

    // When
    const changedIcon = await changeIcon('cream_cat');
    const currentIcon = await getCurrentIcon();

    // Then
    expect(changedIcon).toBe('cream_cat');
    expect(currentIcon).toBe('default');
  });
});
