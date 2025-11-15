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
} from 'react-native';
import {Message, ConversationHistoryItem} from '../types';
import {sendMessage} from '../services/api';
import {splitIntoParagraphs} from '../utils/textUtils';
import {getInitialChunk, getNextChunk, splitIntoMessageChunks} from '../utils/messageUtils';
import {API_BASE_URL} from '../constants/api';
import {conversationStyles} from '../styles/conversationStyles';

interface ConversationScreenProps {
  initialMessage?: Message;
}

export const ConversationScreen: React.FC<ConversationScreenProps> = ({
  initialMessage,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    initialMessage || {
      id: '1',
      type: 'agent',
      text: "Welcome to News Nest! I'm Polly, your friendly news anchor. Ask me about today's top headlines! Or if you have something in mind to discuss,I'll automatically route your question to the best specialist agent!",
      agentName: 'Polly the Parrot',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<{
    id: string;
    agentName: string;
    currentText: string;
    remainingText: string;
  } | null>(null);
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const streamingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageQueueIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Restart conversation - clears all history and resets to initial state
  const handleRestartConversation = useCallback(() => {
    // Clear all intervals
    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
      streamingIntervalRef.current = null;
    }
    if (messageQueueIntervalRef.current) {
      clearInterval(messageQueueIntervalRef.current);
      messageQueueIntervalRef.current = null;
    }

    // Reset all state to initial values
    setMessages([
      {
        id: '1',
        type: 'agent',
        text: "Welcome to News Nest! I'm Polly, your friendly news anchor. Ask me about today's top headlines! Or if you have something in mind to discuss,I'll automatically route your question to the best specialist agent!",
        agentName: 'Polly the Parrot',
      },
    ]);
    setInputText('');
    setIsLoading(false);
    setStreamingMessage(null);
    setPendingMessages([]);
    
    // Scroll to top
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({y: 0, animated: true});
    }, 100);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 || streamingMessage) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({animated: true});
      }, 100);
    }
  }, [messages, streamingMessage]);

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
  ) => {
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
        currentAgentResponse.push(msg.text);
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

    try {
      // Send message with history (current message is NOT in history, backend will add it)
      // Debug: log history length to verify it's being sent
      console.log(`Sending message with ${conversationHistory.length} history items`);
      
      const data = await sendMessage(message, conversationHistory);

      // Show routing message if present (brief, one chunk)
      if (data.routing_message) {
        const routingChunk = getInitialChunk(data.routing_message);
        const routingId = `routing-${Date.now()}`;
        
        if (routingChunk.remaining) {
          startStreaming(
            routingId,
            'Polly the Parrot',
            routingChunk.initial,
            routingChunk.remaining,
          );
        } else {
          addMessage({
            id: routingId,
            type: 'agent',
            text: routingChunk.initial,
            agentName: 'Polly the Parrot',
            isRouting: true,
          });
        }
      }

      // Show agent response - split into multiple message bubbles
      const agentName = data.agent || 'Agent';
      const chunks = splitIntoMessageChunks(data.response);
      
      if (chunks.length > 1) {
        // Multiple chunks - create separate message bubbles
        const messageBubbles: Message[] = chunks.map((chunk, index) => ({
          id: `agent-${Date.now()}-${index}`,
          type: 'agent',
          text: chunk,
          agentName: index === 0 ? agentName : undefined, // Only show agent name on first message
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
        });
      }
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

  return (
    <KeyboardAvoidingView
      style={conversationStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      {/* Restart Button */}
      {messages.length > 1 && (
        <View style={conversationStyles.restartButtonContainer}>
          <TouchableOpacity
            style={conversationStyles.restartButton}
            onPress={handleRestartConversation}
            disabled={isLoading}>
            <Text style={conversationStyles.restartButtonText}>🔄 Restart</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Conversation Box */}
      <ScrollView
        ref={scrollViewRef}
        style={conversationStyles.conversationBox}
        contentContainerStyle={conversationStyles.conversationContent}
        showsVerticalScrollIndicator={true}>
        {messages.map(message => {
          const isStreaming = streamingMessage?.id === message.id;
          
          return (
            <View
              key={message.id}
              style={[
                conversationStyles.messageContainer,
                message.type === 'user'
                  ? conversationStyles.userMessageContainer
                  : conversationStyles.agentMessageContainer,
              ]}>
              {message.type === 'agent' && message.agentName && (
                <Text style={conversationStyles.agentName}>
                  {message.isRouting ? '🔄 ' : ''}
                  {message.agentName}
                </Text>
              )}
              <Text
                style={[
                  conversationStyles.messageText,
                  message.type === 'user'
                    ? conversationStyles.userMessageText
                    : conversationStyles.agentMessageText,
                ]}>
                {message.text}
                {isStreaming && (
                  <Text style={conversationStyles.streamingCursor}>▋</Text>
                )}
              </Text>
            </View>
          );
        })}
        {isLoading && (
          <View style={conversationStyles.loadingContainer}>
            <ActivityIndicator size="small" color="#667eea" />
            <Text style={conversationStyles.loadingText}>Thinking...</Text>
          </View>
        )}
      </ScrollView>

      {/* Input Area */}
      <View style={conversationStyles.inputContainer}>
        <TextInput
          style={conversationStyles.textInput}
          placeholder="Ask me about the news..."
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
          <Text style={conversationStyles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};
