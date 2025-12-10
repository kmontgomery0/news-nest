import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import {
  background_cream_color,
  surface_white_color,
  text_primary_brown_color,
  text_dark_gray_color,
} from '../styles/colors';

// iPhone 16 width is 393px
const IPHONE_16_WIDTH = 393;
const {width: SCREEN_WIDTH} = Dimensions.get('window');

// Use static width for web (75% of iPhone 16), dynamic for native
const SIDEBAR_WIDTH = Platform.OS === 'web' 
  ? IPHONE_16_WIDTH * 0.75  // 75% of iPhone 16 width = 294.75px
  : SCREEN_WIDTH * 0.75;   // 75% of actual screen width on native

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  currentScreen?: 'home' | 'chat' | 'history' | 'settings';
  onNavigate?: (screen: 'home' | 'chat' | 'history' | 'settings') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  userName = 'Nicole',
  currentScreen,
  onNavigate,
}) => {
  const slideAnim = React.useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SIDEBAR_WIDTH,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen]);

  const menuItems = [
    {id: 'home', label: 'Home', icon: require('../assets/home.png')},
    {id: 'chat', label: 'Chat', icon: require('../assets/chat.png')},
    {id: 'history', label: 'Chat History', icon: require('../assets/chat-history.png')},
    {id: 'settings', label: 'Settings', icon: require('../assets/settings.png')},
  ];

  const handleMenuItemPress = (itemId: string) => {
    if (onNavigate) {
      onNavigate(itemId as 'home' | 'chat' | 'history' | 'settings');
    }
    onClose();
  };

  return (
    <>
      {/* Overlay - only interactive when open */}
      {isOpen && (
        <Animated.View
          style={[
            styles.overlay,
            {
              opacity: overlayOpacity,
            },
          ]}
          pointerEvents={isOpen ? 'auto' : 'none'}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
          />
        </Animated.View>
      )}

      {/* Sidebar - always rendered for animation */}
      <Animated.View
        style={[
          styles.sidebar,
          {
            transform: [{translateX: slideAnim}],
          },
        ]}
        pointerEvents={isOpen ? 'auto' : 'none'}>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.welcomeTextContainer}>
            <Text style={styles.welcomeText}>Welcome,</Text>
            <Text style={styles.userNameText}>{userName}</Text>
          </View>
        </View>
        <View style={styles.divider} />

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map(item => {
            const isActive = currentScreen === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.menuItem,
                  isActive && styles.menuItemActive,
                ]}
                onPress={() => handleMenuItemPress(item.id)}
                activeOpacity={0.7}>
                <Image
                  source={item.icon}
                  style={styles.menuIcon}
                  resizeMode="contain"
                />
                <Text
                  style={[
                    styles.menuText,
                    isActive && styles.menuTextActive,
                  ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 999,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: background_cream_color,
    zIndex: 1000,
    borderLeftWidth: 1,
    borderLeftColor: '#000000',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  welcomeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 20,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surface_white_color,
  },
  avatarText: {
    fontSize: 24,
    fontFamily: 'Patrick Hand',
    fontWeight: '700',
    color: text_dark_gray_color,
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 20,
    fontFamily: 'Patrick Hand',
    color: text_dark_gray_color,
    marginBottom: 2,
  },
  userNameText: {
    fontSize: 22,
    fontFamily: 'Patrick Hand',
    color: text_dark_gray_color,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#000000',
    marginBottom: 20,
  },
  menuContainer: {
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: surface_white_color,
  },
  menuItemActive: {
    backgroundColor: '#E8F5E9', // Light green for active state
  },
  menuIcon: {
    marginRight: 12,
    width: 20,
    height: 20,
  },
  menuText: {
    fontSize: 20,
    fontFamily: 'Patrick Hand',
    color: text_dark_gray_color,
  },
  menuTextActive: {
    color: text_dark_gray_color,
  },
});

