import { Canvas, Group } from '@shopify/react-native-skia';
import { useDeviceTraits } from '@src/bootstrap/providers/di-context';
import { renderScreen } from '@src/testing/render';
import { ErrorBoundary } from 'react-error-boundary';

interface LayerProps {
  onDraw: (isLowMemoryDevice: boolean) => void;
}

/** Canvas 밖에서 읽은 값을 props로 받는 레이어 */
function LayerWithProps({
  isLowMemoryDevice,
  onDraw,
}: LayerProps & { isLowMemoryDevice: boolean }) {
  onDraw(isLowMemoryDevice);
  return null;
}

/** Canvas 안에서 DI 훅을 부르는 레이어. 기기에서는 context가 없어 깨진다 */
function LayerReadingDi({ onDraw }: LayerProps) {
  onDraw(useDeviceTraits().isLowMemoryDevice);
  return null;
}

function SceneWithProps({ onDraw }: LayerProps) {
  const { isLowMemoryDevice } = useDeviceTraits();

  return (
    <Canvas>
      <Group>
        <LayerWithProps isLowMemoryDevice={isLowMemoryDevice} onDraw={onDraw} />
      </Group>
    </Canvas>
  );
}

describe('Skia mock의 Canvas', () => {
  it('Canvas 밖에서 읽어 props로 내린 값은 레이어가 받아 그린다', async () => {
    // Given
    const onDraw = jest.fn();

    // When
    await renderScreen(<SceneWithProps onDraw={onDraw} />);

    // Then
    expect(onDraw).toHaveBeenCalledWith(false);
  });

  it('Canvas의 자식이 DI 훅을 부르면 기기처럼 context가 없어 실패한다', async () => {
    // Given
    const onDraw = jest.fn();
    const onError = jest.fn();

    // When
    await renderScreen(
      <ErrorBoundary fallback={null} onError={onError}>
        <Canvas>
          <Group>
            <LayerReadingDi onDraw={onDraw} />
          </Group>
        </Canvas>
      </ErrorBoundary>,
    );

    // Then
    expect(onError).toHaveBeenCalledWith(
      new Error('useDI must be used within DIProvider'),
      expect.anything(),
    );
    expect(onDraw).not.toHaveBeenCalled();
  });
});
