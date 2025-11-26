import React, {useState, useEffect} from 'react';
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
import { saveUserPreferences } from '../services/api';

interface SettingsScreenProps {
  userName?: string;
  parrotName?: string;
  selectedBirdIds?: string[];
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
  selectedBirdIds: propSelectedBirdIds = ['flynn', 'pixel', 'cato'],
  initialTab = 'profile',
  email: propEmail = '',
  onNavigateToHome,
  onNavigateToHistory,
  onSaveProfile,
  onSaveNests,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'topics' | 'notifications'>(initialTab);
  
  // Update active tab when initialTab prop changes
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
  
  // Update local state when props change
  useEffect(() => {
    setName(userName);
    setParrotNameState(parrotName);
  }, [userName, parrotName]);
  
  const handleSaveProfile = async () => {
    try {
      if (onSaveProfile) {
        onSaveProfile(name, parrotNameState);
      }
      // Persist to backend profile endpoint
      const { saveUserProfile } = await import('../services/api');
      await saveUserProfile(email, name, password || undefined);
      // Clear password field after save
      setPassword('');
    } catch (e) {
      console.warn('Failed to save profile', e);
    }
  };

  const [selectedBirdIds, setSelectedBirdIds] = useState<string[]>(propSelectedBirdIds);
  
  // Update local state when props change
  useEffect(() => {
    setSelectedBirdIds(propSelectedBirdIds);
  }, [propSelectedBirdIds]);
  const [selectedTime, setSelectedTime] = useState('Morning (9AM)');
  const [frequency, setFrequency] = useState('Thrice a day');
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailSummaries, setEmailSummaries] = useState(true);
  const [dontPersonalize, setDontPersonalize] = useState(false);
  const [allowChatHistory, setAllowChatHistory] = useState(true);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);

  const timeOptions = [
    'Morning (9AM)',
    'Afternoon (1PM)',
    'Evening (5PM)',
    'Night (9PM)',
    'Custom',
  ];

  const frequencyOptions = [
    'Once a day',
    'Twice a day',
    'Three times a day',
    'Four times a day',
    'Custom',
  ];

  // Map bird ids to topics used in preferences
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

  // Persist preferences helper
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
        times: partial?.times ?? [selectedTime],
        frequency: partial?.frequency ?? frequency,
      });
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
    // Save the parrot name
    if (onSaveProfile) {
      onSaveProfile(name, parrotNameState);
    }
    // Also persist as preference (parrot_name)
    persistPreferences({ parrot_name: parrotNameState });
  };

  // Auto-save nests when they change
  useEffect(() => {
    if (onSaveNests) {
      onSaveNests(selectedBirdIds);
    }
    // Persist topics to preferences
    persistPreferences({
      topics: selectedBirdIds.map(id => birdIdToTopic[id]).filter(Boolean),
    });
  }, [selectedBirdIds, onSaveNests]);

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setShowTimeDropdown(false);
    // Persist selected time
    persistPreferences({ times: [time] });
  };

  const handleFrequencySelect = (freq: string) => {
    setFrequency(freq);
    setShowFrequencyDropdown(false);
    // Persist selected frequency
    persistPreferences({ frequency: freq });
  };

  const handleTimeDropdownToggle = () => {
    setShowTimeDropdown(!showTimeDropdown);
    setShowFrequencyDropdown(false);
  };

  const handleFrequencyDropdownToggle = () => {
    setShowFrequencyDropdown(!showFrequencyDropdown);
    setShowTimeDropdown(false);
  };

  // Persist notification toggles
  useEffect(() => {
    persistPreferences({ push_notifications: pushNotifications });
  }, [pushNotifications]);

  useEffect(() => {
    persistPreferences({ email_summaries: emailSummaries });
  }, [emailSummaries]);

  const handleNavigate = (screen: 'home' | 'chat' | 'history' | 'settings') => {
    if (screen === 'home' && onNavigateToHome) {
      onNavigateToHome();
    } else if (screen === 'history' && onNavigateToHistory) {
      onNavigateToHistory();
    }
  };

  return (
    <View style={settingsStyles.container}>
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        userName={userName}
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
            onSaveParrotName={handleSaveParrotName}
          />
        )}
        {activeTab === 'notifications' && (
          <NotificationsTab
            selectedTime={selectedTime}
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
            onTimeSelect={handleTimeSelect}
            onFrequencySelect={handleFrequencySelect}
            onPushNotificationsChange={setPushNotifications}
            onEmailSummariesChange={setEmailSummaries}
            onDontPersonalizeChange={setDontPersonalize}
            onAllowChatHistoryChange={setAllowChatHistory}
          />
        )}
      </ScrollView>
    </View>
  );
};
