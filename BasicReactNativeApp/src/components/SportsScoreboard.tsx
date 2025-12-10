import React from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity} from 'react-native';
import {SportsGame, SportsGameStatus} from '../types';
import {text_primary_brown_color} from '../styles/colors';

interface Props {
  title: string;
  games: SportsGame[];
}

const statusLabel = (status: SportsGameStatus): string => {
  if (status === 'live') return 'LIVE';
  if (status === 'past') return 'Final';
  return 'Upcoming';
};

const SportsScoreboard: React.FC<Props> = ({title, games}) => {
  if (!games || games.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{title}</Text>
      <View style={styles.divider} />
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}>
        {games.map(game => (
          <TouchableOpacity key={game.id} style={styles.card} activeOpacity={0.9}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.dateText}>{game.date || ''}</Text>
                {game.timeLocal ? (
                  <Text style={styles.timeText}>{game.timeLocal}</Text>
                ) : null}
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>
                  {statusLabel(game.status)}
                </Text>
              </View>
            </View>

            <View style={styles.teamsRow}>
              <View style={styles.teamSide}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {game.homeTeam.shortName?.[0] ?? '?'}
                  </Text>
                </View>
                <Text style={styles.teamName}>{game.homeTeam.name}</Text>
              </View>

              <Text style={styles.scoreText}>
                {(game.homeScore ?? '-').toString()}-
                {(game.awayScore ?? '-').toString()}
              </Text>

              <View style={styles.teamSide}>
                <Text style={styles.teamName}>{game.awayTeam.name}</Text>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {game.awayTeam.shortName?.[0] ?? '?'}
                  </Text>
                </View>
              </View>
            </View>

            {game.venueName ? (
              <Text style={styles.venueText}>{game.venueName}</Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const CARD_RADIUS = 18;

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  header: {
    fontSize: 20,
    fontWeight: '700',
    color: text_primary_brown_color,
    marginBottom: 6,
    fontFamily: 'Patrick Hand',
  },
  divider: {
    height: 2,
    backgroundColor: '#222',
    marginBottom: 12,
  },
  list: {
    maxHeight: 420,
  },
  listContent: {
    paddingBottom: 8,
    rowGap: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 3},
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 12,
    color: '#555',
    fontFamily: 'Patrick Hand',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'Patrick Hand',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFE1E1',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D32F2F',
    fontFamily: 'Patrick Hand',
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamSide: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4C5A92',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  teamName: {
    fontSize: 14,
    color: text_primary_brown_color,
    fontFamily: 'Patrick Hand',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '700',
    color: text_primary_brown_color,
    fontFamily: 'Patrick Hand',
  },
  venueText: {
    marginTop: 6,
    fontSize: 11,
    color: '#777',
    fontFamily: 'Patrick Hand',
  },
});

export {SportsScoreboard};

