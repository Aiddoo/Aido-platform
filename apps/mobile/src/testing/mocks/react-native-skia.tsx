/** Skia는 네이티브 캔버스라 Jest에서 그릴 수 없다. 그리는 결과는 시뮬레이터에서 보고 테스트는 화면 흐름만 본다 */
const NothingToDraw = () => null;

const createPathBuilder = () => {
  const builder: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_target, name) => (name === 'build' ? () => ({}) : () => builder),
    },
  );
  return builder;
};

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
export const matchFont = () => ({
  measureText: (text: string) => ({ x: 0, y: 0, width: text.length, height: 1 }),
  getMetrics: () => ({ ascent: -1, descent: 0 }),
});
export const Skia = {
  Color: () => new Float32Array([1, 1, 1, 1]),
  RuntimeEffect: { Make: () => ({}) },
  PathBuilder: { Make: createPathBuilder },
  XYWHRect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
  RRectXY: (rect: unknown, rx: number, ry: number) => ({ rect, rx, ry }),
};
