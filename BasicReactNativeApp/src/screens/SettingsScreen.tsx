import React, {useState, useEffect, useRef} from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import {Sidebar} from '../components/Sidebar';
import {ProfileTab} from '../components/settings/ProfileTab';
import {TopicsTab} from '../components/settings/TopicsTab';
import {NotificationsTab} from '../components/settings/NotificationsTab';
import {settingsStyles} from '../styles/settingsStyles';
import { getUserPreferences, saveUserPreferences } from '../services/api';

interface SettingsScreenProps {
  name?: string;
  userName?: string;
  parrotName?: string;
  selectedBirdIds?: string[];
  initialTry?: string;
  initialTab?: 'profile' | 'topics' | 'notifications';
  email?: string;
  onNavigateToHome?: () => void;
  onNavigateToHistory?: () => void;
  onSaveProfile?: (name: string, parrotName: string) => void;
  onSaveNests?: (birdIds: string[]) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  userName = 'Nicole',
  parrotName = 'Polly',
  selectedBirdIds: propSingleBirdIds = ['flynn', 'pixel', 'cato'],
  initialTab = 'profile',
  email: propEmail = '',
  onNavigateToHome,
  onNavigateToHistory,
  onSaveProfile,
  onSaveNests,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'topics' | 'notifications'>(initialTab);
  const [showSaved, setShowSaved] = useState(false);
  const hideSavedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update active tab if parent changes it
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const [name, setName] = useState(userName);
  const [email, setEmail] = useState(propEmail);
  const [password, setPassword] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [parrotNameState, setParrotNameState] = useState(parrotName);

  // Keep local name/parrotName in sync with props
  useEffect(() => {
    setName(userName);
    setParrotNameState(parrotName);
  }, [userName, parrotName]);

  const handleSaveProfile = async () => {
    try {
      if (onSaveProfile) {
        onSaveProfile(name, parrotNameState);
      }
      const { saveUserProfile } = await import('../services/api');
      await saveUserProfile(email, name, password || undefined);
      setPassword('');
      // Show confirmation
      if (hideSavedTimeoutRef.current) {
        clearTimeout(hideSavedTimeoutRef.current);
      }
      setShowSaved(true);
      hideSavedTimeoutRef.current = setTimeout(() => setShowSaved(false), 1500);
    } catch (e) {
      console.warn('Failed to save profile', e);
    }
  };

  const [selectedBirdIds, setSelectedBirdIds] = useState<string[]>(propSingleBirdIds);

  // sync incoming selected bird ids if parent changes
  useEffect(() => {
    setSelectedBirdIds(propSingleBirdIds);
  }, [propSingleBirdIds]);

  const [selectedTimes, setSelectedTimes] = useState<string[]>(['morning']);
  const [frequency, setFrequency] = useState('Three times a day');
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailSummaries, setEmailSummaries] = useState(true);
  const [dontPersonalize, setDontPersonalize] = useState(false);
  const [allowChatHistory, setAllowChatHistory] = useState(true);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);

  const timeOptions = [
    { key: 'morning', label: 'Morning (9AM)' },
    { key: 'afternoon', label: 'Afternoon (1PM)' },
    { key: 'evening', label: 'Evening (5PM)' },
    { key: 'night', label: 'Night (9PM)' },
  ];

  const frequencyOptions = [
    'Once a day',
    'Twice a day',
    'Three times a day',
    'Four times a day',
    'Custom',
  ];

  // Prevent saving while hydrating from backend
  const prefsHydratedRef = useRef(false);

  // Load preferences from backend to populate settings
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        if (!email) return;
        const prefs = await getUserPreferences(email);
        if (Array.isArray(prefs?.times) && prefs.times.length > 0) {
          const allowed = new Set(timeOptions.map(t => t.key));
          const keys = (prefs.times as string[]).map(s => String(s).toLowerCase()).filter(k => allowed.has(k));
          if (keys.length) setSelectedTimes(keys);
        }
        if (typeof prefs?.frequency === 'string' && prefs.frequency.length > 0) {
          const f = prefs.frequency.toLowerCase();
          const keyToFreq: Record<string, string> = {
            'once': 'Once a day',
            'twice': 'Twice a day',
            'thrice': 'Three times a day',
            'three': 'Three times a day',
            'four': 'Four times a day',
            'custom': 'Custom',
          };
          const mapped = keyToFreq[f] || prefs.frequency;
          if (frequencyOptions.includes(mapped)) setFrequency(mapped);
        }
        if (typeof prefs?.push_notifications === 'boolean') setPushNotifications(prefs.push_notifications);
        if (typeof prefs?.email_summaries === 'boolean') setEmailSummaries(prefs.email_summaries);
        if (typeof prefs?.parrot_name === 'string' && prefs.parrot_name.length > 0) setParrotNameState(prefs.parrot_name);
        if (Array.isArray(prefs?.topics) && prefs.topics.length > 0) {
          const topicToBird: Record<string, string> = {
            'sports': 'flynn',
            'technology': 'pixel',
            'politics': 'cato',
            'entertainment': 'pizzazz',
            'business': 'edwin',
            'crime-legal': 'credo',
            'science-environment': 'gaia',
            'feel-good': 'happy',
            'history-trends': 'omni',
          };
          const birds = (prefs.topics as string[]).map(t => topicToBird[t]).filter(Boolean) as string[];
          if (birds.length) setSelectedBirdIds(birds);
        }
      } catch (e) {
        console.warn('Failed to load preferences', e);
      } finally {
        // mark hydration complete after state updates settle
        setTimeout(() => { prefsHydratedRef.current = true; }, 0);
      }
    };
    loadPrefs();
  }, [email]);

  // Cleanup toast timer on unmount
  useEffect(() => {
    return () => {
      if (hideSavedTimeoutRef.current) {
        clearTimeout(hideSavedTimeoutRef.current);
      }
    };
  }, []);

  // Map bird ids to topics
  const birdIdToTopic: Record<string, string> = {
    'flynn': 'sports',
    'pixel': 'technology',
    'cato': 'politics',
    'pizzazz': 'entertainment',
    'edwin': 'business',
    'credo': 'crime-legal',
    'gaia': 'science-environment',
    'happy': 'feel-good',
    'omni': 'history-trends',
  };

  const persistPreferences = async (partial?: {
    parrot_name?: string;
    topics?: string[];
    push_notifications?: boolean;
    email_summaries?: boolean;
    times?: string[];
    frequency?: string;
  }) => {
    if (!email) return;
    try {
      await saveUserPreferences({
        email,
        parrot_name: partial?.parrot_name ?? parrotNameState,
        topics: partial?.topics ?? selectedBirdIds.map(id => birdIdToTopic[id]).filter(Boolean),
        push_notifications: partial?.push_notifications ?? pushNotifications,
        email_summaries: partial?.email_summaries ?? emailSummaries,
        times: partial?.times ?? selectedTimes,
        frequency: partial?.frequency ?? frequency,
      });
      // Show confirmation
      if (hideSavedTimeoutRef.current) {
        clearTimeout(hideSavedTimeoutRef.current);
      }
      setShowSaved(true);
      hideSavedTimeoutRef.current = setTimeout(() => setShowSaved(false), 1500);
    } catch (e) {
      console.warn('Failed to save preferences', e);
    }
  };

  const handleBirdToggle = (birdId: string) => {
    if (selectedBirdIds.includes(birdId)) {
      setSelectedBirdIds(selectedBirdIds.filter(id => id !== birdId));
    } else {
      setSelectedBirdIds([...selectedBirdIds, birdId]);
    }
  };

  const handleSaveParrotName = () => {
    if (onSaveProfile) {
      onSaveProfile(name, parrotNameState);
    }
  };

  // Save topics when changed (after hydration)
  useEffect(() => {
    if (!prefsHydratedRef.current) return;
  }, [selectedBirdIds]);

  const handleToggleTime = (timeKey: string) => {
    setSelectedTimes(prev => {
      const next = prev.includes(timeKey) ? prev.filter(k => k !== timeKey) : [...prev, timeKey];
      return next;
    });
  };

  const handleFrequencySelect = (freq: string) => {
    setFrequency(freq);
    setShowTimeDropdown(false);
  };

  const handleTimeDropdownToggle = () => {
    setShowTimeDropdown(!showTimeDropdown);
    setShowFrequencyDropdown(false);
  };

  const handleFrequencyDropdownToggle = () => {
    setShowFrequencyDropdown(!showFrequencyDropdown);
    setShowTimeDropdown(false);
  };

  // Save toggle changes after hydration
  useEffect(() => {
    if (!prefsHydratedRef.current) return;
  }, [pushNotifications]);

  useEffect(() => {
    if (!prefsHydratedRef.current) return;
  }, [emailSummaries]);

  const handleNavigate = (screen: 'home' | 'chat' | 'history' | 'settings') => {
    if (screen === 'home' && onNavigateToHome) {
      onNavigateToHome();
    } else if (screen === 'history' && onNavigateToHistory) {
      onNavigateToHistory();
    }
    // Close dropdowns on any navigation
    setShowFrequencyDropdown(false);
    setShowTimeDropdown(false);
  };

  return (
    <View style={settingsStyles.container}>
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        userName={name}
        currentScreen="settings"
        onNavigate={handleNavigate}
      />
      {/* Header */}
      <View style={settingsStyles.headerContainer}>
        <View style={settingsStyles.headerLeft} />
        <Text style={settingsStyles.headerTitle}>Settings</Text>
        <View style={settingsStyles.headerRight}>
          <TouchableOpacity
            style={settingsStyles.headerButton}
            onPress={() => setIsSidebarOpen(true)}>
            <Image
              source={require('../assets/icons8-menu-100.png')}
              style={settingsStyles.headerButtonImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Saved toast */}
      {showSaved && (
        <View style={[settingsStyles.saveButton, {alignSelf: 'center', marginTop: 8, marginBottom: 4}]}>
          <Text style={settingsStyles.saveButtonText}>Saved!</Text>
        </View>
      )}

      {/* Tab Navigation */}
      <View style={settingsStyles.tabBar}>
        <TouchableOpacity
          style={[
            settingsStyles.tabButton,
            activeTab === 'profile' && settingsStyles.tabButtonActive,
            {borderLeftWidth: 1},
          ]}
          onPress={() => setActiveTab('profile')}>
          <Text
            style={[
              settingsStyles.tabButtonText,
              activeTab === 'profile' && settingsStyles.tabButtonTextActive,
            ]}>
            Profile
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            settingsStyles.tabButton,
            activeTab === 'topics' && settingsStyles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('topics')}>
                <Text
                  style={[
                    settingsStyles.tabButtonText,
                    activeTab === 'topics' && settingsStyles.tabButtonTextActive,
                  ]}>
                  My Nests
                </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            settingsStyles.tabButton,
            activeTab === 'notifications' && settingsStyles.tabButtonActive,
            {borderRightWidth: 1},
          ]}
          onPress={() => setActiveTab('notifications')}>
          <Text
            style={[
              settingsStyles.tabButtonText,
              activeTab === 'notifications' && settingsStyles.tabButtonTextActive,
            ]}>
            Notifications
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={settingsStyles.scrollView}
        contentContainerStyle={settingsStyles.scrollContent}
        onScrollBeginDrag={() => {
          setShowTimeDropdown(false);
          setShowFrequencyDropdown(false);
        }}>
        {activeTab === 'profile' && (
          <ProfileTab
            name={name}
            email={email}
            password={password}
            day={day}
            month={month}
            year={year}
            onNameChange={setName}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onDayChange={setDay}
            onMonthChange={setMonth}
            onYearChange={setYear}
            onSave={handleSaveProfile}
          />
        )}
        {activeTab === 'topics' && (
          <TopicsTab
            selectedBirdIds={selectedBirdIds}
            onBirdToggle={handleBirdToggle}
            parrotName={parrotNameState}
            onParrotNameChange={setParrotNameState}
            onSaveParrotName={handleSaveProfile}
            onSave={() => {
              if (!prefsHydratedRef.current) return;
              (async () => {
                await persistPreferences({ topics: selectedBirdIds.map(id => birdIdToTopic[id]).filter(Boolean) });
                // Update app-level state only after successful save
                if (onSaveNests) onSaveNests(selectedBirdIds);
              })();
            }}
          />
        )}
        {activeTab === 'notifications' && (
          <NotificationsTab
            selectedTimes={selectedTimes}
            frequency={frequency}
            pushNotifications={pushNotifications}
            emailSummaries={emailSummaries}
            dontPersonalize={dontPersonalize}
            allowChatHistory={allowChatHistory}
            showTimeDropdown={showTimeDropdown}
            showFrequencyDropdown={showFrequencyDropdown}
            timeOptions={timeOptions}
            frequencyOptions={frequencyOptions}
            onTimeDropdownToggle={handleTimeDropdownToggle}
            onFrequencyDropdownToggle={handleFrequencyDropdownToggle}
            onToggleTime={handleToggleTime}
            onFrequencySelect={handleFrequencySelect}
            onPushNotificationsChange={setPushNotifications}
            onEmailSummariesChange={setEmailSummaries}
            onDontPersonalizeChange={setDontPersonalize}
            onAllowChatHistoryChange={setAllowChatHistory}
            onSave={() => {
              if (!prefsHydratedRef.current) return;
              persistPreferences();
            }}
          />
        )}
      </ScrollView>
    </View>
  );
};
