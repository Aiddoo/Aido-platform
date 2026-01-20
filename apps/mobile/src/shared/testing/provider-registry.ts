import type { ReactNode } from 'react';

type ProviderWrapper = (children: ReactNode) => ReactNode;

export function createProviderRegistry() {
  const providers: ProviderWrapper[] = [];

  return {
    add(wrapper: ProviderWrapper) {
      providers.push(wrapper);
      return this;
    },

    addOptional<T>(dependency: T | undefined, wrapper: (dep: T, children: ReactNode) => ReactNode) {
      if (dependency) {
        providers.push((children) => wrapper(dependency, children));
      }
      return this;
    },

    compose(children: ReactNode): ReactNode {
      return providers.reduceRight((acc, wrap) => wrap(acc), children);
    },
  };
}
