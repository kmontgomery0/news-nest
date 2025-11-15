import {StyleSheet} from 'react-native';
import {
  accent_indigo_color,
  text_white_color,
  text_white_muted_color,
  shadow_black_color,
} from './colors';

export const headerStyles = StyleSheet.create({
  header: {
    backgroundColor: accent_indigo_color,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: shadow_black_color,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: text_white_color,
    textAlign: 'center',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: text_white_muted_color,
    textAlign: 'center',
  },
});

