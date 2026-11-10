import { type PropsWithChildren, useState } from 'react';

import { useEventListenerErrorReporting } from '../hooks/use-event-listener-error-reporting';
import { useStartupCleanup } from '../hooks/use-startup-cleanup';
import { type AppContainerPorts, createAppContainer } from './create-app-container';
import { StaticDIProvider } from './di-context';

interface DIProviderProps extends PropsWithChildren {
  ports: AppContainerPorts;
}

/** 컨테이너는 마운트마다 하나다. 포트는 프로세스 수명이라 루트 "다시 시도"가 다시 그려도 같은 것을 받는다 */
export function DIProvider({ children, ports }: DIProviderProps) {
  const [container] = useState(() => createAppContainer(ports));

  useEventListenerErrorReporting(container.logger);
  useStartupCleanup(container);

  return <StaticDIProvider container={container}>{children}</StaticDIProvider>;
}
