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
import {Bird, BIRDS} from './src/constants/birds';
import {background_cream_color} from './src/styles/colors';

function App(): JSX.Element {
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
        {showSettings ? (
          <SettingsScreen
            userName={userName}
            parrotName={parrotName}
            selectedBirdIds={selectedBirdIds}
            initialTab={settingsInitialTab}
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
