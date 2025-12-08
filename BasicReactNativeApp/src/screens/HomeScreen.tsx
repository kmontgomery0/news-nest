import React, {useState, useEffect, useRef} from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  Platform,
} from 'react-native';
import {homeStyles} from '../styles/homeStyles';
import {conversationStyles} from '../styles/conversationStyles';
import {BIRDS, Bird} from '../constants/birds';
import {Sidebar} from '../components/Sidebar';
import {Message} from '../types';

interface HomeScreenProps {
  onSelectBird: (bird: Bird, initialMessage?: Message) => void;
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
  const [inputText, setInputText] = useState('');
  const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0);
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const placeholderIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const polly = BIRDS.find(b => b.id === 'polly')!;
  // Only show selected birds (filter by selectedBirdIds)
  const otherBirds = BIRDS.filter(b => b.id !== 'polly' && selectedBirdIds.includes(b.id));
  
  // Sample queries that cycle through
  const sampleQueries = [
    "Hey Polly, what are the top headlines?",
    "What is happening with the economy?",
    "Tell me about today's sports news",
    "What's new in technology?",
    "What are the latest political developments?",
    "Share some feel-good news",
  ];
  
  // Create a dynamic Polly bird with the custom name
  const dynamicPolly = {
    ...polly,
    name: `${parrotName} the Parrot`,
    agentName: `${parrotName} the Parrot`,
    welcomeMessage: `Hi! I'm ${parrotName}, your friendly news anchor. Ready for your daily news feed? Ask me about today's top headlines, and I'll help you stay informed!`,
  };
  
  // Typing animation effect
  useEffect(() => {
    // Clear any existing typing interval
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    
    const currentQuery = sampleQueries[currentPlaceholderIndex];
    if (!currentQuery) return;
    
    if (isDeleting) {
      // Delete one character at a time
      typingIntervalRef.current = setInterval(() => {
        setDisplayedPlaceholder((prev) => {
          if (prev.length <= 0) {
            // Finished deleting, move to next query and reset state
            clearInterval(typingIntervalRef.current!);
            typingIntervalRef.current = null;
            setDisplayedPlaceholder(''); // Ensure it's empty before switching
            setTimeout(() => {
              setCurrentPlaceholderIndex((prev) => (prev + 1) % sampleQueries.length);
              setIsDeleting(false);
            }, 50); // Small delay to ensure state is reset
            return '';
          }
          return prev.slice(0, -1);
        });
      }, 30); // Fast deletion speed
    } else {
      // When not deleting, ensure we start from empty if we just switched queries
      // Only type if displayedPlaceholder is empty or matches the current query's start
      const isMatchingQuery = displayedPlaceholder === '' || 
        displayedPlaceholder === currentQuery.slice(0, displayedPlaceholder.length);
      
      if (isMatchingQuery) {
        // Type one character at a time
        typingIntervalRef.current = setInterval(() => {
          setDisplayedPlaceholder((prev) => {
            const targetLength = prev.length + 1;
            if (targetLength > currentQuery.length) {
              // Finished typing, stop and wait before deleting
              clearInterval(typingIntervalRef.current!);
              typingIntervalRef.current = null;
              // Wait 2 seconds then start deleting
              setTimeout(() => {
                setIsDeleting(true);
              }, 2000);
              return prev;
            }
            return currentQuery.slice(0, targetLength);
          });
        }, 50); // Typing speed
      } else {
        // Mismatch - clear and restart
        setDisplayedPlaceholder('');
      }
    }
    
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
    };
  }, [currentPlaceholderIndex, isDeleting, displayedPlaceholder, sampleQueries]);
  
  // Initialize with empty placeholder on mount
  useEffect(() => {
    setDisplayedPlaceholder('');
  }, []);
  
  const handleKeyPress = (e: any) => {
    // On web, detect Enter key press (without Shift) to submit
    if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  const handleSubmit = () => {
    const message = inputText.trim();
    if (!message) return;
    
    // Create initial user message
    const initialMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      text: message,
    };
    
    // Navigate to chat with Polly and the initial message
    onSelectBird(dynamicPolly, initialMessage);
    setInputText('');
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
        <View style={homeStyles.pollyCard}>
          <TouchableOpacity
            onPress={() => onSelectBird(dynamicPolly)}
            activeOpacity={0.8}
            style={{alignItems: 'center', width: '100%'}}>
            <View style={homeStyles.pollyImageContainer}>
              <Image
                source={polly.image}
                resizeMode="cover"
                style={homeStyles.pollyImage}
              />
            </View>
            <Text style={homeStyles.pollyName}>{dynamicPolly.name}</Text>
            <Text style={homeStyles.birdCategory}>{dynamicPolly.category}</Text>
          </TouchableOpacity>
          {/* Chat Input - Same as ConversationScreen */}
          <View style={homeStyles.chatInputContainer}>
            <TextInput
              style={homeStyles.chatTextInput}
              placeholder={displayedPlaceholder}
              placeholderTextColor="#999"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              onSubmitEditing={handleSubmit}
              onKeyPress={handleKeyPress}
              blurOnSubmit={false}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[
                homeStyles.chatSendButton,
                !inputText.trim() && homeStyles.chatSendButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!inputText.trim()}>
              <Image
                source={require('../assets/icons8-up-100.png')}
                style={homeStyles.chatSendButtonImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section Title */}
        <Text style={homeStyles.sectionTitle}>Chat with your favorite birds:</Text>
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

