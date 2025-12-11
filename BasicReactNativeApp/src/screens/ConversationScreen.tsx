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
  Modal,
} from 'react-native';
import {Message, ConversationHistoryItem, ChartData, TimelineData, SportsScoreboardResponse} from '../types';
import {sendMessage, saveChatHistory} from '../services/api';
import {splitIntoParagraphs} from '../utils/textUtils';
import {getInitialChunk, getNextChunk, splitIntoMessageChunks} from '../utils/messageUtils';
import {API_BASE_URL} from '../constants/api';
import {conversationStyles} from '../styles/conversationStyles';
import {text_primary_brown_color} from '../styles/colors';
import {BIRD_IMAGE_MAP, BIRD_IMAGE_SHIFTS, BIRDS} from '../constants/birds';
import {Sidebar} from '../components/Sidebar';
import {NewsArticleCard, Chart, Timeline, SportsScoreboard} from '../components';

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
  // Track the current chat session ID (from props or set when saving)
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(sessionId);
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
  const [loadingMessage, setLoadingMessage] = useState<string>('Processing query...');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const loadingTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const isLoadingRef = useRef<boolean>(false);
  const [sessionBirdIds, setSessionBirdIds] = useState<string[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const streamingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageQueueIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inputSlideAnim = useRef(new Animated.Value(100)).current;
  const [expandedVisualization, setExpandedVisualization] = useState<{
    type: 'chart' | 'timeline';
    chart?: ChartData | null;
    timeline?: TimelineData | null;
  } | null>(null);

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
        // Store the session ID so we can update this session later
        setCurrentSessionId(sessionId);
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

        // Helper to extract JSON object from text (handles nested braces)
        const extractJsonObject = (text: string, startIdx: number): { json: string; endIdx: number } | null => {
          let braceCount = 0;
          let inString = false;
          let escapeNext = false;
          let jsonStart = -1;
          
          for (let i = startIdx; i < text.length; i++) {
            const char = text[i];
            
            if (escapeNext) {
              escapeNext = false;
              continue;
            }
            
            if (char === '\\') {
              escapeNext = true;
              continue;
            }
            
            if (char === '"') {
              inString = !inString;
              continue;
            }
            
            if (inString) continue;
            
            if (char === '{') {
              if (jsonStart === -1) jsonStart = i;
              braceCount++;
            } else if (char === '}') {
              braceCount--;
              if (braceCount === 0 && jsonStart !== -1) {
                return {
                  json: text.substring(jsonStart, i + 1),
                  endIdx: i + 1,
                };
              }
            }
          }
          
          return null;
        };

        // Helper to parse saved [CHART], [TIMELINE], and [SCOREBOARD] blocks
        const parseSavedVisualizations = (input: string): { 
          cleaned: string; 
          chart: ChartData | null; 
          timeline: TimelineData | null;
          scoreboard: SportsScoreboardResponse | null;
        } => {
          try {
            if (!input) return { cleaned: input, chart: null, timeline: null, scoreboard: null };
            let cleaned = input;
            let chart: ChartData | null = null;
            let timeline: TimelineData | null = null;
            let scoreboard: SportsScoreboardResponse | null = null;

            // Parse [CHART] block
            const chartMarkerIdx = cleaned.indexOf('[CHART]');
            if (chartMarkerIdx !== -1) {
              // Find the newline after [CHART]
              const afterMarker = cleaned.substring(chartMarkerIdx + '[CHART]'.length);
              const newlineIdx = afterMarker.search(/\n/);
              if (newlineIdx !== -1) {
                const jsonStartIdx = chartMarkerIdx + '[CHART]'.length + newlineIdx + 1;
                const jsonResult = extractJsonObject(cleaned, jsonStartIdx);
                if (jsonResult) {
                  try {
                    chart = JSON.parse(jsonResult.json) as ChartData;
                    // Remove the entire [CHART] block including marker and JSON
                    const blockEnd = jsonResult.endIdx;
                    // Also remove any trailing whitespace/newlines
                    const afterJson = cleaned.substring(blockEnd);
                    const trailingWhitespace = afterJson.match(/^\s*/)?.[0] || '';
                    const removeEnd = blockEnd + trailingWhitespace.length;
                    cleaned = cleaned.substring(0, chartMarkerIdx).trim() + 
                             (removeEnd < cleaned.length ? cleaned.substring(removeEnd) : '');
                    cleaned = cleaned.trim();
                  } catch (e) {
                    console.warn('Failed to parse saved chart:', e);
                    // Remove the block even if parsing failed
                    const blockEnd = jsonResult.endIdx;
                    cleaned = cleaned.substring(0, chartMarkerIdx).trim() + 
                             (blockEnd < cleaned.length ? cleaned.substring(blockEnd) : '');
                    cleaned = cleaned.trim();
                  }
                }
              }
            }

            // Parse [TIMELINE] block - same approach
            const timelineMarkerIdx = cleaned.indexOf('[TIMELINE]');
            if (timelineMarkerIdx !== -1) {
              const afterMarker = cleaned.substring(timelineMarkerIdx + '[TIMELINE]'.length);
              const newlineIdx = afterMarker.search(/\n/);
              if (newlineIdx !== -1) {
                const jsonStartIdx = timelineMarkerIdx + '[TIMELINE]'.length + newlineIdx + 1;
                const jsonResult = extractJsonObject(cleaned, jsonStartIdx);
                if (jsonResult) {
                  try {
                    timeline = JSON.parse(jsonResult.json) as TimelineData;
                    // Remove the entire [TIMELINE] block
                    const blockEnd = jsonResult.endIdx;
                    const afterJson = cleaned.substring(blockEnd);
                    const trailingWhitespace = afterJson.match(/^\s*/)?.[0] || '';
                    const removeEnd = blockEnd + trailingWhitespace.length;
                    cleaned = cleaned.substring(0, timelineMarkerIdx).trim() + 
                             (removeEnd < cleaned.length ? cleaned.substring(removeEnd) : '');
                    cleaned = cleaned.trim();
                  } catch (e) {
                    console.warn('Failed to parse saved timeline:', e);
                    // Remove the block even if parsing failed
                    const blockEnd = jsonResult.endIdx;
                    cleaned = cleaned.substring(0, timelineMarkerIdx).trim() + 
                             (blockEnd < cleaned.length ? cleaned.substring(blockEnd) : '');
                    cleaned = cleaned.trim();
                  }
                }
              }
            }

            // Parse [SCOREBOARD] block - same approach
            const scoreboardMarkerIdx = cleaned.indexOf('[SCOREBOARD]');
            if (scoreboardMarkerIdx !== -1) {
              const afterMarker = cleaned.substring(scoreboardMarkerIdx + '[SCOREBOARD]'.length);
              const newlineIdx = afterMarker.search(/\n/);
              if (newlineIdx !== -1) {
                const jsonStartIdx = scoreboardMarkerIdx + '[SCOREBOARD]'.length + newlineIdx + 1;
                const jsonResult = extractJsonObject(cleaned, jsonStartIdx);
                if (jsonResult) {
                  try {
                    scoreboard = JSON.parse(jsonResult.json) as SportsScoreboardResponse;
                    // Remove the entire [SCOREBOARD] block
                    const blockEnd = jsonResult.endIdx;
                    const afterJson = cleaned.substring(blockEnd);
                    const trailingWhitespace = afterJson.match(/^\s*/)?.[0] || '';
                    const removeEnd = blockEnd + trailingWhitespace.length;
                    cleaned = cleaned.substring(0, scoreboardMarkerIdx).trim() + 
                             (removeEnd < cleaned.length ? cleaned.substring(removeEnd) : '');
                    cleaned = cleaned.trim();
                  } catch (e) {
                    console.warn('Failed to parse saved scoreboard:', e);
                    // Remove the block even if parsing failed
                    const blockEnd = jsonResult.endIdx;
                    cleaned = cleaned.substring(0, scoreboardMarkerIdx).trim() + 
                             (blockEnd < cleaned.length ? cleaned.substring(blockEnd) : '');
                    cleaned = cleaned.trim();
                  }
                }
              }
            }

            return { cleaned, chart, timeline, scoreboard };
          } catch {
            return { cleaned: input, chart: null, timeline: null, scoreboard: null };
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
            let cleanedPre = text.replace(/\s*\[Agent:\s*[^\]]+\]\s*$/i, '').trim();
            
            // Parse visualizations first (they come before articles in the text)
            const vizParsed = parseSavedVisualizations(cleanedPre);
            cleanedPre = vizParsed.cleaned;
            
            // Then parse articles from the cleaned text
            const parsed = parseSavedArticlesBlock(cleanedPre);
            const cleaned = parsed.cleaned.trim();
            
            if (agentName) lastAgentNameLocal = agentName;
            
            // Split the cleaned text into message chunks (like when receiving new responses)
            const chunks = splitIntoMessageChunks(cleaned);
            
            // Create message bubbles - attach chart/timeline/scoreboard/articles only to first chunk
            chunks.forEach((chunk, chunkIdx) => {
              loaded.push({
                id: `agent-${idx}-${chunkIdx}-${Date.now()}`,
                type: 'agent',
                text: chunk,
                agentName: agentName || lastAgentNameLocal || defaultAgentName,
                // Only attach chart/timeline/scoreboard/articles to first chunk
                chart: chunkIdx === 0 ? vizParsed.chart : null,
                timeline: chunkIdx === 0 ? vizParsed.timeline : null,
                scoreboard: chunkIdx === 0 ? vizParsed.scoreboard : null,
                articleCards: chunkIdx === 0 && parsed.cards && parsed.cards.length > 0 ? parsed.cards : undefined,
              });
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

  // Auto-send initial message if provided (only once on mount)
  const hasAutoSentRef = useRef(false);
  useEffect(() => {
    if (initialMessage && initialMessage.type === 'user' && !isLoading && !hasAutoSentRef.current) {
      hasAutoSentRef.current = true;
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        handleSendMessage(initialMessage.text);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []); // Only run once on mount

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
      // Clear any pending loading message timeouts
      loadingTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      loadingTimeoutsRef.current = [];
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

  const formatChartForLog = (chart: ChartData): string => {
    try {
      const jsonStr = JSON.stringify(chart);
      return `[CHART]\n${jsonStr}`;
    } catch {
      return '';
    }
  };

  const formatTimelineForLog = (timeline: TimelineData): string => {
    try {
      const jsonStr = JSON.stringify(timeline);
      return `[TIMELINE]\n${jsonStr}`;
    } catch {
      return '';
    }
  };

  const formatScoreboardForLog = (scoreboard: SportsScoreboardResponse): string => {
    try {
      const jsonStr = JSON.stringify(scoreboard);
      return `[SCOREBOARD]\n${jsonStr}`;
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
        
        // Track if we've already added chart/timeline/scoreboard to avoid duplicates
        // (since chunks may have the same chart/timeline/scoreboard)
        const hasChart = msg.chart !== null && msg.chart !== undefined;
        const hasTimeline = msg.timeline !== null && msg.timeline !== undefined;
        const hasScoreboard = msg.scoreboard !== null && msg.scoreboard !== undefined;
        const hasArticles = Array.isArray(msg.articleCards) && msg.articleCards.length > 0;
        
        // Only add visualizations/articles if this is the first chunk or if we haven't seen them yet
        // We'll track this by checking if currentAgentResponse is empty (first chunk)
        const isFirstChunk = currentAgentResponse.length === 0;
        
        if (isFirstChunk) {
          // Append chart data if present (only once, in first chunk)
          if (hasChart) {
            const chartBlock = formatChartForLog(msg.chart!);
            if (chartBlock) {
              textToStore = textToStore ? `${textToStore}\n\n${chartBlock}` : chartBlock;
            }
          }
          
          // Append timeline data if present (only once, in first chunk)
          if (hasTimeline) {
            const timelineBlock = formatTimelineForLog(msg.timeline!);
            if (timelineBlock) {
              textToStore = textToStore ? `${textToStore}\n\n${timelineBlock}` : timelineBlock;
            }
          }
          
          // Append scoreboard data if present (only once, in first chunk)
          if (hasScoreboard) {
            const scoreboardBlock = formatScoreboardForLog(msg.scoreboard!);
            if (scoreboardBlock) {
              textToStore = textToStore ? `${textToStore}\n\n${scoreboardBlock}` : scoreboardBlock;
            }
          }
          
          // Append a compact, textual representation of any article cards for logging/history
          if (hasArticles) {
            const cardsBlock = formatArticleCardsForLog(msg.articleCards!);
            if (cardsBlock) {
              textToStore = textToStore ? `${textToStore}\n\n${cardsBlock}` : cardsBlock;
            }
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
      const result = await saveChatHistory(email, history, parrotName, currentSessionId);
      // Update the session ID if this was a new session
      if (result.id && !currentSessionId) {
        setCurrentSessionId(result.id);
      }
    } catch (e) {
      // non-blocking
      console.warn('persistChatOnLeave error', e);
    } finally {
      setIsSavingHistory(false);
    }
  };

  const handleKeyPress = (e: any) => {
    // On web, detect Enter key press (without Shift) to submit
    if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const message = messageText || inputText.trim();
    if (!message || isLoading) return;
    
    // If messageText was provided, it means this is an auto-send from initialMessage
    // In that case, the message is already in the messages array, so we don't need to add it again

    // Build conversation history BEFORE adding the new user message
    // This ensures we only send previous conversation context (not including current message)
    const conversationHistory = buildConversationHistory();

    // Add user message to UI immediately for better UX (only if not already in messages)
    // If messageText was provided, it's from initialMessage and already in messages
    if (!messageText) {
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        text: message,
      };
      addMessage(userMessage);
    }
    setInputText('');
    setIsLoading(true);
    isLoadingRef.current = true;
    
    // Clear any existing timeouts
    loadingTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    loadingTimeoutsRef.current = [];
    
    // Simple progression: Processing query (2s) -> Thinking (3s) -> Generating response
    setLoadingMessage('Processing query...');
    
    const timeout1 = setTimeout(() => {
      if (isLoadingRef.current) {
        setLoadingMessage('Thinking...');
      }
    }, 2000); // Show "Processing query" for 2 seconds
    loadingTimeoutsRef.current.push(timeout1);
    
    const timeout2 = setTimeout(() => {
      if (isLoadingRef.current) {
        setLoadingMessage('Generating response...');
      }
    }, 5000); // Then show "Thinking" for 3 seconds (2s + 3s = 5s total), then "Generating response"
    loadingTimeoutsRef.current.push(timeout2);

    try {
      // Send message with history (current message is NOT in history, backend will add it)
      // Debug: log history length to verify it's being sent
      console.log(`Sending message with ${conversationHistory.length} history items, currentAgent: ${currentAgent}`);
      
      const agentIdToSend = getAgentIdForCurrent();
      const data = await sendMessage(message, conversationHistory, agentIdToSend, userName, parrotName);

      // Show agent response - split into multiple message bubbles
      const agentName = data.agent || 'Agent';
      
      // Update current agent if it changed
      if (agentName && agentName !== currentAgent) {
        setCurrentAgent(agentName);
      }
      console.log('[ConversationScreen] Received response:', {
        agent: agentName,
        currentAgent,
        routed_from: data.routed_from,
        has_article_reference: data.has_article_reference,
        responseLength: data.response?.length,
        allKeys: Object.keys(data),
      });
      
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
            scoreboard: index === 0 ? data.scoreboard || null : null,
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
            scoreboard: data.scoreboard || null,
        });
      }
        
        // Clear loading state after messages are added
        setIsLoading(false);
        isLoadingRef.current = false;
        // Clear any pending loading message timeouts
        loadingTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
        loadingTimeoutsRef.current = [];
    } catch (error) {
      const errorText = error instanceof Error
        ? error.message
        : `Failed to get response. Make sure the backend server is running at ${API_BASE_URL}`;
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        type: 'system',
        text: errorText,
      };
      addMessage(errorMessage);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
      // Clear any pending loading message timeouts on error
      loadingTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      loadingTimeoutsRef.current = [];
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
        {messages.map((message, index) => {
          const isStreaming = streamingMessage?.id === message.id;
          // Skip routing messages - they're now shown as loading indicator
          if (message.isRouting) {
            return null;
          }
          // Render system messages (errors) as small grey text without chat bubble
          if (message.type === 'system') {
            return (
              <View key={message.id} style={conversationStyles.systemMessageContainer}>
                <Text style={conversationStyles.systemMessageText}>
                  {message.text}
                </Text>
              </View>
            );
          }
          
          // Determine if this is a new speaker (different from previous message)
          const prevMessage = index > 0 ? messages[index - 1] : null;
          const isNewSpeaker = !prevMessage || 
            (message.type === 'agent' && prevMessage.type !== 'agent') ||
            (message.type === 'user' && prevMessage.type !== 'user') ||
            (message.type === 'agent' && prevMessage.type === 'agent' && 
             (message.agentName || currentAgent) !== (prevMessage.agentName || currentAgent));
          
          if (message.type === 'agent') {
            // Use the agent name from the message to get bird image and shift
            // This ensures each message shows the correct avatar for the agent who sent it
            const messageAgent = message.agentName || currentAgent;
            const birdImage = getBirdImage(messageAgent);
            const imageShift = getBirdImageShift(messageAgent);
            
            return (
              <View key={message.id}>
                {isNewSpeaker && message.agentName && (
                  <View style={conversationStyles.speakerNameContainer}>
                    <Text style={conversationStyles.agentName}>
                      {message.isRouting ? '🔄 ' : ''}
                      {message.agentName}
                    </Text>
                  </View>
                )}
                <View style={conversationStyles.messageRow}>
                  {isNewSpeaker ? (
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
                  ) : (
                    <View style={{width: 46, marginRight: 10}} />
                  )}
                  <View
                    style={[
                      conversationStyles.messageContainer,
                      conversationStyles.agentMessageContainer,
                    ]}>
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
                      <>
                        <Chart chartData={message.chart} />
                        <TouchableOpacity
                          style={conversationStyles.viewFullButton}
                          onPress={() =>
                            setExpandedVisualization({
                              type: 'chart',
                              chart: message.chart || null,
                              timeline: null,
                            })
                          }>
                          <Text style={conversationStyles.viewFullButtonText}>
                            View full chart
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {message.timeline && (
                      <>
                        <Timeline timelineData={message.timeline} />
                        <TouchableOpacity
                          style={conversationStyles.viewFullButton}
                          onPress={() =>
                            setExpandedVisualization({
                              type: 'timeline',
                              chart: null,
                              timeline: message.timeline || null,
                            })
                          }>
                          <Text style={conversationStyles.viewFullButtonText}>
                            View full timeline
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {message.scoreboard && (
                      <View style={{marginTop: 8}}>
                        <SportsScoreboard
                          title={`${message.scoreboard.date} Scores`}
                          games={message.scoreboard.games}
                        />
                      </View>
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
              </View>
            );
          }
          
          // User message
          return (
            <View key={message.id}>
              {isNewSpeaker && (
                <View style={conversationStyles.speakerNameContainer}>
                  <Text style={conversationStyles.userName}>You</Text>
                </View>
              )}
              <View style={conversationStyles.messageRow}>
                {isNewSpeaker ? (
                  <View style={conversationStyles.userAvatar}>
                    <Text style={conversationStyles.userAvatarText}>
                      {userName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                ) : (
                  <View style={{width: 46, marginRight: 10}} />
                )}
                <View
                  style={[
                    conversationStyles.messageContainer,
                    conversationStyles.userMessageContainer,
                  ]}>
                  <Text
                    style={[
                      conversationStyles.messageText,
                      conversationStyles.userMessageText,
                    ]}>
                    {message.text}
                  </Text>
                </View>
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
              {loadingMessage}
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
          onSubmitEditing={() => handleSendMessage()}
          onKeyPress={handleKeyPress}
          blurOnSubmit={false}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[
            conversationStyles.sendButton,
            (isLoading || !inputText.trim()) && conversationStyles.sendButtonDisabled,
          ]}
          onPress={() => handleSendMessage()}
          disabled={isLoading || !inputText.trim()}>
          <Image
            source={require('../assets/icons8-up-100.png')}
            style={conversationStyles.sendButtonImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </Animated.View>
      </KeyboardAvoidingView>
      {/* Full-screen visualization modal */}
      <Modal
        visible={!!expandedVisualization}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedVisualization(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {expandedVisualization?.chart?.title ||
                  expandedVisualization?.timeline?.title ||
                  'Details'}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setExpandedVisualization(null)}>
                <Text style={styles.modalCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalContent}
              contentContainerStyle={{paddingBottom: 16}}
              showsVerticalScrollIndicator={true}>
              {expandedVisualization?.type === 'chart' &&
                expandedVisualization.chart && (
                  <Chart chartData={expandedVisualization.chart} />
                )}
              {expandedVisualization?.type === 'timeline' &&
                expandedVisualization.timeline && (
                  <Timeline timelineData={expandedVisualization.timeline} />
                )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 600,
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: text_primary_brown_color,
  },
  modalCloseButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: '#666',
  },
  modalContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
});

