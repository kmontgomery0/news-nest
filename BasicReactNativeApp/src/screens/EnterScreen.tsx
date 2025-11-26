import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Defs, ClipPath, Rect, G } from 'react-native-svg';
import svgPaths from '../assets/svg-xwebab38e5';

type EnterScreenProps = {
  onGetStarted?: () => void;
};

export const EnterScreen: React.FC<EnterScreenProps> = ({ onGetStarted }) => {
  return (
    <View style={styles.container} testID="enter-screen">
      {/* Top decorative wave */}
      <View style={styles.topWave} pointerEvents="none">
        <Svg width="100%" height="26" viewBox="0 0 393 27" preserveAspectRatio="none" fill="none">
          <G clipPath="url(#clip0_1_1620)">
            <Path d={svgPaths.p32a3ca0} fill="#82775A" opacity={0.3} />
            <Path d={svgPaths.p3ba71480} stroke="#82775A" strokeWidth={0.98252} />
          </G>
          <Defs>
            <ClipPath id="clip0_1_1620">
              <Rect width="393.008" height="26.2005" fill="white" />
            </ClipPath>
          </Defs>
        </Svg>
      </View>

      <View style={styles.card}>
        <View style={styles.illustrationContainer}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.image}
            resizeMode="cover"
            accessible
            accessibilityIgnoresInvertColors
          />
        </View>
        {/* Underline accent */}
        <View style={styles.underlineWrap} pointerEvents="none">
          <Svg width="100%" height="6" viewBox="0 0 319 7" preserveAspectRatio="none" fill="none">
            <Path d={svgPaths.p335c4000} stroke="#9EA8CA" strokeWidth={2.41356} />
          </Svg>
        </View>
        <Text style={styles.tagline}>
          Your friendly bird buddies are here to bring you the news!
        </Text>
        <TouchableOpacity onPress={onGetStarted} activeOpacity={0.85} style={styles.ctaButton}>
          <View style={styles.ctaShadow} />
          <Text style={styles.ctaText}>Let's Fly!</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom decorative wave */}
      <View style={styles.bottomWave} pointerEvents="none">
        <Svg width="100%" height="26" viewBox="0 0 393 27" preserveAspectRatio="none" fill="none">
          <G clipPath="url(#clip0_1_1624)">
            <Path d={svgPaths.p11bb8f00} stroke="#82775A" strokeWidth={0.98252} />
            <Path d={svgPaths.pc180600} fill="#C2CFBB" opacity={0.3} />
          </G>
          <Defs>
            <ClipPath id="clip0_1_1624">
              <Rect width="393.008" height="26.2005" fill="white" />
            </ClipPath>
          </Defs>
        </Svg>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f3f0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '92%',
    maxWidth: 393,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 8, height: 8 },
    elevation: 4,
  },
  topWave: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 26,
  },
  bottomWave: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 26,
  },
  illustrationContainer: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  tagline: {
    fontSize: 20,
    lineHeight: 28,
    color: '#2d3142',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  underlineWrap: {
    width: '100%',
    height: 6,
    marginBottom: 12,
  },
  ctaButton: {
    marginTop: 8,
    backgroundColor: '#9ea8ca',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    width: 160,
    borderWidth: 2,
    borderColor: '#000',
  },
  ctaShadow: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    borderColor: '#000',
    borderLeftWidth: 2,
    borderTopWidth: 2,
    borderRightWidth: 5,
    borderBottomWidth: 5,
  },
  ctaText: {
    color: '#fff',
    fontSize: 20,
  },
});


