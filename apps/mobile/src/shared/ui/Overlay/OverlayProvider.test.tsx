import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { OverlayProvider } from './OverlayProvider';
import { useOverlay } from './useOverlay';
import { useOverlayState } from './useOverlayState';

function Harness() {
  const overlay = useOverlay();
  const { hasActiveOverlay } = useOverlayState();

  return (
    <>
      <Text>{hasActiveOverlay ? 'active' : 'idle'}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void overlay.open(({ close, exit }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="overlay-close"
              onPress={() => {
                close();
                exit();
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
