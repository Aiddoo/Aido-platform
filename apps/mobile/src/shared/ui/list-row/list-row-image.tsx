import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';

import { Box } from '../box';
import { Image } from '../image';

export interface ListRowImageProps extends Omit<ComponentProps<typeof Image>, 'style'> {
  size?: 'small' | 'medium' | 'large';
  rounded?: boolean;
}

export function ListRowImage({ size = 'medium', rounded = true, ...props }: ListRowImageProps) {
  return (
    <Box style={[styles.container, styles[size], rounded && styles.rounded]} className="bg-gray-3">
      <Image style={styles.image} contentFit="cover" {...props} />
    </Box>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  small: {
    width: 32,
    height: 32,
  },
  medium: {
    width: 48,
    height: 48,
  },
  large: {
    width: 64,
    height: 64,
  },
  rounded: {
    borderRadius: 8,
  },
});
