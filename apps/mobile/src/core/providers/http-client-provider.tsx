import { createContext, type PropsWithChildren, use, useState } from 'react';
import { type HttpClient, KyHttpClient } from '../api';

const HttpClientContext = createContext<HttpClient | null>(null);

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
