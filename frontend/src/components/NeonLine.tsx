import React from 'react';
import { View, StyleSheet } from 'react-native';

interface Props {
  color: string;
  position?: 'top' | 'bottom';
}

export default function NeonLine({ color, position = 'top' }: Props) {
  return (
    <View 
      style={[
        styles.container,
        position === 'top' ? styles.top : styles.bottom,
      ]}
    >
      {/* Glow effect - outer */}
      <View 
        style={[
          styles.glowOuter,
          { backgroundColor: color, shadowColor: color }
        ]} 
      />
      {/* Glow effect - middle */}
      <View 
        style={[
          styles.glowMiddle,
          { backgroundColor: color, shadowColor: color }
        ]} 
      />
      {/* Core line */}
      <View 
        style={[
          styles.line,
          { backgroundColor: color }
        ]} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    left: 0,
    right: 0,
    height: 3,
    zIndex: 1000,
    width: '100%',
  },
  top: {
    // removed position: absolute
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
  },
  glowOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 8,
    top: -2,
    opacity: 0.1,
    borderRadius: 4,
  },
  glowMiddle: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    top: 0,
    opacity: 0.2,
    borderRadius: 2,
  },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    top: 1,
    opacity: 0.6,
    borderRadius: 1,
  },
});
