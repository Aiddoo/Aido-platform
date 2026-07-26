import type { DIContainer } from '@src/bootstrap/providers/di-context';

/**
 * 테스트용 DI 컨테이너. 주입한 의존성만 노출하고,
 * 주입하지 않은 의존성에 접근하면 즉시 실패시켜 누락을 드러낸다.
 *
 * StaticDIProvider와 함께 사용한다:
 * ```tsx
 * <StaticDIProvider container={createMockDIContainer({ analytics })}>
 * ```
 */
export function createMockDIContainer(overrides: Partial<DIContainer> = {}): DIContainer {
  const defaults: Partial<DIContainer> = {
    // useTrack은 모든 화면에서 귀속 저장소를 함께 주입받는다. 관심 없는 테스트에서는
    // no-op을 제공하고, 귀속 동작을 검증하는 테스트만 명시적으로 override한다.
    featureAttribution: {
      record: jest.fn(),
      consume: jest.fn().mockReturnValue(null),
    },
  };
  const dependencies = { ...defaults, ...overrides };

  return new Proxy(dependencies as DIContainer, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as keyof DIContainer];
      }
      throw new Error(`테스트 DI 컨테이너에 '${String(prop)}'가 주입되지 않았습니다`);
    },
  });
}
