import React from 'react';
import {TouchableOpacity, View, Text, StyleSheet, ViewStyle, Linking} from 'react-native';
import {
  surface_white_color,
  text_primary_brown_color,
  text_dark_gray_color,
  text_muted_gray_color,
  background_cream_color,
} from '../styles/colors';

export type SourceType = 'newspaper' | 'magazine' | 'blog' | 'tv' | 'radio' | string;

interface NewsArticleCardProps {
  headline: string;
  sourceName: string;
  sourceType: SourceType;
  onPress?: () => void;
  style?: ViewStyle;
  articleUrl?: string;
}

export const NewsArticleCard: React.FC<NewsArticleCardProps> = ({
  headline,
  sourceName,
  sourceType,
  onPress,
  style,
  articleUrl = 'https://google.com',
}) => {
  const handleOpenArticle = async () => {
    try {
      const url = articleUrl || 'https://google.com';
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL('https://google.com');
      }
    } catch {
      // swallow - best-effort open
    }
  };

  const content = (
    <View style={[styles.card, style]}>
      <Text
        numberOfLines={3}
        style={styles.headline}
        onPress={handleOpenArticle}
        accessibilityRole="link"
      >
        {headline}
      </Text>
      <View style={styles.metaRow}>
        <View style={styles.sourcePill}>
          <Text style={styles.sourceText}>{sourceName}</Text>
        </View>
        <View style={styles.typePill}>
          <Text style={styles.typeText}>{formatSourceType(sourceType)}</Text>
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
};

const formatSourceType = (t: SourceType): string => {
  const v = String(t || '').trim();
  if (!v) return 'Source';
  const lower = v.toLowerCase();
  switch (lower) {
    case 'tv':
      return 'TV';
    case 'news':
      return 'News';
    default:
      return v.charAt(0).toUpperCase() + v.slice(1);
  }
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: surface_white_color,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: text_primary_brown_color,
  },
  headline: {
    fontSize: 18,
    lineHeight: 24,
    color: text_dark_gray_color,
    fontFamily: 'Patrick Hand',
  },
  metaRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourcePill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: text_primary_brown_color,
    backgroundColor: surface_white_color,
  },
  sourceText: {
    fontSize: 14,
    color: text_primary_brown_color,
    fontFamily: 'Patrick Hand',
    fontWeight: '700',
  },
  typePill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: text_primary_brown_color,
    backgroundColor: background_cream_color,
  },
  typeText: {
    fontSize: 14,
    color: text_muted_gray_color,
    fontFamily: 'Patrick Hand',
    fontWeight: '600',
  },
});


