import { DIContext } from '@src/bootstrap/providers/di-context';
import { SharedDIContext } from '@src/shared/di/shared-di-context';
import type { PropsWithChildren } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { z } from 'zod';

/**
 * Skia는 네이티브 캔버스라 Jest에서 그릴 수 없다. 그리는 결과는 시뮬레이터에서 보고 테스트는 화면 흐름만 본다.
 * 그리는 노드는 비우되 Canvas는 자식을 DI context 없이 그려 레이어의 훅은 돈다(아래 `CanvasWithoutContext`)
 */
const NothingToDraw = () => null;

/** 자식을 가진 Skia 노드(Group·Mask 등)는 그리지 않고 자식의 훅만 돌게 한다 */
function ChildrenOnly({ children }: PropsWithChildren) {
  return children;
}

/**
 * Skia는 자기 reconciler로 그려 Canvas의 자식이 React context를 받지 못한다. 기기에서만 깨지는 그 실수를
 * 테스트가 잡도록 자식을 DI 없이 그린다. 레이어가 DI 훅을 부르면 `useDI must be used within DIProvider`로 실패한다
 */
function CanvasWithoutContext({ children }: PropsWithChildren) {
  return (
    <DIContext value={null}>
      <SharedDIContext value={null}>{children}</SharedDIContext>
    </DIContext>
  );
}

const mockPathSchema = z.object({ commands: z.array(z.string()), isDisposed: z.boolean() });

/** 경로가 받은 그리기 명령(`lineTo(10,20)`)과 놓였는지를 읽는다. 경로 수명을 다루는 공용 훅 테스트가 쓴다 */
export function readMockPath(path: unknown) {
  return mockPathSchema.parse(path);
}

function createPath(commands: readonly string[] = []) {
  const path = {
    commands,
    isDisposed: false,
    dispose: () => {
      path.isDisposed = true;
    },
  };
  return path;
}

/** 앱이 쓰는 그리기 명령. 그 밖의 이름은 네이티브 객체처럼 undefined라 Reanimated가 애니메이션으로 읽지 않는다 */
const PATH_BUILDER_COMMANDS = new Set<string | symbol>([
  'moveTo',
  'lineTo',
  'close',
  'addArc',
  'addCircle',
  'addRect',
  'addRRect',
  'addPath',
  'transform',
  'build',
  'detach',
]);
/** 위에 없는 그리기 명령. undefined를 돌려주면 원인을 알기 어려운 TypeError가 나므로 이름을 대며 던진다 */
const UNSUPPORTED_PATH_BUILDER_COMMAND =
  /^(?:move|line|quad|cubic|conic|arc|rMove|rLine|rQuad|rCubic|rConic)To\w*$|^add(?:Oval|Poly|Path|Arc\w+|Circle\w+|Rect\w+)$/;

// 앱에서 놓은 빌더를 다시 쓰면 실패하듯 여기서도 던진다
function createPathBuilder() {
  let commands: string[] = [];
  let isDisposed = false;
  const builder: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_target, name) => {
        if (name === 'dispose') {
          return () => {
            isDisposed = true;
          };
        }
        if (!PATH_BUILDER_COMMANDS.has(name)) {
          if (typeof name === 'string' && UNSUPPORTED_PATH_BUILDER_COMMAND.test(name)) {
            throw new Error(
              `mock에 없는 PathBuilder 메서드 ${name}입니다. PATH_BUILDER_COMMANDS에 더하세요`,
            );
          }
          return undefined;
        }
        return (...callArguments: unknown[]) => {
          if (isDisposed) {
            throw new Error(`놓은 PathBuilder의 ${String(name)}를 불렀습니다`);
          }
          if (name === 'build' || name === 'detach') {
            const path = createPath(commands);
            if (name === 'detach') {
              commands = [];
            }
            return path;
          }
          commands.push(
            `${String(name)}(${callArguments.map((arg) => JSON.stringify(arg)).join(',')})`,
          );
          return builder;
        };
      },
    },
  );
  return builder;
}

export const Canvas = CanvasWithoutContext;
export const Circle = NothingToDraw;
export const Group = ChildrenOnly;
export const Mask = ChildrenOnly;
export const BackdropFilter = ChildrenOnly;
export const Atlas = NothingToDraw;
export const Blur = NothingToDraw;
export const DashPathEffect = NothingToDraw;
export const Image = NothingToDraw;
export const Oval = NothingToDraw;
export const Paint = NothingToDraw;
export const RuntimeShader = NothingToDraw;
export const LinearGradient = NothingToDraw;
export const Path = NothingToDraw;
export const RadialGradient = NothingToDraw;
export const Rect = NothingToDraw;
export const Shader = NothingToDraw;
export const RoundedRect = NothingToDraw;
export const BlurMask = NothingToDraw;
export const SweepGradient = NothingToDraw;
export const Text = NothingToDraw;
export const usePathValue = () => ({});
// 레이어가 텍스처·입자 변환을 공유 값으로 읽는다. 만들어진 것이 없는 빈 값이다
export const useTexture = () => useSharedValue(null);
export const useRSXformBuffer = () => useSharedValue([]);
export const vec = (x: number, y: number) => ({ x, y });
// 날씨 장면의 입자 텍스처가 모듈을 읽을 때 샘플링 값을 정한다
export const FilterMode = { Nearest: 0, Linear: 1 };
export const MipmapMode = { None: 0, Nearest: 1, Linear: 2 };
export const matchFont = () => ({
  measureText: (text: string) => ({ x: 0, y: 0, width: text.length, height: 1 }),
  getMetrics: () => ({ ascent: -1, descent: 0 }),
  dispose: () => undefined,
});
export const Skia = {
  Color: () => new Float32Array([1, 1, 1, 1]),
  RuntimeEffect: { Make: () => ({}) },
  Path: { Make: createPath, MakeFromSVGString: () => createPath() },
  PathBuilder: { Make: createPathBuilder },
  XYWHRect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
  RRectXY: (rect: unknown, rx: number, ry: number) => ({ rect, rx, ry }),
};
