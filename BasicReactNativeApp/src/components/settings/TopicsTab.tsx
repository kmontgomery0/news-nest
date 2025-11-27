import React, {useState} from 'react';
import {View, Text, TouchableOpacity, Image, TextInput} from 'react-native';
import {settingsStyles} from '../../styles/settingsStyles';
import {BIRDS, Bird} from '../../constants/birds';
import {homeStyles} from '../../styles/homeStyles';
import {conversationStyles} from '../../styles/conversationStyles';
import {text_dark_gray_color} from '../../styles/colors';

interface TopicsTabProps {
  selectedBirdIds: string[];
  onBirdToggle: (birdId: string) => void;
  parrotName?: string;
  onParrotNameChange?: (name: string) => void;
  onSaveParrotName?: () => void;
  onSave?: () => void;
}

export const TopicsTab: React.FC<TopicsTabProps> = ({
  selectedBirdIds,
  onBirdToggle,
  parrotName = 'Polly',
  onParrotNameChange,
  onSaveParrotName,
  onSave,
}) => {
  const [isParrotNameEdited, setIsParrotNameEdited] = useState(false);

  const handleParrotNameFocus = () => {
    setIsParrotNameEdited(true);
  };

  const handleSaveParrotName = () => {
    setIsParrotNameEdited(false);
    onSaveParrotName?.();
  };
  // Get all birds except Polly (Polly is always available)
  const selectableBirds = BIRDS.filter(b => b.id !== 'polly');
  const polly = BIRDS.find(b => b.id === 'polly')!;

  const isBirdSelected = (birdId: string) => {
    return selectedBirdIds.includes(birdId);
  };

  const handleBirdPress = (birdId: string) => {
    onBirdToggle(birdId);
  };

  return (
    <View style={settingsStyles.tabContent}>
      <View style={settingsStyles.section}>
        {/* Rename Parrot Section */}
        <View style={settingsStyles.parrotRenameSection}>
          <View style={settingsStyles.inputGroup}>
            <Text style={settingsStyles.label}>Rename your parrot</Text>
            <View style={settingsStyles.parrotRenameRow}>
            <View style={conversationStyles.parrotAvatar}>
              <Image
                source={polly.image}
                resizeMode="cover"
                style={[
                  conversationStyles.avatarImage,
                  {
                    left: 5,
                    top: 2,
                  },
                ]}
              />
            </View>
            <TextInput
              style={[
                settingsStyles.parrotNameInput,
                !isParrotNameEdited && settingsStyles.inputInactive,
              ]}
              value={parrotName}
              onChangeText={onParrotNameChange}
              placeholder="Parrot's name"
              placeholderTextColor={text_dark_gray_color}
              onFocus={handleParrotNameFocus}
              onBlur={() => {}}
            />
            <TouchableOpacity
              style={settingsStyles.parrotNameSaveButton}
              onPress={handleSaveParrotName}>
              <Text style={settingsStyles.parrotNameSaveButtonText}>Save</Text>
            </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={settingsStyles.inputGroup}>
          <Text style={settingsStyles.label}>Select your favorite nests</Text>
          <View style={homeStyles.birdGrid}>
          {selectableBirds.map(bird => {
            const isSelected = isBirdSelected(bird.id);
            return (
              <TouchableOpacity
                key={bird.id}
                style={[
                  homeStyles.birdCard,
                  isSelected && {
                    borderColor: '#4CAF50',
                    borderWidth: 3,
                  },
                ]}
                onPress={() => handleBirdPress(bird.id)}
                activeOpacity={0.8}>
                <View style={homeStyles.birdImageContainer}>
                  <Image
                    source={bird.image}
                    resizeMode="cover"
                    style={homeStyles.birdImage}
                  />
                </View>
                <Text style={homeStyles.birdName}>{bird.name}</Text>
                <Text style={homeStyles.birdCategory}>{bird.category}</Text>
                {isSelected && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: '#4CAF50',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: '#FFFFFF',
                    }}>
                    <Text style={{color: '#FFFFFF', fontSize: 18}}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          </View>
        </View>
        <TouchableOpacity style={settingsStyles.saveButton} onPress={onSave}>
          <Text style={settingsStyles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
