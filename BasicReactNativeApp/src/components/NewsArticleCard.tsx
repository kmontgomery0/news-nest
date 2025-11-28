import React from 'react';
import {TouchableOpacity, View, Text, StyleSheet, ViewStyle, Linking} from 'react-native';
import {
  surface_white_color,
  text_primary_brown_color,
  text_dark_gray_color,
} from '../styles/colors';

interface NewsArticleCardProps {
  headline: string;
  sourceName: string;
  tags?: string[];
  onPress?: () => void;
  style?: ViewStyle;
  articleUrl?: string;
}

export const NewsArticleCard: React.FC<NewsArticleCardProps> = ({
  headline,
  sourceName,
  tags,
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
        <Text style={styles.sourceInline}>{sourceName}</Text>
        {': '}
        {headline}
      </Text>
      {!!tags && tags.length > 0 ? (
        <View style={styles.tagsRow}>
          {tags.map((t, idx) => (
            <View style={styles.tagPill} key={`${t}-${idx}`}>
              <Text style={styles.tagText}>{String(t || '').trim()}</Text>
            </View>
          ))}
        </View>
      ) : null}
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
  sourceInline: {
    fontWeight: '700',
    color: text_dark_gray_color,
    fontFamily: 'Patrick Hand',
  },
  tagsRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: text_primary_brown_color,
    backgroundColor: surface_white_color,
  },
  tagText: {
    fontSize: 13,
    color: text_dark_gray_color,
    fontFamily: 'Patrick Hand',
    fontWeight: '600',
  },
});


