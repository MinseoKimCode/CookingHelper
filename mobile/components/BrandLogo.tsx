import React from 'react';
import { Image } from 'react-native';

export function BrandLogo() {
  return (
    <Image
      source={require('../../assets/app/wordmark.png')}
      accessibilityLabel="한끼"
      accessibilityRole="image"
      resizeMode="contain"
      style={{ width: 90, height: 40 }}
    />
  );
}
