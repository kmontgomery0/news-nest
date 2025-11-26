import React, {useState} from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import {Header} from './src/components/Header';
import {ConversationScreen} from './src/screens/ConversationScreen';
import {HomeScreen} from './src/screens/HomeScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';
import {ChatHistoryScreen} from './src/screens/ChatHistoryScreen';
import {EnterScreen} from './src/screens/EnterScreen';
import {LoginScreen} from './src/screens/LoginScreen';
import {OnboardingScreen} from './src/screens/OnboardingScreen';
import {OnboardingScreen2} from './src/screens/OnboardingScreen2';
import {registerUser, saveUserPreferences, getUserProfile, getUserPreferences} from './src/services/api';
import {Bird, BIRDS} from './src/constants/birds';
import {background_cream_color} from './src/styles/colors';

function App(): JSX.Element {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showEnter, setShowEnter] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<1 | 2>(1);
  const [onboardingName, setOnboardingName] = useState('');
  const [onboardingEmail, setOnboardingEmail] = useState('');
  const [onboardingPassword, setOnboardingPassword] = useState('');
  const [selectedBird, setSelectedBird] = useState<Bird | null>(null);
  const [showConversation, setShowConversation] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [userName, setUserName] = useState('Nicole');
  const [parrotName, setParrotName] = useState('Polly');
  const [selectedBirdIds, setSelectedBirdIds] = useState<string[]>(['flynn', 'pixel', 'cato']);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'profile' | 'topics' | 'notifications'>('profile');

  const handleSelectBird = (bird: Bird) => {
    setSelectedBird(bird);
    setShowConversation(true);
  };

  const handleBackToHome = () => {
    setShowConversation(false);
    setShowChatHistory(false);
    setSelectedBird(null);
  };

  const handleNavigateToChat = () => {
    const polly = BIRDS.find(b => b.id === 'polly')!;
    // Create dynamic Polly with custom name
    const dynamicPolly = {
      ...polly,
      name: `${parrotName} the Parrot`,
      agentName: `${parrotName} the Parrot`,
      welcomeMessage: `Hi! I'm ${parrotName}, your friendly news anchor. Ready for your daily news feed? Ask me about today's top headlines, and I'll help you stay informed!`,
    };
    setSelectedBird(dynamicPolly);
    setShowConversation(true);
    setShowSettings(false);
    setShowChatHistory(false);
  };

  const handleNavigateToSettings = (tab?: 'profile' | 'topics' | 'notifications') => {
    setShowSettings(true);
    setShowConversation(false);
    setShowChatHistory(false);
    setSelectedBird(null);
    // Store the tab to open in SettingsScreen
    setSettingsInitialTab(tab || 'profile');
  };

  const handleNavigateToHome = () => {
    setShowSettings(false);
    setShowConversation(false);
    setShowChatHistory(false);
    setSelectedBird(null);
    setShowEnter(false);
  };

  const handleNavigateToChatHistory = () => {
    setShowChatHistory(true);
    setShowSettings(false);
    setShowConversation(false);
    setSelectedBird(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
        <View style={styles.content}>
        <Header />
        {showOnboarding ? (
          onboardingStep === 1 ? (
            <OnboardingScreen
              onNext={() => {
                setOnboardingStep(2);
              }}
              onSubmitFirst={(name, email, password) => {
                setOnboardingName(name);
                setOnboardingEmail(email);
                setOnboardingPassword(password);
              }}
            />
          ) : (
            <OnboardingScreen2
              onSubmitPreferences={async (prefs) => {
                try {
                  if (!onboardingEmail) return;
                  // 1) Save preferences
                  await saveUserPreferences({
                    email: onboardingEmail,
                    parrot_name: prefs.parrot_name,
                    times: prefs.times,
                    frequency: prefs.frequency,
                    push_notifications: prefs.push_notifications,
                    email_summaries: prefs.email_summaries,
                    topics: prefs.topics,
                  });
                  // 2) Fetch fresh profile + prefs from backend and hydrate UI state
                  const [profile, freshPrefs] = await Promise.all([
                    getUserProfile(onboardingEmail),
                    getUserPreferences(onboardingEmail),
                  ]);
                  if (profile?.name) setUserName(profile.name);
                  if (freshPrefs?.parrot_name) setParrotName(freshPrefs.parrot_name);
                  if (Array.isArray(freshPrefs?.topics)) {
                    const mapTopicToBird: Record<string, string> = {
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
                    const birds = freshPrefs.topics
                      .map((t: string) => mapTopicToBird[t])
                      .filter((id: string | undefined): id is string => !!id);
                    if (birds.length) setSelectedBirdIds(birds);
                  }
                } catch (e) {
                  console.warn('Saving or hydrating preferences failed', e);
                }
              }}
              onNext={async () => {
                try {
                  await registerUser(onboardingName, onboardingEmail, onboardingPassword);
                  setIsAuthenticated(true);
                  setShowOnboarding(false);
                  setShowEnter(false);
                  setUserName(onboardingName);
                } catch (e: any) {
                  console.warn('Registration failed', e?.message || e);
                }
              }}
            />
          )
        ) : showEnter ? (
          <EnterScreen onGetStarted={() => setShowEnter(false)} />
        ) : !isAuthenticated ? (
          <LoginScreen
            onSignedIn={async (email) => {
              try {
                // Persist email in app state
                setOnboardingEmail(email);
                // Fetch profile and prefs
                const [profile, prefs] = await Promise.all([
                  getUserProfile(email),
                  getUserPreferences(email),
                ]);
                // Update UI state
                if (profile?.name) setUserName(profile.name);
                if (prefs?.parrot_name) setParrotName(prefs.parrot_name);
                if (Array.isArray(prefs?.topics)) {
                  const mapTopicToBird: Record<string, string> = {
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
                  const birds = prefs.topics
                    .map((t: string) => mapTopicToBird[t])
                    .filter((id: string | undefined): id is string => !!id);
                  if (birds.length) setSelectedBirdIds(birds);
                }
                setIsAuthenticated(true);
                // Do not show Enter again after login
                setShowEnter(false);
              } catch (e) {
                console.warn('Failed to load user data', e);
                setIsAuthenticated(true);
                setShowEnter(false);
              }
            }}
            onJoinFlock={() => {
              setShowOnboarding(true);
              setOnboardingStep(1);
            }}
          />
        ) : showSettings ? (
          <SettingsScreen
            userName={userName}
            parrotName={parrotName}
            selectedBirdIds={selectedBirdIds}
            initialTab={settingsInitialTab}
            email={onboardingEmail}
            onNavigateToHome={handleNavigateToHome}
            onNavigateToHistory={handleNavigateToChatHistory}
            onSaveProfile={(name, parrot) => {
              setUserName(name);
              setParrotName(parrot);
            }}
            onSaveNests={(birdIds: string[]) => {
              setSelectedBirdIds(birdIds);
            }}
          />
        ) : showChatHistory ? (
          <ChatHistoryScreen
            userName={userName}
            email={onboardingEmail}
            onNavigateToHome={handleNavigateToHome}
            onNavigateToSettings={handleNavigateToSettings}
            onNavigateToChat={handleNavigateToChat}
          />
        ) : showConversation && selectedBird ? (
          <ConversationScreen
            selectedBird={{
              name: selectedBird.name,
              welcomeMessage: selectedBird.welcomeMessage,
              image: selectedBird.image,
              agentName: selectedBird.agentName,
            }}
            userName={userName}
            parrotName={parrotName}
            email={onboardingEmail}
            onBack={handleBackToHome}
            onNavigateToHome={handleBackToHome}
            onNavigateToSettings={handleNavigateToSettings}
            onNavigateToHistory={handleNavigateToChatHistory}
          />
        ) : (
          <HomeScreen
            userName={userName}
            parrotName={parrotName}
            selectedBirdIds={selectedBirdIds}
            onSelectBird={handleSelectBird}
            onNavigateToChat={handleNavigateToChat}
            onNavigateToSettings={handleNavigateToSettings}
            onNavigateToHistory={handleNavigateToChatHistory}
          />
        )}
        </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: background_cream_color,
  },
  content: {
    flex: 1,
  },
});

export default App;
