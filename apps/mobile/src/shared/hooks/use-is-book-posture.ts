import { addHingeListener, getHinge } from 'expo-hinge';
import { useSyncExternalStore } from 'react';
import { useWindowDimensions } from 'react-native';

function subscribe(onChange: () => void) {
  const subscription = addHingeListener(onChange);

  return () => subscription.remove();
}

function getIsPartiallyOpen() {
  return getHinge()?.status === 'partiallyOpen';
}

export function useIsBookPosture(): boolean {
  const isPartiallyOpen = useSyncExternalStore(subscribe, getIsPartiallyOpen);
  const { width, height } = useWindowDimensions();

  return isPartiallyOpen && height >= width;
}
