import React, {useState, useRef, useEffect, useCallback} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
} from 'react-native';
import {Message, ConversationHistoryItem} from '../types';
import {sendMessage, saveChatHistory} from '../services/api';
import {splitIntoParagraphs} from '../utils/textUtils';
import {getInitialChunk, getNextChunk, splitIntoMessageChunks} from '../utils/messageUtils';
import {API_BASE_URL} from '../constants/api';
import {conversationStyles} from '../styles/conversationStyles';
import {text_primary_brown_color} from '../styles/colors';
import {BIRD_IMAGE_MAP, BIRD_IMAGE_SHIFTS, BIRDS} from '../constants/birds';
import {Sidebar} from '../components/Sidebar';
import {NewsArticleCard, Chart, Timeline} from '../components';

interface ConversationScreenProps {
  initialMessage?: Message;
  selectedBird?: {
    name: string;
    welcomeMessage: string;
    image: any;
    agentName?: string;
  };
  userName?: string;
  parrotName?: string;
  email?: string;
  sessionId?: string;
  onBack?: () => void;
  onNavigateToHome?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToHistory?: () => void;
}

export const ConversationScreen: React.FC<ConversationScreenProps> = ({
  initialMessage,
  selectedBird,
  userName = 'Nicole',
  parrotName = 'Polly',
  email,
  sessionId,
  onBack,
  onNavigateToHome,
  onNavigateToSettings,
  onNavigateToHistory,
}) => {
  // Use selected bird's welcome message if provided, otherwise use default with custom parrot name
  const defaultWelcomeMessage = selectedBird
    ? selectedBird.welcomeMessage
    : `Welcome to News Nest! I'm ${parrotName}, your friendly news anchor. Ask me about today's top headlines! Or if you have something in mind to discuss,I'll automatically route your question to the best specialist agent!`;
  
  const defaultAgentName = selectedBird?.agentName || selectedBird?.name || `${parrotName} the Parrot`;

  const [messages, setMessages] = useState<Message[]>(
    initialMessage
      ? [initialMessage]
      : [{
          id: '1',
          type: 'agent',
          text: defaultWelcomeMessage,
          agentName: defaultAgentName,
        }]
  );
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingHistory, setIsSavingHistory] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<{
    id: string;
    agentName: string;
    currentText: string;
    remainingText: string;
  } | null>(null);
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
  const [currentAgent, setCurrentAgent] = useState<string>(defaultAgentName);
  const [routingTo, setRoutingTo] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sessionBirdIds, setSessionBirdIds] = useState<string[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const streamingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageQueueIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inputSlideAnim = useRef(new Animated.Value(100)).current;

  // Format current date as "Nov 16, 2025"
  const formatDate = (): string => {
    const date = new Date();
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  };

  // Get bird image based on agent name
  const getBirdImage = (agentName?: string): any => {
    const name = agentName || currentAgent;
    // Handle custom parrot name - map to Polly's image
    if (name && name.includes('the Parrot') && name !== 'Polly the Parrot') {
      return BIRD_IMAGE_MAP['Polly the Parrot'] || require('../assets/parrot.jpeg');
    }
    return BIRD_IMAGE_MAP[name] || selectedBird?.image || require('../assets/parrot.jpeg');
  };

  // Get bird image shift based on agent name
  const getBirdImageShift = (agentName?: string): {left: number; top: number} => {
    const name = agentName || currentAgent;
    // Handle custom parrot name - use Polly's shift
    if (name && name.includes('the Parrot') && name !== 'Polly the Parrot') {
      return BIRD_IMAGE_SHIFTS['Polly the Parrot'] || {left: 5, top: 2};
    }
    return BIRD_IMAGE_SHIFTS[name] || {left: 5, top: 2};
  };


  // If a sessionId is provided, load the saved chat messages
  useEffect(() => {
    const loadSession = async () => {
      try {
        if (!email || !sessionId) return;
        const { getChatSession } = await import('../services/api');
        const data = await getChatSession(email, sessionId);
        const history = Array.isArray(data?.messages) ? data.messages : [];
        // Persist birds involved in this session for header display
        if (Array.isArray((data as any)?.birds)) {
          const uniq = Array.from(new Set((data as any).birds as string[]));
          setSessionBirdIds(uniq);
        } else {
          setSessionBirdIds([]);
        }
        const loaded: Message[] = [];
        let lastAgentNameLocal: string | undefined = undefined;
        // Helper to parse a saved [ARTICLES] block back into cards
        const parseSavedArticlesBlock = (input: string): { cleaned: string; cards: NonNullable<Message['articleCards']> } => {
          try {
            if (!input) return { cleaned: input, cards: [] };
            const ARTICLES_HEADER = '[ARTICLES]';
            const idx = input.indexOf(ARTICLES_HEADER);
            if (idx === -1) return { cleaned: input, cards: [] };
            const before = input.substring(0, idx).trimEnd();
            const after = input.substring(idx + ARTICLES_HEADER.length);
            // Split lines after header
            const lines = after.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            const cards: NonNullable<Message['articleCards']> = [];
            for (let line of lines) {
              // Expected pattern:
              // "1. Headline — Source [tags: a, b] (url)"
              // Make it robust to missing parts
              const numPrefixMatch = line.match(/^\d+\.\s*(.*)$/);
              const content = numPrefixMatch ? numPrefixMatch[1] : line;
              // Extract URL in parentheses at end
              let url: string | undefined;
              const urlMatch = content.match(/\((https?:\/\/[^)]+)\)\s*$/i);
              if (urlMatch) {
                url = urlMatch[1].trim();
              }
              const contentNoUrl = urlMatch ? content.replace(urlMatch[0], '').trim() : content;
              // Extract tags block [tags: ...]
              let tags: string[] | undefined;
              const tagsMatch = contentNoUrl.match(/\[tags:\s*([^\]]+)\]\s*$/i);
              if (tagsMatch) {
                tags = tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean);
              }
              const contentNoTags = tagsMatch ? contentNoUrl.replace(tagsMatch[0], '').trim() : contentNoUrl;
              // Split headline and source on em dash/— if present
              let headline = contentNoTags;
              let sourceName: string | undefined;
              const dashIdx = contentNoTags.indexOf('—');
              if (dashIdx !== -1) {
                headline = contentNoTags.substring(0, dashIdx).trim();
                sourceName = contentNoTags.substring(dashIdx + 1).trim();
              }
              if (headline) {
                cards.push({
                  headline,
                  sourceName: sourceName || undefined,
                  url: url || undefined,
                  tags: tags && tags.length > 0 ? tags : undefined,
                });
              }
            }
            return { cleaned: before, cards };
          } catch {
            return { cleaned: input, cards: [] };
          }
        };
        history.forEach((h, idx) => {
          const text = Array.isArray(h.parts) ? h.parts.map(p => String(p)).join(' ') : '';
          if (h.role === 'user') {
            loaded.push({
              id: `user-${idx}-${Date.now()}`,
              type: 'user',
              text,
            });
          } else {
            // extract agent name from metadata [Agent: Name]
            const match = text.match(/\[Agent:\s*([^\]]+)\]\s*$/i);
            const agentName = match ? match[1].trim() : undefined;
            const cleanedPre = text.replace(/\s*\[Agent:\s*[^\]]+\]\s*$/i, '').trim();
            const parsed = parseSavedArticlesBlock(cleanedPre);
            const cleaned = parsed.cleaned.trim();
            if (agentName) lastAgentNameLocal = agentName;
            loaded.push({
              id: `agent-${idx}-${Date.now()}`,
              type: 'agent',
              text: cleaned,
              agentName: agentName || lastAgentNameLocal || defaultAgentName,
              articleCards: parsed.cards && parsed.cards.length > 0 ? parsed.cards : undefined,
            });
          }
        });
        if (loaded.length > 0) {
          setMessages(loaded);
          // set current agent if last message is agent
          const last = [...loaded].reverse().find(m => m.type === 'agent');
          if (last?.agentName) setCurrentAgent(last.agentName);
        }
      } catch (e) {
        console.warn('Failed to load chat session', e);
      }
    };
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, sessionId]);

  // Input slide-in animation on mount
  useEffect(() => {
    Animated.timing(inputSlideAnim, {
      toValue: 0,
      duration: 300,
      delay: 100,
      useNativeDriver: true,
    }).start();
  }, [inputSlideAnim]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 || streamingMessage) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({animated: true});
      }, 100);
    }
  }, [messages, streamingMessage]);

  // Ensure "Saving..." status is visible by auto-scrolling when it appears
  useEffect(() => {
    if (isSavingHistory) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({animated: true});
      }, 50);
    }
  }, [isSavingHistory]);
  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
      }
      if (messageQueueIntervalRef.current) {
        clearInterval(messageQueueIntervalRef.current);
      }
    };
  }, []);

  // Progressive message revelation (for single message streaming)
  useEffect(() => {
    if (!streamingMessage || !streamingMessage.remainingText) {
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
      }
      return;
    }

    // Update message immediately with current text
    setMessages(msgs =>
      msgs.map(msg =>
        msg.id === streamingMessage.id
          ? {...msg, text: streamingMessage.currentText}
          : msg
      )
    );

    streamingIntervalRef.current = setInterval(() => {
      setStreamingMessage(prev => {
        if (!prev || !prev.remainingText) {
          if (streamingIntervalRef.current) {
            clearInterval(streamingIntervalRef.current);
            streamingIntervalRef.current = null;
          }
          // Finalize the message
          if (prev) {
            setMessages(msgs =>
              msgs.map(msg =>
                msg.id === prev.id ? {...msg, text: prev.currentText} : msg
              )
            );
          }
          return null;
        }

        const {chunk, remaining} = getNextChunk(prev.remainingText);
        
        if (!chunk) {
          // No more chunks - finalize
          if (streamingIntervalRef.current) {
            clearInterval(streamingIntervalRef.current);
            streamingIntervalRef.current = null;
          }
          setMessages(msgs =>
            msgs.map(msg =>
              msg.id === prev.id ? {...msg, text: prev.currentText} : msg
            )
          );
          return null;
        }

        const newText = prev.currentText + ' ' + chunk;
        
        // Update message with new text
        setMessages(msgs =>
          msgs.map(msg =>
            msg.id === prev.id ? {...msg, text: newText} : msg
          )
        );
        
        return {
          ...prev,
          currentText: newText,
          remainingText: remaining,
        };
      });
    }, 800); // Reveal next sentence every 800ms

    return () => {
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
      }
    };
  }, [streamingMessage]);

  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const getAgentIdForCurrent = (): string => {
    try {
      const name = (currentAgent || '').trim();
      if (!name) return 'polly';
      const match = BIRDS.find(b => (b.agentName || b.name) === name);
      if (match?.id) return match.id;
      const lower = name.toLowerCase();
      if (lower.includes('polly') || lower.includes('parrot')) return 'polly';
      if (lower.includes('flynn') || lower.includes('falcon')) return 'flynn';
      if (lower.includes('pixel') || lower.includes('pigeon')) return 'pixel';
      if (lower.includes('cato') || lower.includes('crane')) return 'cato';
      return 'polly';
    } catch {
      return 'polly';
    }
  };

  const formatArticleCardsForLog = (cards: NonNullable<Message['articleCards']>): string => {
    try {
      const lines = cards.map((c, idx) => {
        const n = idx + 1;
        const source = c.sourceName ? ` — ${c.sourceName}` : '';
        const tags = Array.isArray(c.tags) && c.tags.length > 0 ? ` [tags: ${c.tags.join(', ')}]` : '';
        const url = c.url ? ` (${c.url})` : '';
        return `${n}. ${c.headline}${source}${tags}${url}`;
      });
      return ['[ARTICLES]', ...lines].join('\n');
    } catch {
      return '';
    }
  };

  // Progressive message queue revelation (for multiple message bubbles)
  useEffect(() => {
    if (pendingMessages.length === 0) {
      if (messageQueueIntervalRef.current) {
        clearInterval(messageQueueIntervalRef.current);
        messageQueueIntervalRef.current = null;
      }
      return;
    }

    // Clear any existing interval
    if (messageQueueIntervalRef.current) {
      clearInterval(messageQueueIntervalRef.current);
    }

    // Add messages one by one with delay
    let currentIndex = 0;
    const messagesToAdd = [...pendingMessages];
    
    messageQueueIntervalRef.current = setInterval(() => {
      if (currentIndex < messagesToAdd.length) {
        addMessage(messagesToAdd[currentIndex]);
        currentIndex++;
      } else {
        // All messages added
        if (messageQueueIntervalRef.current) {
          clearInterval(messageQueueIntervalRef.current);
          messageQueueIntervalRef.current = null;
        }
        setPendingMessages([]);
      }
    }, 1000); // Reveal next message bubble every 1000ms

    return () => {
      if (messageQueueIntervalRef.current) {
        clearInterval(messageQueueIntervalRef.current);
        messageQueueIntervalRef.current = null;
      }
    };
  }, [pendingMessages, addMessage]);

  const startStreaming = (
    id: string,
    agentName: string,
    initialText: string,
    remainingText: string,
    isRouting: boolean = false,
  ) => {
    // Update current agent if this is not a routing message
    if (!isRouting && agentName && agentName !== currentAgent) {
      setCurrentAgent(agentName);
    }
    
    // Add initial chunk as a message
    const initialMessage: Message = {
      id,
      type: 'agent',
      text: initialText,
      agentName,
    };
    addMessage(initialMessage);

    // Set up streaming for remaining text
    if (remainingText) {
      setStreamingMessage({
        id,
        agentName,
        currentText: initialText,
        remainingText,
      });
    }
  };

  // Build conversation history from messages
  const buildConversationHistory = (): ConversationHistoryItem[] => {
    const history: ConversationHistoryItem[] = [];
    
    // Track consecutive agent messages that should be combined
    let currentAgentResponse: string[] = [];
    
    // Track which agent was last speaking (for detection)
    let lastAgentName: string | undefined = undefined;
    
    // Skip the welcome message and routing messages
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      // Skip welcome message
      if (msg.id === '1' && msg.type === 'agent') {
        continue;
      }
      
      // Skip routing messages - they're not part of the actual conversation
      if (msg.isRouting) {
        continue;
      }
      
      if (msg.type === 'user') {
        // If we have pending agent response chunks, combine and add them
        if (currentAgentResponse.length > 0) {
          // Include agent name in metadata format for backend detection
          // Format: "response text [Agent: Agent Name]" - backend will extract and strip this
          const combinedResponse = currentAgentResponse.join(' ');
          const responseWithAgent = lastAgentName 
            ? `${combinedResponse} [Agent: ${lastAgentName}]`
            : combinedResponse;
          history.push({
            role: 'model',
            parts: [responseWithAgent],
          });
          currentAgentResponse = [];
        }
        
        // Add user message
        history.push({
          role: 'user',
          parts: [msg.text],
        });
      } else if (msg.type === 'agent' && msg.text) {
        // Track agent name for this response
        if (msg.agentName) {
          lastAgentName = msg.agentName;
        }
        // Collect agent response chunks (they may be split into multiple messages)
        let textToStore = msg.text;
        // Append a compact, textual representation of any article cards for logging/history
        if (Array.isArray(msg.articleCards) && msg.articleCards.length > 0) {
          const cardsBlock = formatArticleCardsForLog(msg.articleCards);
          if (cardsBlock) {
            textToStore = textToStore ? `${textToStore}\n\n${cardsBlock}` : cardsBlock;
          }
        }
        currentAgentResponse.push(textToStore);
      }
    }
    
    // Add any remaining agent response chunks
    if (currentAgentResponse.length > 0) {
      const combinedResponse = currentAgentResponse.join(' ');
      const responseWithAgent = lastAgentName 
        ? `${combinedResponse} [Agent: ${lastAgentName}]`
        : combinedResponse;
      history.push({
        role: 'model',
        parts: [responseWithAgent],
      });
    }
    
    return history;
  };

  // Persist chat on leave (back or navigation)
  const persistChatOnLeave = async () => {
    try {
      if (!email) return;
      // Build full history including current messages (excluding welcome and routing)
      const history = buildConversationHistory();
      // Only save if there's at least one user + one agent message
      const hasUser = history.some(h => h.role === 'user');
      const hasAgent = history.some(h => h.role === 'model');
      if (!hasUser || !hasAgent) return;
      setIsSavingHistory(true);
      await saveChatHistory(email, history, parrotName);
    } catch (e) {
      // non-blocking
      console.warn('persistChatOnLeave error', e);
    } finally {
      setIsSavingHistory(false);
    }
  };

  const handleSendMessage = async () => {
    const message = inputText.trim();
    if (!message || isLoading) return;

    // Build conversation history BEFORE adding the new user message
    // This ensures we only send previous conversation context (not including current message)
    const conversationHistory = buildConversationHistory();

    // Add user message to UI immediately for better UX
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      text: message,
    };
    addMessage(userMessage);
    setInputText('');
    setIsLoading(true);
    // Clear any previous routing indicator
    setRoutingTo(null);

    try {
      // Send message with history (current message is NOT in history, backend will add it)
      // Debug: log history length to verify it's being sent
      console.log(`Sending message with ${conversationHistory.length} history items, currentAgent: ${currentAgent}`);
      
      const agentIdToSend = getAgentIdForCurrent();
      const data = await sendMessage(message, conversationHistory, agentIdToSend, userName, parrotName);

      // Show agent response - split into multiple message bubbles
      const agentName = data.agent || 'Agent';
      
      // Check if we're routing to a different agent (before updating currentAgent)
      // Use routed_from as the primary indicator, or check if agent changed
      const isRouting = (data.routed_from || (agentName && agentName !== currentAgent));
      
      // Show routing indicator if switching to a different agent (while still loading)
      if (isRouting && agentName && agentName !== currentAgent) {
        console.log('[ConversationScreen] Showing routing indicator for:', agentName, 'from', currentAgent);
        setRoutingTo(agentName);
        // Update current agent state when routing
        setCurrentAgent(agentName);
        // Scroll to show routing indicator
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({animated: true});
        }, 100);
      } else if (agentName && agentName !== currentAgent) {
        // Update current agent even if not routing (e.g., first message)
        setCurrentAgent(agentName);
      }
      console.log('[ConversationScreen] Received response:', {
        agent: agentName,
        currentAgent,
        routed_from: data.routed_from,
        has_article_reference: data.has_article_reference,
        responseLength: data.response?.length,
        allKeys: Object.keys(data),
        isRouting,
        routingTo,
      });
      
      // If routing, add a delay to show the routing message
      const delayBeforeShowingMessage = isRouting && routingTo ? 1500 : 0;
      
      setTimeout(() => {
      const chunks = splitIntoMessageChunks(data.response);
      
      if (chunks.length > 1) {
        // Multiple chunks - create separate message bubbles
        const messageBubbles: Message[] = chunks.map((chunk, index) => ({
          id: `agent-${Date.now()}-${index}`,
          type: 'agent',
          text: chunk,
            agentName: index === 0 ? agentName : agentName, // Keep agent name for all chunks
            hasArticleReference: data.has_article_reference && index === 0, // Only show on first chunk
            articleCards: index === 0 && Array.isArray(data.articles)
              ? data.articles.map(a => ({
                  headline: a.headline,
                  url: a.url || undefined,
                  sourceName: a.source_name || undefined,
                  tags: a.tags || undefined,
                }))
              : undefined,
            // Include chart/timeline only in first chunk
            chart: index === 0 ? data.chart || null : null,
            timeline: index === 0 ? data.timeline || null : null,
        }));
        
        // Add first message immediately, queue the rest
        addMessage(messageBubbles[0]);
        if (messageBubbles.length > 1) {
          setPendingMessages(messageBubbles.slice(1));
        }
      } else {
        // Single chunk - show immediately
        addMessage({
          id: `agent-${Date.now()}`,
          type: 'agent',
          text: chunks[0],
          agentName: agentName,
            hasArticleReference: data.has_article_reference,
            articleCards: Array.isArray(data.articles)
              ? data.articles.map(a => ({
                  headline: a.headline,
                  url: a.url || undefined,
                  sourceName: a.source_name || undefined,
                  tags: a.tags || undefined,
                }))
              : undefined,
            chart: data.chart || null,
            timeline: data.timeline || null,
        });
      }
        
        // Clear routing indicator and loading state after messages are added
        setRoutingTo(null);
        setIsLoading(false);
      }, delayBeforeShowingMessage);
    } catch (error) {
      const errorText = error instanceof Error
        ? error.message
        : `Failed to get response. Make sure the backend server is running at ${API_BASE_URL}`;
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        type: 'agent',
        text: `Error: ${errorText}`,
        agentName: 'System',
      };
      addMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = (screen: 'home' | 'chat' | 'history' | 'settings') => {
    // Save chat before leaving this screen
    const leave = async () => {
      try {
        await persistChatOnLeave();
      } catch (e) {
        // non-blocking
        console.warn('Failed to save chat on leave', e);
      } finally {
        if (screen === 'home') {
          if (onNavigateToHome) {
            onNavigateToHome();
          } else if (onBack) {
            onBack();
          }
        } else if (screen === 'settings' && onNavigateToSettings) {
          onNavigateToSettings();
        } else if (screen === 'chat') {
          // Already on chat screen
        } else if (screen === 'history' && onNavigateToHistory) {
          onNavigateToHistory();
        }
      }
    };
    leave();
  };

  return (
    <View style={conversationStyles.container}>
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        userName={userName}
        currentScreen="chat"
        onNavigate={handleNavigate}
      />
      {/* App-style Header with title, back button, and menu button - Static */}
      <View style={conversationStyles.headerContainer}>
        <View style={conversationStyles.headerLeft}>
          {onBack ? (
            <TouchableOpacity
              style={conversationStyles.headerButton}
              onPress={async () => {
                try {
                  await persistChatOnLeave();
                } catch (e) {
                  console.warn('Failed to save chat on back', e);
                } finally {
                  onBack && onBack();
                }
              }}>
              <Image
                source={require('../assets/back.png')}
                style={conversationStyles.headerButtonImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={conversationStyles.headerTitle}>
          {formatDate()}
        </Text>
        <View style={conversationStyles.headerRight}>
          <TouchableOpacity
            style={conversationStyles.headerButton}
            onPress={() => setIsSidebarOpen(true)}>
            <Image
              source={require('../assets/icons8-menu-100.png')}
              style={conversationStyles.headerButtonImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </View>
      {sessionBirdIds.length > 0 && (
        <View style={conversationStyles.avatarRow}>
          {sessionBirdIds.map(birdId => {
            const bird = BIRDS.find(b => b.id === birdId);
            if (!bird) return null;
            const shift = BIRD_IMAGE_SHIFTS[bird.agentName || bird.name] || {left: 5, top: 2};
            return (
              <View key={birdId} style={conversationStyles.avatar}>
                <Image
                  source={bird.image}
                  resizeMode="cover"
                  style={[
                    conversationStyles.avatarImage,
                    {left: shift.left, top: shift.top},
                  ]}
                />
              </View>
            );
          })}
        </View>
      )}
      
      {/* Content Area */}
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      {/* Conversation Box */}
      <ScrollView
        ref={scrollViewRef}
        style={conversationStyles.conversationBox}
        contentContainerStyle={conversationStyles.conversationContent}
        showsVerticalScrollIndicator={true}>
        {messages.map(message => {
          const isStreaming = streamingMessage?.id === message.id;
          // Skip routing messages - they're now shown as loading indicator
          if (message.isRouting) {
            return null;
          }
          if (message.type === 'agent') {
            // Use the agent name from the message to get bird image and shift
            // This ensures each message shows the correct avatar for the agent who sent it
            const messageAgent = message.agentName || currentAgent;
            const birdImage = getBirdImage(messageAgent);
            const imageShift = getBirdImageShift(messageAgent);
            
            return (
              <View key={message.id} style={conversationStyles.messageRow}>
                <View style={conversationStyles.parrotAvatar}>
                  <Image
                    source={birdImage}
                    resizeMode="cover"
                    style={[
                      conversationStyles.avatarImage,
                      {
                        left: imageShift.left,
                        top: imageShift.top,
                      },
                    ]}
                  />
                </View>
                <View
                  style={[
                    conversationStyles.messageContainer,
                    conversationStyles.agentMessageContainer,
                  ]}>
                  {message.agentName && (
                    <Text style={conversationStyles.agentName}>
                      {message.isRouting ? '🔄 ' : ''}
                      {message.agentName}
                    </Text>
                  )}
                  <Text
                    style={[
                      conversationStyles.messageText,
                      conversationStyles.agentMessageText,
                    ]}>
                    {message.text}
                    {isStreaming && (
                      <Text style={conversationStyles.streamingCursor}>▋</Text>
                    )}
                  </Text>
                  {message.chart && (
                    <Chart chartData={message.chart} />
                  )}
                  {message.timeline && (
                    <Timeline timelineData={message.timeline} />
                  )}
                  {Array.isArray(message.articleCards) && message.articleCards.length > 0 && (
                    <View style={{marginTop: 8, gap: 12}}>
                      {message.articleCards.map((a, idx) => (
                        <NewsArticleCard
                          key={`${message.id}-card-${idx}`}
                          headline={a.headline}
                          sourceName={a.sourceName || 'Unknown'}
                          tags={a.tags || undefined}
                          articleUrl={a.url || undefined}
                          style={{}}
                        />
                      ))}
                    </View>
                  )}
                  {message.hasArticleReference && (
                    <View style={conversationStyles.articleTab}>
                      <View style={conversationStyles.articleTabIndicator} />
                    </View>
                  )}
                </View>
              </View>
            );
          }
          return (
            <View key={message.id} style={conversationStyles.messageRow}>
              <View style={conversationStyles.userAvatar}>
                <Image
                  source={require('../assets/profilePlaceholder.png')}
                  resizeMode="cover"
                  style={conversationStyles.userAvatarImage}
                />
              </View>
              <View
                style={[
                  conversationStyles.messageContainer,
                  conversationStyles.userMessageContainer,
                ]}>
                <Text style={conversationStyles.userName}>You</Text>
                <Text
                  style={[
                    conversationStyles.messageText,
                    conversationStyles.userMessageText,
                  ]}>
                  {message.text}
                </Text>
              </View>
            </View>
          );
        })}
        {isSavingHistory && (
          <View style={conversationStyles.loadingContainer}>
            <ActivityIndicator size="small" color="#667eea" />
            <Text style={conversationStyles.loadingText}>Saving...</Text>
          </View>
        )}
        {isLoading && (
          <View style={conversationStyles.loadingContainer}>
            <ActivityIndicator size="small" color="#667eea" />
            <Text style={conversationStyles.loadingText}>
              {routingTo ? `Routing to ${routingTo}...` : 'Thinking...'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Input Area - Slides from bottom */}
      <Animated.View
        style={[
          conversationStyles.inputContainer,
          {
            transform: [{translateY: inputSlideAnim}],
          },
        ]}>
        <TextInput
          style={conversationStyles.textInput}
          placeholder="your message here..."
          placeholderTextColor="#999"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          editable={!isLoading}
        />
        <TouchableOpacity
          style={[
            conversationStyles.sendButton,
            (isLoading || !inputText.trim()) && conversationStyles.sendButtonDisabled,
          ]}
          onPress={handleSendMessage}
          disabled={isLoading || !inputText.trim()}>
          <Image
            source={require('../assets/icons8-up-100.png')}
            style={conversationStyles.sendButtonImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </Animated.View>
      </KeyboardAvoidingView>
      </View>
  );
};
