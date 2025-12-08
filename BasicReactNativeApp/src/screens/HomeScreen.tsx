import React, {useState} from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import {homeStyles} from '../styles/homeStyles';
import {BIRDS, Bird} from '../constants/birds';
import {Sidebar} from '../components/Sidebar';

interface HomeScreenProps {
  onSelectBird: (bird: Bird) => void;
  userName?: string;
  parrotName?: string;
  selectedBirdIds?: string[];
  onNavigateToChat?: () => void;
  onNavigateToSettings?: (tab?: 'profile' | 'topics' | 'notifications') => void;
  onNavigateToHistory?: () => void;
  onNavigateToAllBirds?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectBird,
  userName = 'Nicole',
  parrotName = 'Polly',
  selectedBirdIds = ['flynn', 'pixel', 'cato'],
  onNavigateToChat,
  onNavigateToSettings,
  onNavigateToHistory,
  onNavigateToAllBirds,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const polly = BIRDS.find(b => b.id === 'polly')!;
  // Only show selected birds (filter by selectedBirdIds)
  const otherBirds = BIRDS.filter(b => b.id !== 'polly' && selectedBirdIds.includes(b.id));
  
  // Create a dynamic Polly bird with the custom name
  const dynamicPolly = {
    ...polly,
    name: `${parrotName} the Parrot`,
    agentName: `${parrotName} the Parrot`,
    welcomeMessage: `Hi! I'm ${parrotName}, your friendly news anchor. Ready for your daily news feed? Ask me about today's top headlines, and I'll help you stay informed!`,
  };

  const handleNavigate = (screen: 'home' | 'chat' | 'history' | 'settings') => {
    if (screen === 'chat' && onNavigateToChat) {
      onNavigateToChat();
    } else if (screen === 'settings' && onNavigateToSettings) {
      onNavigateToSettings();
    } else if (screen === 'history' && onNavigateToHistory) {
      onNavigateToHistory();
    }
    // Home is already the current screen, so no action needed
  };

  return (
    <View style={homeStyles.container}>
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        userName={userName}
        onNavigate={handleNavigate}
      />
      {/* Header with title and menu button */}
      <View style={homeStyles.headerContainer}>
        <View style={homeStyles.headerLeft} />
        <Text style={homeStyles.headerTitle}>{userName}'s News Nest</Text>
        <View style={homeStyles.headerRight}>
          <TouchableOpacity
            style={homeStyles.headerButton}
            onPress={() => setIsSidebarOpen(true)}>
            <Image
              source={require('../assets/icons8-menu-100.png')}
              style={homeStyles.headerButtonImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={homeStyles.scrollContent}
        showsVerticalScrollIndicator={true}>
        {/* Polly the Parrot Card */}
        <TouchableOpacity
          style={homeStyles.pollyCard}
          onPress={() => onSelectBird(dynamicPolly)}
          activeOpacity={0.8}>
          <View style={homeStyles.pollyImageContainer}>
            <Image
              source={polly.image}
              resizeMode="cover"
              style={homeStyles.pollyImage}
            />
          </View>
          <Text style={homeStyles.pollyName}>{dynamicPolly.name}</Text>
          <View style={homeStyles.pollySpeechBubble}>
            <Text style={homeStyles.pollySpeechText}>
              Hi {userName}! Ready for your daily news feed? Chirp!
            </Text>
          </View>
          <Text style={homeStyles.pollyInstruction}>
            Tap on {parrotName} to start a chat!
          </Text>
        </TouchableOpacity>

        {/* Section Title */}
        <Text style={homeStyles.sectionTitle}>Visit Your Favorite Nests:</Text>
        <View style={homeStyles.sectionDivider} />

        {/* Other Birds Grid or Empty State */}
        {otherBirds.length > 0 ? (
          <View style={homeStyles.birdGrid}>
            {otherBirds.map(bird => (
              <TouchableOpacity
                key={bird.id}
                style={homeStyles.birdCard}
                onPress={() => onSelectBird(bird)}
                activeOpacity={0.8}>
                <View style={homeStyles.birdImageContainer}>
                  <Image
                    source={bird.image}
                    resizeMode="cover"
                    style={homeStyles.birdImage}
                  />
                </View>
                <Text style={homeStyles.birdName}>{bird.name}</Text>
                <Text style={homeStyles.birdCategory}>{bird.category}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={homeStyles.emptyStateContainer}>
            <Text style={homeStyles.emptyStateText}>
              Add your favorite nests in Settings!
            </Text>
            <TouchableOpacity
              style={homeStyles.emptyStateButton}
              onPress={() => onNavigateToSettings?.('topics')}
              activeOpacity={0.7}>
              <Text style={homeStyles.emptyStateButtonText}>Go to Settings</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Link to All Birds page */}
        {onNavigateToAllBirds && (
          <TouchableOpacity
            onPress={onNavigateToAllBirds}
            activeOpacity={0.7}
            style={homeStyles.allBirdsLinkContainer}>
            <Text style={homeStyles.allBirdsLinkText}>See all birds</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

