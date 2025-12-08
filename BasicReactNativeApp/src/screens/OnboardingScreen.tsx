import React, {useState} from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ScrollView, Alert } from 'react-native';
import { checkEmailAvailable } from '../services/api';
import Svg, { Path } from 'react-native-svg';
import svgPaths from '../assets/svg-mb8bzieg1y';

type OnboardingScreenProps = {
  onNext?: () => void;
  onSubmitFirst?: (name: string, email: string, password: string) => void;
};

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onNext, onSubmitFirst }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [checking, setChecking] = useState(false);

  const validatePassword = (pwd: string): string => {
    if (!pwd || pwd.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(pwd)) return 'Add at least one uppercase letter (A-Z).';
    if (!/[a-z]/.test(pwd)) return 'Add at least one lowercase letter (a-z).';
    if (!/[0-9]/.test(pwd)) return 'Add at least one number (0-9).';
    if (!/[^A-Za-z0-9]/.test(pwd)) return 'Add at least one symbol (e.g., !@#$%).';
    return '';
  };
  const validateEmailFormat = (val: string): string => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!val.trim()) return 'Email is required.';
    if (!re.test(val.trim())) return 'Enter a valid email address.';
    return '';
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
        {/* Top text block */}
        <View style={styles.topBlock}>
          <Text style={styles.welcomeTo}>Welcome to the</Text>
          <View style={styles.brandWrap}>
            <Text style={styles.brand}>News Nest</Text>
            <View style={styles.brandUnderline}>
              <Svg width="100%" height="3" viewBox="0 0 166 5" preserveAspectRatio="none" fill="none">
                <Path d={svgPaths.pf6c5700} stroke="#82775A" strokeWidth={1.64972} />
              </Svg>
            </View>
          </View>
        </View>

        {/* Form fields */}
        <View style={styles.formSection}>
          <Text style={styles.label}>What should we call you?</Text>
          <View style={styles.inputWrapperWhite}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Name"
              style={styles.input}
              placeholderTextColor="rgba(45,49,66,0.5)"
            />
            <View pointerEvents="none" style={[styles.inputBorder, { borderColor: '#000' }]} />
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Email</Text>
          <View style={styles.inputWrapperWhite}>
            <TextInput
              value={email}
              onChangeText={(txt) => {
                setEmail(txt);
                setEmailError(validateEmailFormat(txt));
              }}
              placeholder="Enter a valid email"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              placeholderTextColor="rgba(45,49,66,0.5)"
            />
            <View pointerEvents="none" style={[styles.inputBorder, { borderColor: '#000' }]} />
          </View>
          {!!emailError && <Text style={styles.errorText}>{emailError}</Text>}

          <Text style={[styles.label, { marginTop: 12 }]}>Password</Text>
          <View style={styles.inputWrapperWhite}>
            <TextInput
              value={password}
              onChangeText={(txt) => {
                setPassword(txt);
                setPasswordError(validatePassword(txt));
              }}
              placeholder="Super secret password"
              secureTextEntry
              style={styles.input}
              placeholderTextColor="rgba(45,49,66,0.5)"
            />
            <View pointerEvents="none" style={[styles.inputBorder, { borderColor: '#000' }]} />
          </View>
          {!!passwordError && <Text style={styles.errorText}>{passwordError}</Text>}

          <Text style={[styles.label, { marginTop: 12 }]}>Date of Birth</Text>
          <View style={styles.dobRow}>
            <View style={[styles.inputWrapperWhite, styles.dobItem]}>
              <TextInput
                value={month}
                onChangeText={setMonth}
                placeholder="MM"
                keyboardType="number-pad"
                maxLength={2}
                style={styles.input}
                placeholderTextColor="rgba(45,49,66,0.5)"
              />
              <View pointerEvents="none" style={[styles.inputBorder, { borderColor: '#000' }]} />
            </View>
            <View style={[styles.inputWrapperWhite, styles.dobItem]}>
              <TextInput
                value={day}
                onChangeText={setDay}
                placeholder="DD"
                keyboardType="number-pad"
                maxLength={2}
                style={styles.input}
                placeholderTextColor="rgba(45,49,66,0.5)"
              />
              <View pointerEvents="none" style={[styles.inputBorder, { borderColor: '#000' }]} />
            </View>
            <View style={[styles.inputWrapperWhite, styles.dobItem]}>
              <TextInput
                value={year}
                onChangeText={setYear}
                placeholder="YYYY"
                keyboardType="number-pad"
                maxLength={4}
                style={styles.input}
                placeholderTextColor="rgba(45,49,66,0.5)"
              />
              <View pointerEvents="none" style={[styles.inputBorder, { borderColor: '#000' }]} />
            </View>
          </View>
        </View>

          {/* Next button */}
          <TouchableOpacity
            onPress={async () => {
              const trimmedName = name.trim();
              if (!trimmedName) {
                Alert.alert('Name required', 'Please tell us what we should call you.');
                return;
              }
              const emailFmtError = validateEmailFormat(email);
              if (emailFmtError) {
                setEmailError(emailFmtError);
                Alert.alert('Email invalid', emailFmtError);
                return;
              }
              const pwdError = validatePassword(password);
              if (pwdError) {
                setPasswordError(pwdError);
                Alert.alert('Password needs to be stronger', pwdError);
                return;
              }
              // Verify email is not already used
              try {
                setChecking(true);
                const available = await checkEmailAvailable(email.trim());
                if (!available) {
                  setEmailError('This email is already in use.');
                  Alert.alert('Email in use', 'Please use a different email.');
                  return;
                }
              } catch (e: any) {
                Alert.alert('Check failed', e?.message || 'Unable to verify email. Please try again.');
                return;
              } finally {
                setChecking(false);
              }
              // Submit first step data and advance
              onSubmitFirst?.(trimmedName, email.trim(), password);
              onNext?.();
            }}
            activeOpacity={0.85}
            style={styles.nextButton}
          >
            <View style={styles.nextOverlay} />
            <Text style={styles.nextText}>{checking ? 'Checking…' : 'Next →'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  card: {
    width: 345,
    height: 730,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2.556,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 6, height: 6 },
    padding: 20,
  },
  topBlock: {
    height: 96,
    width: '100%',
  },
  welcomeTo: {
    fontSize: 24,
    lineHeight: 32,
    textAlign: 'center',
    color: '#82775a',
  },
  brandWrap: {
    marginTop: 8,
    alignSelf: 'center',
  },
  brand: {
    fontSize: 48,
    lineHeight: 48,
    textAlign: 'center',
    color: '#2d3142',
  },
  brandUnderline: {
    marginTop: 4,
    height: 3,
  },
  formSection: {
    marginTop: 20,
  },
  label: {
    fontSize: 20,
    color: '#2d3142',
    marginBottom: 6,
  },
  inputWrapperWhite: {
    backgroundColor: '#ffffff',
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
  errorText: {
    color: '#d4183d',
    marginTop: 6,
    fontSize: 14,
  },
  dobRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  dobItem: {
    flex: 1,
  },
  nextButton: {
    position: 'absolute',
    left: 104,
    bottom: 22,
    width: 128,
    height: 57,
    backgroundColor: '#9ea8ca',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.556,
    borderColor: '#000',
  },
  nextOverlay: {
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
  nextText: {
    color: '#fff',
    fontSize: 20,
  },
});


