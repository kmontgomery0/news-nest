import React, {useState} from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import Svg, { Path, Defs, ClipPath, Rect, G } from 'react-native-svg';
import svgPaths from '../assets/svg-8fga0qf2pt';
import { loginUser } from '../services/api';

type LoginScreenProps = {
  onSignedIn?: (email: string) => void;
  onJoinFlock?: () => void;
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSignedIn, onJoinFlock }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Backend expects "username"; we treat email as username
      const clean = email.trim();
      await loginUser(clean, password);
      onSignedIn?.(clean);
    } catch (e: any) {
      Alert.alert('Sign in failed', e?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
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
        {/* Heading */}
        <Text style={styles.heading}>Welcome Back!</Text>
        {/* Underline accent */}
        <View style={styles.underlineWrap} pointerEvents="none">
          <Svg width="100%" height="6" viewBox="0 0 277 10" preserveAspectRatio="none" fill="none">
            <Path d={svgPaths.p3b24400} stroke="#9EA8CA" strokeWidth={3.83228} />
          </Svg>
        </View>
        {/* Subtext */}
        <Text style={styles.subtext}>Ready for some news?</Text>

        {/* Email */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrapperLight}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              style={styles.input}
              placeholderTextColor="rgba(45,49,66,0.5)"
            />
            <View pointerEvents="none" style={[styles.inputBorder, { borderColor: '#c2cfbb' }]} />
          </View>
        </View>

        {/* Password */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapperLight}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Super secret password"
              secureTextEntry
              style={styles.input}
              placeholderTextColor="rgba(45,49,66,0.5)"
            />
            <View pointerEvents="none" style={[styles.inputBorder, { borderColor: '#dcbaab' }]} />
          </View>
        </View>

        {/* Sign In */}
        <TouchableOpacity onPress={handleSignIn} activeOpacity={0.85} style={styles.signInButton} disabled={loading}>
          <View style={styles.signInOverlay} />
          <Text style={styles.signInText}>{loading ? 'Signing In…' : 'Sign In'}</Text>
        </TouchableOpacity>

        {/* Join link */}
        <TouchableOpacity onPress={onJoinFlock} style={styles.joinLinkTouchable} activeOpacity={0.8}>
          <Text style={styles.joinLink}>New here? Join the flock</Text>
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
  card: {
    width: '92%',
    maxWidth: 393,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 6, height: 6 },
  },
  heading: {
    fontSize: 36,
    lineHeight: 40,
    color: '#2d3142',
    textAlign: 'center',
    marginBottom: 6,
  },
  underlineWrap: {
    width: '70%',
    alignSelf: 'center',
    height: 6,
    marginBottom: 8,
  },
  subtext: {
    fontSize: 20,
    lineHeight: 28,
    color: '#717182',
    textAlign: 'center',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 20,
    color: '#2d3142',
    marginBottom: 6,
  },
  inputWrapperLight: {
    backgroundColor: '#f8f9fb',
    borderRadius: 8,
    minHeight: 56,
    justifyContent: 'center',
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'web' ? 12 : 10,
    fontSize: 18,
    color: '#2d3142',
  },
  inputBorder: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderWidth: 1.917,
    borderRadius: 8,
  },
  signInButton: {
    marginTop: 14,
    backgroundColor: '#9ea8ca',
    height: 57,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.556,
    borderColor: '#000',
  },
  signInOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    borderWidth: 2.556,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  signInText: {
    color: '#fff',
    fontSize: 20,
  },
  joinLinkTouchable: {
    alignSelf: 'center',
    marginTop: 12,
  },
  joinLink: {
    fontSize: 18,
    color: '#9ea8ca',
    textDecorationLine: 'underline',
  },
});


