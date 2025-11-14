import React from 'react';
import {View, Text} from 'react-native';
import {headerStyles} from '../styles/headerStyles';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'News Nest',
  subtitle = 'AI-Powered News Conversation',
}) => {
  return (
    <View style={headerStyles.header}>
      <Text style={headerStyles.headerTitle}>{title}</Text>
      {subtitle && <Text style={headerStyles.headerSubtitle}>{subtitle}</Text>}
    </View>
  );
};

