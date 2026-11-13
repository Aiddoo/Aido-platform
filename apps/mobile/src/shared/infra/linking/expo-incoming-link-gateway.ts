import type { IncomingLinkGateway } from '@src/core/ports/incoming-link-gateway';
import * as Linking from 'expo-linking';

export const expoIncomingLinkGateway: IncomingLinkGateway = {
  getInitialUrl: () => Linking.getInitialURL(),
  subscribe: (listener) => {
    const subscription = Linking.addEventListener('url', ({ url }) => listener(url));
    return () => subscription.remove();
  },
};
