import React from 'react';
// Header intentionally renders nothing (app-level header removed)
// Keep file to avoid import errors where Header is used.
// If you want a header again, implement it here and use across screens.
import {View, Text} from 'react-native';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = () => null;

