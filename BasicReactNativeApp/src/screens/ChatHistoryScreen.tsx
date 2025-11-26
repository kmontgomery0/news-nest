import React, {useState, useMemo, useEffect} from 'react';
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
  email?: string;
  onNavigateToHome?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToChat?: () => void;
}

interface ChatHistoryEntry {
  id: string;
  title: string;
  birds: string[];
  updated_at?: string;
  created_at?: string;
}
import {getChatHistory} from '../services/api';

export const ChatHistoryScreen: React.FC<ChatHistoryScreenProps> = ({
  userName = 'Nicole',
  email = '',
  onNavigateToHome,
  onNavigateToSettings,
  onNavigateToChat,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!email) return;
      try {
        const data = await getChatHistory(email);
        const sessions = (data.sessions || []).map(s => ({
          id: s.id,
          title: s.title,
          birds: Array.isArray(s.birds) ? s.birds : [],
          updated_at: s.updated_at,
          created_at: s.created_at,
        })) as ChatHistoryEntry[];
        setChatHistory(sessions);
      } catch (e) {
        console.warn('Failed to load chat history', e);
      }
    };
    fetchHistory();
  }, [email]);

  const formatDate = (iso?: string): string => {
    if (!iso) return '';
    const date = new Date(iso);
    return date.toLocaleString();
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
          chatHistory.map((entry) => (
            <TouchableOpacity
              key={entry.id}
              style={chatHistoryStyles.card}
              onPress={handleCardPress}
              activeOpacity={0.7}>
              <View style={chatHistoryStyles.cardContent}>
                <Text style={chatHistoryStyles.dateText}>
                  {entry.title || 'Conversation'}
                </Text>
                <View style={chatHistoryStyles.avatarRow}>
                  {entry.birds.map(birdId => {
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
                {!!entry.updated_at && (
                  <Text style={[chatHistoryStyles.dateText, { fontSize: 14, opacity: 0.7, marginTop: 8 }]}>
                    {formatDate(entry.updated_at)}
                  </Text>
                )}
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

