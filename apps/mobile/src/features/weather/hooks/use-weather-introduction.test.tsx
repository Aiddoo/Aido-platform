import type { LocationGateway, LocationPermission } from '@src/core/ports/location-gateway';
import { createStubInviteService } from '@src/features/social/invite/__tests__/create-stub-invite-service';
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createHttpClientStub,
  createLoggerStub,
  createMemorySyncStorage,
} from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { OverlayProvider } from '@src/shared/ui';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createWeatherIntroductionRepository } from '../apis/weather-introduction.repository';
import { WeatherIntroductionService } from '../apis/weather-introduction.service';
import { WeatherService } from '../apis/weather.service';
import { useWeatherIntroduction } from './use-weather-introduction';

const NOT_ASKED: LocationPermission = { isGranted: false, canAskAgain: true };

function Probe({ isStable }: { isStable: boolean }) {
  const { isPending } = useWeatherIntroduction({ isStable });

  return <Text testID="pending">{String(isPending)}</Text>;
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function FeedScreen({ path, isStable }: { path: string; isStable: boolean }) {
  return (
    <OverlayProvider resetKey={path}>
      <Probe isStable={isStable} />
    </OverlayProvider>
  );
}

async function setup(gatewayOverrides: Partial<jest.Mocked<LocationGateway>> = {}) {
  const gateway: jest.Mocked<LocationGateway> = {
    getPermission: jest.fn().mockResolvedValue(NOT_ASKED),
    requestPermission: jest.fn().mockResolvedValue(NOT_ASKED),
    getCoordinates: jest.fn(),
    getPlace: jest.fn(),
    ...gatewayOverrides,
  };
  const introductionService = new WeatherIntroductionService(
    createWeatherIntroductionRepository(createMemorySyncStorage()),
  );
  const rendered = await renderUi(<FeedScreen path="/feed" isStable />, {
    di: {
      locationGateway: gateway,
      weatherService: new WeatherService(createHttpClientStub()),
      weatherIntroductionService: introductionService,
      inviteService: createStubInviteService(),
      logger: createLoggerStub(),
      analytics: createAnalyticsStub(),
      errorReporter: createErrorReporterStub(),
    },
  });
  return { gateway, introductionService, ...rendered };
}

describe('useWeatherIntroduction', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'requestIdleCallback', {
      configurable: true,
      value: (callback: IdleRequestCallback) => {
        callback({ didTimeout: false, timeRemaining: () => 10 });
        return 1;
      },
    });
    Object.defineProperty(globalThis, 'cancelIdleCallback', {
      configurable: true,
      value: () => undefined,
    });
  });

  it('위치 권한 창이 끝날 때까지 다음 안내를 미룬다', async () => {
    // Given
    const permission = deferred<LocationPermission>();
    const { gateway } = await setup({
      requestPermission: jest.fn().mockReturnValue(permission.promise),
    });

    // When
    await fireEvent.press(await screen.findByText('위치 등록하기'));
    await waitFor(() => expect(gateway.requestPermission).toHaveBeenCalled());

    // Then
    expect(screen.getByTestId('pending')).toHaveTextContent('true');

    // When
    await act(async () => permission.resolve(NOT_ASKED));

    // Then
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent('false'));
  });

  it('나중에를 고르면 본 것으로 기억하고 다음 안내를 막지 않는다', async () => {
    // Given
    const { gateway, introductionService } = await setup();

    // When
    await fireEvent.press(await screen.findByText('나중에'));

    // Then
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent('false'));
    expect(introductionService.hasSeenIntroduction()).toBe(true);
    expect(gateway.requestPermission).not.toHaveBeenCalled();
  });

  it('답 없이 사라지면 본 것으로 기억하지 않는다', async () => {
    // Given
    const { introductionService, unmount } = await setup();
    await screen.findByText('나중에');

    // When
    await unmount();
    await act(async () => undefined);

    // Then
    expect(introductionService.hasSeenIntroduction()).toBe(false);
  });

  it('다른 화면으로 가서 사라지면 피드로 돌아올 때 다시 권한다', async () => {
    // Given
    const { introductionService, rerender } = await setup();
    await screen.findByText('나중에');

    // When
    await rerender(<FeedScreen path="/mypage" isStable={false} />);
    await act(async () => undefined);

    // Then
    expect(screen.queryByText('나중에')).toBeNull();
    expect(introductionService.hasSeenIntroduction()).toBe(false);

    // When
    await rerender(<FeedScreen path="/mypage" isStable />);

    // Then
    expect(await screen.findByText('나중에')).toBeTruthy();
  });
});
