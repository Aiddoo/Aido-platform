import type { HttpClient } from '@src/shared/api/http-client';
import { KyHttpClient } from '@src/shared/api/http-client.impl';
import { createContext, type PropsWithChildren, use, useState } from 'react';

export const HttpClientContext = createContext<HttpClient | null>(null);

export const HttpClientProvider = ({ children }: PropsWithChildren) => {
  const [httpClient] = useState<HttpClient>(() => new KyHttpClient());

  return <HttpClientContext value={httpClient}>{children}</HttpClientContext>;
};

export const useHttpClient = (): HttpClient => {
  const context = use(HttpClientContext);

  if (!context) {
    throw new Error('useHttpClient must be used within HttpClientProvider');
  }

  return context;
};
