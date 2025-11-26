import React, {useState} from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ScrollView, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import svgPaths from '../assets/svg-hef2pblkoo';

type OnboardingScreen2Props = {
  onNext?: () => Promise<void> | void;
  onSubmitPreferences?: (prefs: {
    parrot_name: string;
    times: string[];
    frequency: string;
    push_notifications: boolean;
    email_summaries: boolean;
    topics: string[];
  }) => Promise<void> | void;
};

export const OnboardingScreen2: React.FC<OnboardingScreen2Props> = ({ onNext, onSubmitPreferences }) => {
  const [birdName, setBirdName] = useState('');
  const [selectedTimes, setSelectedTimes] = useState<string[]>(['morning']);
  const [frequency, setFrequency] = useState<'once' | 'twice' | 'thrice'>('thrice');
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailSummaries, setEmailSummaries] = useState(true);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggleTime = (time: string) => {
    setSelectedTimes(prev =>
      prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]
    );
  };

  const toggleTopic = (topic: string) => {
    setSelectedTopics(prev => {
      if (prev.includes(topic)) return prev.filter(t => t !== topic);
      if (prev.length >= 4) return prev;
      return [...prev, topic];
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.welcome}>Welcome to the</Text>
          <View style={styles.brandWrap}>
            <Text style={styles.brand}>NewsNest</Text>
            <View style={styles.underline}>
              <Svg width="100%" height="3" viewBox="0 0 166 5" preserveAspectRatio="none" fill="none">
                <Path d={svgPaths.pf6c5700} stroke="#82775A" strokeWidth={1.64972} />
              </Svg>
            </View>
          </View>
        </View>

        {/* Bird name */}
        <View style={styles.section}>
          <Text style={styles.label}>Name Your News Parrot!</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              value={birdName}
              onChangeText={setBirdName}
              placeholder="Give your bird a name"
              style={styles.input}
              placeholderTextColor="rgba(45,49,66,0.5)"
            />
            <View pointerEvents="none" style={[styles.inputBorder, { borderColor: '#000' }]} />
          </View>
        </View>

        {/* Preferred Chat Time */}
        <View style={styles.section}>
          <Text style={styles.label}>Preferred Chat Time</Text>
          <Text style={styles.helper}>When do you usually want your bird to check in with you? Select multiple times</Text>
          <View style={styles.chipsGrid}>
            {[
              { id: 'morning', icon: '☀️', title: 'Morning', sub: '(9 AM)' },
              { id: 'afternoon', icon: '🌤️', title: 'Afternoon', sub: '(1 PM)' },
              { id: 'evening', icon: '🌆', title: 'Evening', sub: '(5 PM)' },
              { id: 'night', icon: '🌙', title: 'Night', sub: '(9 PM)' },
              { id: 'custom', icon: '⏰', title: 'Custom', sub: '' },
            ].map(item => {
              const active = selectedTimes.includes(item.id);
              return (
                <TouchableOpacity key={item.id} onPress={() => toggleTime(item.id)} activeOpacity={0.85}
                  style={[styles.timeChip, active && styles.timeChipActive]}>
                  <Text style={styles.timeIcon}>{item.icon}</Text>
                  <View>
                    <Text style={styles.timeTitle}>{item.title}</Text>
                    {!!item.sub && <Text style={styles.timeSub}>{item.sub}</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.smallNote}>You can always change this later!</Text>
        </View>

        {/* Frequency */}
        <View style={styles.section}>
          <Text style={styles.freqLabel}>Frequency</Text>
          <View style={styles.freqRow}>
            {[
              { id: 'once', label: 'Once a day' },
              { id: 'twice', label: 'Twice a day' },
              { id: 'thrice', label: 'Thrice a day' },
            ].map(f => {
              const active = frequency === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => setFrequency(f.id as any)}
                  style={[styles.freqBtn, active && styles.freqBtnActive]}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.freqText, active && styles.freqTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Delivery */}
        <View style={styles.section}>
          <Text style={styles.deliveryLabel}>Delivery</Text>
          <View style={styles.deliveryRow}>
            <Text style={styles.deliveryText}>Push Notifications (on/off)</Text>
            <TouchableOpacity
              onPress={() => setPushNotifications(!pushNotifications)}
              activeOpacity={0.8}
              style={[styles.toggle, pushNotifications ? styles.toggleOn : styles.toggleOff]}
            >
              <View style={[styles.knob, pushNotifications ? styles.knobRight : styles.knobLeft]} />
            </TouchableOpacity>
          </View>
          <View style={styles.deliveryRow}>
            <Text style={styles.deliveryText}>Email Summaries (on/off)</Text>
            <TouchableOpacity
              onPress={() => setEmailSummaries(!emailSummaries)}
              activeOpacity={0.8}
              style={[styles.toggle, emailSummaries ? styles.toggleOn : styles.toggleOff]}
            >
              <View style={[styles.knob, emailSummaries ? styles.knobRight : styles.knobLeft]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Topics */}
        <View style={styles.section}>
          <Text style={styles.label}>Choose Your Favorite Topics</Text>
          <Text style={styles.helper}>(up to 4, optional)</Text>
          <Text style={styles.helper}>Selected {selectedTopics.length}/4</Text>
          <View style={styles.topicsGrid}>
            {[
              { id: 'sports', label: 'Flynn the Falcon\n(Sports)', img: require('../assets/falcon.png') },
              { id: 'entertainment', label: 'Pizzazz the Peacock\n(Entertainment & Lifestyle)', img: require('../assets/peacock.png') },
              { id: 'business', label: 'Edwin the Eagle\n(Business & Economy)', img: require('../assets/eagle.png') },
              { id: 'technology', label: 'Pixel the Pigeon\n(Technology)', img: require('../assets/pigeon.png') },
              { id: 'crime-legal', label: 'Credo the Crow\n(Crime & Legal)', img: require('../assets/crow.png') },
              { id: 'politics', label: 'Cato the Crane\n(Politics)', img: require('../assets/crane.png') },
              { id: 'science-environment', label: 'Gaia the Goose\n(Science & Environment)', img: require('../assets/goose.png') },
              { id: 'feel-good', label: 'Happy the Hummingbird\n(Feel-Good Stories)', img: require('../assets/hummingbird.png') },
              { id: 'history-trends', label: 'Omni the Owl\n(History & Trends)', img: require('../assets/owl.png') },
            ].map(item => {
              const active = selectedTopics.includes(item.id);
              const atLimit = selectedTopics.length >= 4;
              const disabled = !active && atLimit;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => toggleTopic(item.id)}
                  activeOpacity={0.85}
                  disabled={disabled}
                  style={[
                    styles.topicCard,
                    active && styles.topicActive,
                    disabled && styles.topicDisabled,
                  ]}
                >
                  <Image source={item.img} resizeMode="contain" style={styles.topicImage} />
                  <Text style={styles.topicLabel} numberOfLines={2}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Next */}
        <View style={styles.nextWrap}>
          <TouchableOpacity
            onPress={async () => {
              if (submitting) return;
              try {
                setSubmitting(true);
                console.log('[Onboarding2] Next pressed - registering user first');
                // 1) Register the user first
                await onNext?.();
                console.log('[Onboarding2] Registration succeeded - saving preferences');
                // 2) Then save preferences
                await onSubmitPreferences?.({
                  parrot_name: birdName,
                  times: selectedTimes,
                  frequency,
                  push_notifications: pushNotifications,
                  email_summaries: emailSummaries,
                  topics: selectedTopics,
                });
                console.log('[Onboarding2] Preferences saved');
              } catch (e: any) {
                console.error('[Onboarding2] Registration failed', e);
                Alert.alert('Could not complete setup', e?.message || 'Please try again.');
              } finally {
                setSubmitting(false);
              }
            }}
            activeOpacity={0.85}
            style={styles.nextButton}
            disabled={submitting}
          >
            <View style={styles.nextOverlay} />
            <Text style={styles.nextText}>{submitting ? 'Creating...' : 'Next →'}</Text>
          </TouchableOpacity>
        </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f3f0', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 12 },
  scrollContent: { alignItems: 'center', paddingBottom: 24 },
  card: { width: 345, height: 1550, backgroundColor: '#fff', borderRadius: 12, borderWidth: 2.556, borderColor: '#000', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 6, height: 6 }, padding: 20 },
  header: { marginBottom: 20 },
  welcome: { fontSize: 24, lineHeight: 32, color: '#82775a', textAlign: 'center' },
  brandWrap: { marginTop: 8, alignItems: 'center' },
  brand: { fontSize: 48, lineHeight: 48, color: '#2d3142', textAlign: 'center' },
  underline: { marginTop: 4, height: 3, width: 165 },
  section: { marginBottom: 20 },
  label: { fontSize: 20, color: '#2d3142', marginBottom: 8 },
  helper: { fontSize: 14, color: '#717182', marginBottom: 8 },
  inputWrapper: { backgroundColor: '#fff', borderRadius: 8, minHeight: 56, justifyContent: 'center' },
  input: { paddingHorizontal: 16, paddingVertical: 12, fontSize: 18, color: '#2d3142' },
  inputBorder: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderWidth: 1.917, borderRadius: 8 },
  chipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { borderWidth: 1.917, borderColor: '#000', borderRadius: 25, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 0, shadowOffset: { width: 3, height: 3 } },
  timeChipActive: { backgroundColor: '#9ea8ca' },
  timeIcon: { fontSize: 20 },
  timeTitle: { fontSize: 14, color: '#2d3142' },
  timeSub: { fontSize: 12, color: '#2d3142', opacity: 0.8 },
  smallNote: { fontSize: 14, color: '#717182' },
  freqLabel: { fontSize: 18, color: '#717182', marginBottom: 8 },
  freqRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  freqBtn: { flex: 1, borderWidth: 2.556, borderColor: '#000', borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: '#fff' },
  freqBtnActive: { backgroundColor: '#dcbaab' },
  freqText: { fontSize: 16, color: '#2d3142' },
  freqTextActive: { color: '#2d3142' },
  deliveryLabel: { fontSize: 18, color: '#717182', marginBottom: 10 },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  deliveryText: { fontSize: 20, color: '#2d3142' },
  toggle: { width: 64, height: 32, borderRadius: 20, borderWidth: 2.556, borderColor: '#000', justifyContent: 'center' },
  toggleOn: { backgroundColor: '#9eae76' },
  toggleOff: { backgroundColor: '#ccc' },
  knob: { width: 20, height: 20, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1.917, borderColor: '#000', position: 'absolute', top: 6 },
  knobLeft: { left: 4 },
  knobRight: { right: 4 },
  topicsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  topicCard: { width: '48%', marginBottom: 10, borderWidth: 1.917, borderColor: '#000', borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 0, shadowOffset: { width: 3, height: 3 } },
  topicActive: { backgroundColor: '#dcbaab' },
  topicImage: { width: 50, height: 50, marginBottom: 6 },
  topicLabel: { fontSize: 13, color: '#2d3142', textAlign: 'center' },
  scrollHint: { fontSize: 14, color: '#717182', textAlign: 'right', marginTop: 4 },
  nextWrap: { alignItems: 'center', marginTop: 10 },
  topicDisabled: { opacity: 0.5 },
  nextButton: { width: 128, height: 57, backgroundColor: '#9ea8ca', borderRadius: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 2.556, borderColor: '#000' },
  nextOverlay: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: 50, borderWidth: 2.556, borderColor: '#000', shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0 },
  nextText: { color: '#fff', fontSize: 20 },
});


