import { z } from 'zod';

/** Skia는 네이티브 캔버스라 Jest에서 그릴 수 없다. 그리는 결과는 시뮬레이터에서 보고 테스트는 화면 흐름만 본다 */
const NothingToDraw = () => null;

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
        return (...args: unknown[]) => {
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
          commands.push(`${String(name)}(${args.map((arg) => JSON.stringify(arg)).join(',')})`);
          return builder;
        };
      },
    },
  );
  return builder;
}

export const Canvas = NothingToDraw;
export const Circle = NothingToDraw;
export const Group = NothingToDraw;
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
  Path: { Make: createPath },
  PathBuilder: { Make: createPathBuilder },
  XYWHRect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
  RRectXY: (rect: unknown, rx: number, ry: number) => ({ rect, rx, ry }),
};
