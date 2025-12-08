import React, {useState} from 'react';
import {View, Text, ScrollView, TouchableOpacity, Image} from 'react-native';
import {Sidebar} from '../components/Sidebar';
import {BIRDS, Bird} from '../constants/birds';
import {homeStyles} from '../styles/homeStyles';

interface AllBirdsScreenProps {
  userName?: string;
  parrotName?: string;
  onSelectBird: (bird: Bird) => void;
  onNavigateToHome?: () => void;
  onNavigateToSettings?: (tab?: 'profile' | 'topics' | 'notifications') => void;
  onNavigateToHistory?: () => void;
}

export const AllBirdsScreen: React.FC<AllBirdsScreenProps> = ({
  userName = 'Nicole',
  parrotName = 'Polly',
  onSelectBird,
  onNavigateToHome,
  onNavigateToSettings,
  onNavigateToHistory,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const polly = BIRDS.find(b => b.id === 'polly')!;
  const dynamicPolly: Bird = {
    ...polly,
    name: `${parrotName} the Parrot`,
    agentName: `${parrotName} the Parrot`,
    welcomeMessage: polly.welcomeMessage,
  };

  const handleNavigate = (screen: 'home' | 'chat' | 'history' | 'settings') => {
    if (screen === 'home' && onNavigateToHome) {
      onNavigateToHome();
    } else if (screen === 'settings' && onNavigateToSettings) {
      onNavigateToSettings();
    } else if (screen === 'history' && onNavigateToHistory) {
      onNavigateToHistory();
    }
    // Chat navigation is handled by tapping on a bird card
  };

  return (
    <View style={homeStyles.container}>
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        userName={userName}
        currentScreen="home"
        onNavigate={handleNavigate}
      />
      {/* Header */}
      <View style={homeStyles.headerContainer}>
        <View style={homeStyles.headerLeft}>
          <TouchableOpacity
            style={homeStyles.headerButton}
            onPress={() => onNavigateToHome?.()}>
            <Image
              source={require('../assets/back.png')}
              style={homeStyles.headerButtonImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
        <Text style={homeStyles.headerTitle}>All Birds</Text>
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
        <Text style={homeStyles.sectionTitle}>Choose a bird to start chatting:</Text>
        <View style={homeStyles.sectionDivider} />
        <View style={homeStyles.birdGrid}>
          {BIRDS.map(bird => {
            const displayBird = bird.id === 'polly' ? dynamicPolly : bird;
            return (
              <TouchableOpacity
                key={displayBird.id}
                style={homeStyles.birdCard}
                onPress={() => onSelectBird(displayBird)}
                activeOpacity={0.8}>
                <View style={homeStyles.birdImageContainer}>
                  <Image
                    source={displayBird.image}
                    resizeMode="cover"
                    style={homeStyles.birdImage}
                  />
                </View>
                <Text style={homeStyles.birdName}>{displayBird.name}</Text>
                <Text style={homeStyles.birdCategory}>{displayBird.category}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};
