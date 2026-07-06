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
  return new Proxy(overrides as DIContainer, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as keyof DIContainer];
      }
      throw new Error(`테스트 DI 컨테이너에 '${String(prop)}'가 주입되지 않았습니다`);
    },
  });
}
