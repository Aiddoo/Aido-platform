import type { ImageProps } from 'react-native';
import { Image, StyleSheet, View } from 'react-native';

export interface ListRowImageProps extends Omit<ImageProps, 'style'> {
  size?: 'small' | 'medium' | 'large';
  rounded?: boolean;
}

export const ListRowImage = ({ size = 'medium', rounded = true, ...props }: ListRowImageProps) => {
  return (
    <View style={[styles.container, styles[size], rounded && styles.rounded]}>
      <Image style={styles.image} resizeMode="cover" {...props} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
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
