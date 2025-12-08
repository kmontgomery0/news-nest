import React from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {TimelineData} from '../types';
import {text_primary_brown_color, accent_indigo_light_color} from '../styles/colors';

interface TimelineProps {
  timelineData: TimelineData;
}

export const Timeline: React.FC<TimelineProps> = ({timelineData}) => {
  const {title, events, description} = timelineData;

  if (!events || events.length === 0) {
    return null;
  }

  // Sort events by date
  const sortedEvents = [...events].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      
      <ScrollView style={styles.timelineContainer} showsVerticalScrollIndicator={false}>
        {sortedEvents.map((event, index) => (
          <View key={index} style={styles.eventContainer}>
            {/* Timeline line */}
            {index < sortedEvents.length - 1 && (
              <View style={styles.timelineLine} />
            )}
            
            {/* Timeline dot */}
            <View style={styles.timelineDot}>
              <View style={styles.timelineDotInner} />
            </View>
            
            {/* Event content */}
            <View style={styles.eventContent}>
              <View style={styles.eventHeader}>
                <Text style={styles.eventDate}>{formatDate(event.date)}</Text>
                {event.category && (
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{event.category}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.eventTitle}>{event.title}</Text>
              {event.description && (
                <Text style={styles.eventDescription}>{event.description}</Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    maxHeight: 400,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: text_primary_brown_color,
    marginBottom: 4,
    fontFamily: 'Patrick Hand',
  },
  description: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    fontFamily: 'Patrick Hand',
  },
  timelineContainer: {
    flex: 1,
  },
  eventContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    paddingLeft: 20,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 7,
    top: 20,
    width: 2,
    height: '100%',
    backgroundColor: accent_indigo_light_color,
    opacity: 0.3,
  },
  timelineDot: {
    position: 'absolute',
    left: 0,
    top: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: accent_indigo_light_color,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  timelineDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: accent_indigo_light_color,
  },
  eventContent: {
    flex: 1,
    marginLeft: 8,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 12,
    fontWeight: '600',
    color: accent_indigo_light_color,
    fontFamily: 'Patrick Hand',
    marginRight: 8,
  },
  categoryBadge: {
    backgroundColor: accent_indigo_light_color,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 9,
    color: '#fff',
    fontFamily: 'Patrick Hand',
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: text_primary_brown_color,
    marginBottom: 4,
    fontFamily: 'Patrick Hand',
  },
  eventDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    fontFamily: 'Patrick Hand',
  },
});

