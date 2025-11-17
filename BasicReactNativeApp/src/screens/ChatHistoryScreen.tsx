import React, {useState, useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import {Sidebar} from '../components/Sidebar';
import {BIRDS, BIRD_IMAGE_MAP, BIRD_IMAGE_SHIFTS} from '../constants/birds';
import {chatHistoryStyles} from '../styles/chatHistoryStyles';

interface ChatHistoryScreenProps {
  userName?: string;
  onNavigateToHome?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToChat?: () => void;
}

interface ChatHistoryEntry {
  date: Date;
  birdIds: string[];
}

export const ChatHistoryScreen: React.FC<ChatHistoryScreenProps> = ({
  userName = 'Nicole',
  onNavigateToHome,
  onNavigateToSettings,
  onNavigateToChat,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Generate dummy data: 5 days from current date, 3-5 random birds per day
  // TODO: Replace with actual chat history data
  const chatHistory: ChatHistoryEntry[] = useMemo(() => {
    const entries: ChatHistoryEntry[] = [];
    const today = new Date();
    
    for (let i = 0; i < 5; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Random number of birds between 3 and 5
      const numBirds = Math.floor(Math.random() * 3) + 3;
      
      // Get random bird IDs (excluding polly, or including it randomly)
      const availableBirds = BIRDS.filter(b => b.id !== 'polly');
      const selectedBirds: string[] = [];
      
      // Randomly decide if Polly should be included (30% chance)
      if (Math.random() < 0.3) {
        selectedBirds.push('polly');
      }
      
      // Shuffle and pick random birds
      const shuffled = [...availableBirds].sort(() => Math.random() - 0.5);
      const remaining = numBirds - selectedBirds.length;
      
      for (let j = 0; j < remaining && j < shuffled.length; j++) {
        selectedBirds.push(shuffled[j].id);
      }
      
      entries.push({
        date,
        birdIds: selectedBirds,
      });
    }
    
    return entries;
  }, []);

  const formatDate = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      };
      return date.toLocaleDateString('en-US', options);
    }
  };

  const handleNavigate = (screen: 'home' | 'chat' | 'history' | 'settings') => {
    if (screen === 'home' && onNavigateToHome) {
      onNavigateToHome();
    } else if (screen === 'settings' && onNavigateToSettings) {
      onNavigateToSettings();
    } else if (screen === 'chat' && onNavigateToChat) {
      onNavigateToChat();
    }
    // History is already the current screen
  };

  const handleCardPress = () => {
    // Visual feedback only for now
    // TODO: Navigate to specific chat history
  };

  return (
    <View style={chatHistoryStyles.container}>
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        userName={userName}
        currentScreen="history"
        onNavigate={handleNavigate}
      />
      {/* Header */}
      <View style={chatHistoryStyles.headerContainer}>
        <View style={chatHistoryStyles.headerLeft}>
          {/* Empty space for alignment */}
        </View>
        <Text style={chatHistoryStyles.headerTitle}>Chat History</Text>
        <View style={chatHistoryStyles.headerRight}>
          <TouchableOpacity
            style={chatHistoryStyles.headerButton}
            onPress={() => setIsSidebarOpen(true)}>
            <Image
              source={require('../assets/icons8-menu-100.png')}
              style={chatHistoryStyles.headerButtonImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={chatHistoryStyles.scrollView}
        contentContainerStyle={chatHistoryStyles.scrollContent}>
        {chatHistory.length > 0 ? (
          chatHistory.map((entry, index) => (
            <TouchableOpacity
              key={index}
              style={chatHistoryStyles.card}
              onPress={handleCardPress}
              activeOpacity={0.7}>
              <View style={chatHistoryStyles.cardContent}>
                <Text style={chatHistoryStyles.dateText}>
                  {formatDate(entry.date)}
                </Text>
                <View style={chatHistoryStyles.avatarRow}>
                  {entry.birdIds.map(birdId => {
                    const bird = BIRDS.find(b => b.id === birdId);
                    if (!bird) return null;
                    
                    const imageShift = BIRD_IMAGE_SHIFTS[bird.agentName || bird.name] || {
                      left: 5,
                      top: 2,
                    };
                    
                    return (
                      <View
                        key={birdId}
                        style={chatHistoryStyles.avatarContainer}>
                        <Image
                          source={bird.image}
                          resizeMode="cover"
                          style={[
                            chatHistoryStyles.avatarImage,
                            {
                              left: imageShift.left,
                              top: imageShift.top,
                            },
                          ]}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
              <View style={chatHistoryStyles.arrowContainer}>
                <Image
                  source={require('../assets/back.png')}
                  style={chatHistoryStyles.arrowImage}
                  resizeMode="contain"
                />
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={chatHistoryStyles.emptyStateContainer}>
            <Text style={chatHistoryStyles.emptyStateText}>
              Your previous conversations will appear here!
            </Text>
            <TouchableOpacity
              style={chatHistoryStyles.emptyStateButton}
              onPress={() => onNavigateToChat?.()}
              activeOpacity={0.7}>
              <Text style={chatHistoryStyles.emptyStateButtonText}>
                Start Chatting
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

