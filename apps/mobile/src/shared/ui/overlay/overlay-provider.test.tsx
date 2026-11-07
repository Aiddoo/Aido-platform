import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { OverlayProvider } from './overlay-provider';
import { useOverlay } from './use-overlay';
import { useOverlayState } from './use-overlay-state';

function Harness() {
  const overlay = useOverlay();
  const { hasActiveOverlay } = useOverlayState();

  return (
    <>
      <Text>{hasActiveOverlay ? 'active' : 'idle'}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          overlay.open(({ close, unmount }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="overlay-close"
              onPress={() => {
                close();
                unmount();
              }}
            />
          ));
        }}
      >
        <Text>open</Text>
      </Pressable>
    </>
  );
}

function AsyncHarness({ onResolved }: { onResolved: (value: string) => void }) {
  const overlay = useOverlay();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={async () => {
        onResolved(
          await overlay.openAsync<string>(
            ({ close }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="overlay-pick"
                onPress={() => close('고른 값')}
              />
            ),
            { dismissedValue: '답 없음' },
          ),
        );
      }}
    >
      <Text>open</Text>
    </Pressable>
  );
}

describe('useOverlay.openAsync', () => {
  it('close에 넘긴 값을 돌려준다', async () => {
    // Given
    const onResolved = jest.fn();
    await render(
      <OverlayProvider>
        <AsyncHarness onResolved={onResolved} />
      </OverlayProvider>,
    );
    fireEvent.press(screen.getByText('open')).catch(() => undefined);
    const pick = await screen.findByLabelText('overlay-pick');

    // When
    await fireEvent.press(pick);

    // Then
    expect(onResolved).toHaveBeenCalledWith('고른 값');
  });

  it('close 뒤에 사라져도 고른 값을 돌려준다', async () => {
    // Given
    const onResolved = jest.fn();
    await render(
      <OverlayProvider>
        <AsyncHarness onResolved={onResolved} />
      </OverlayProvider>,
    );
    fireEvent.press(screen.getByText('open')).catch(() => undefined);
    await fireEvent.press(await screen.findByLabelText('overlay-pick'));

    // When
    await screen.rerender(<OverlayProvider>{null}</OverlayProvider>);

    // Then
    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(onResolved).toHaveBeenCalledWith('고른 값');
  });

  it('부른 컴포넌트가 사라지면 정해 둔 값으로 끝난다', async () => {
    // Given
    const onResolved = jest.fn();
    await render(
      <OverlayProvider>
        <AsyncHarness onResolved={onResolved} />
      </OverlayProvider>,
    );
    fireEvent.press(screen.getByText('open')).catch(() => undefined);
    await screen.findByLabelText('overlay-pick');

    // When
    await screen.rerender(<OverlayProvider>{null}</OverlayProvider>);

    // Then
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith('답 없음'));
  });

  it('resetKey가 바뀌면 정해 둔 값으로 끝난다', async () => {
    // Given
    const onResolved = jest.fn();
    await render(
      <OverlayProvider resetKey="/feed">
        <AsyncHarness onResolved={onResolved} />
      </OverlayProvider>,
    );
    fireEvent.press(screen.getByText('open')).catch(() => undefined);
    await screen.findByLabelText('overlay-pick');

    // When
    await screen.rerender(
      <OverlayProvider resetKey="/mypage">
        <AsyncHarness onResolved={onResolved} />
      </OverlayProvider>,
    );

    // Then
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith('답 없음'));
  });

  it('같은 훅으로 다시 열면 앞의 약속을 정해 둔 값으로 끝낸다', async () => {
    // Given
    const onResolved = jest.fn();
    await render(
      <OverlayProvider>
        <AsyncHarness onResolved={onResolved} />
      </OverlayProvider>,
    );
    fireEvent.press(screen.getByText('open')).catch(() => undefined);
    await screen.findByLabelText('overlay-pick');

    // When
    fireEvent.press(screen.getByText('open')).catch(() => undefined);

    // Then
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith('답 없음'));
    expect(screen.getByLabelText('overlay-pick')).toBeTruthy();
  });
});

describe('OverlayProvider 상태', () => {
  it('오버레이가 마운트되면 활성 상태를 노출한다', async () => {
    // Given
    await render(
      <OverlayProvider>
        <Harness />
      </OverlayProvider>,
    );

    // When
    await fireEvent.press(screen.getByText('open'));

    // Then
    expect(screen.getByText('active')).toBeTruthy();
  });

  it('마지막 오버레이가 언마운트되면 비활성 상태로 돌아간다', async () => {
    // Given
    await render(
      <OverlayProvider>
        <Harness />
      </OverlayProvider>,
    );
    await fireEvent.press(screen.getByText('open'));

    // When
    await fireEvent.press(screen.getByLabelText('overlay-close'));

    // Then
    expect(screen.getByText('idle')).toBeTruthy();
  });
});
