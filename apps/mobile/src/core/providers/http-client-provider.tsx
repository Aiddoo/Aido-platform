import { httpClient } from '@src/core/di/container';
import type { HttpClient } from '@src/shared/api/http-client';
import { createContext, type PropsWithChildren, use } from 'react';

export const HttpClientContext = createContext<HttpClient | null>(null);

export const HttpClientProvider = ({ children }: PropsWithChildren) => {
  return <HttpClientContext value={httpClient}>{children}</HttpClientContext>;
};

export const useHttpClient = (): HttpClient => {
  const context = use(HttpClientContext);

  if (!context) {
    throw new Error('useHttpClient must be used within HttpClientProvider');
  }

  return context;
};
