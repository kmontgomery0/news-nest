import {StyleSheet} from 'react-native';
import {
  background_cream_color,
  surface_white_color,
  text_primary_brown_color,
  text_dark_gray_color,
  text_muted_gray_color,
} from './colors';

export const chatHistoryStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: background_cream_color,
  },
  headerContainer: {
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: surface_white_color,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  headerLeft: {
    width: 36,
    height: 36,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: text_primary_brown_color,
    fontFamily: 'Patrick Hand',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: -1,
  },
  headerRight: {
    width: 36,
    height: 36,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonImage: {
    width: 24,
    height: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: surface_white_color,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardContent: {
    flex: 1,
  },
  dateText: {
    fontSize: 18,
    fontFamily: 'Patrick Hand',
    color: text_dark_gray_color,
    fontWeight: '600',
    marginBottom: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#000000',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surface_white_color,
  },
  avatarImage: {
    width: 50,
    height: 50,
    position: 'absolute',
  },
  arrowContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  arrowImage: {
    width: 24,
    height: 24,
    transform: [{scaleX: -1}], // Flip horizontally to point right
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 18,
    color: text_muted_gray_color,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Patrick Hand',
  },
  emptyStateButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: text_primary_brown_color,
    backgroundColor: surface_white_color,
  },
  emptyStateButtonText: {
    fontSize: 18,
    color: text_primary_brown_color,
    fontFamily: 'Patrick Hand',
    fontWeight: '600',
  },
});

