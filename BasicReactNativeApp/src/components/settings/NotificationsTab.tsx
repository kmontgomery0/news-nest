import React from 'react';
import {View, Text, TouchableOpacity, Switch} from 'react-native';
import {settingsStyles} from '../../styles/settingsStyles';

interface NotificationsTabProps {
  selectedTime: string;
  frequency: string;
  pushNotifications: boolean;
  emailSummaries: boolean;
  dontPersonalize: boolean;
  allowChatHistory: boolean;
  showTimeDropdown: boolean;
  showFrequencyDropdown: boolean;
  timeOptions: string[];
  frequencyOptions: string[];
  onTimeDropdownToggle: () => void;
  onFrequencyDropdownToggle: () => void;
  onTimeSelect: (time: string) => void;
  onFrequencySelect: (freq: string) => void;
  onPushNotificationsChange: (value: boolean) => void;
  onEmailSummariesChange: (value: boolean) => void;
  onDontPersonalizeChange: (value: boolean) => void;
  onAllowChatHistoryChange: (value: boolean) => void;
}

export const NotificationsTab: React.FC<NotificationsTabProps> = ({
  selectedTime,
  frequency,
  pushNotifications,
  emailSummaries,
  dontPersonalize,
  allowChatHistory,
  showTimeDropdown,
  showFrequencyDropdown,
  timeOptions,
  frequencyOptions,
  onTimeDropdownToggle,
  onFrequencyDropdownToggle,
  onTimeSelect,
  onFrequencySelect,
  onPushNotificationsChange,
  onEmailSummariesChange,
  onDontPersonalizeChange,
  onAllowChatHistoryChange,
}) => {
  return (
    <View style={settingsStyles.tabContent}>
      <View style={settingsStyles.section}>
        <View style={settingsStyles.inputGroup}>
          <Text style={settingsStyles.label}>Preferred Chat Time</Text>
          <TouchableOpacity
            style={[settingsStyles.dropdown, settingsStyles.inputInactive]}
            onPress={onTimeDropdownToggle}>
            <Text style={settingsStyles.dropdownText}>{selectedTime}</Text>
            <Text style={settingsStyles.dropdownArrow}>
              {showTimeDropdown ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
          {showTimeDropdown && (
            <View style={settingsStyles.dropdownOptions}>
              {timeOptions.map(option => (
                <TouchableOpacity
                  key={option}
                  style={[
                    settingsStyles.dropdownOption,
                    selectedTime === option && settingsStyles.dropdownOptionSelected,
                  ]}
                  onPress={() => onTimeSelect(option)}>
                  <Text
                    style={[
                      settingsStyles.dropdownOptionText,
                      selectedTime === option && settingsStyles.dropdownOptionTextSelected,
                    ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={settingsStyles.inputGroup}>
          <Text style={settingsStyles.label}>Frequency</Text>
          <TouchableOpacity
            style={[settingsStyles.dropdown, settingsStyles.inputInactive]}
            onPress={onFrequencyDropdownToggle}>
            <Text style={settingsStyles.dropdownText}>{frequency}</Text>
            <Text style={settingsStyles.dropdownArrow}>
              {showFrequencyDropdown ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
          {showFrequencyDropdown && (
            <View style={settingsStyles.dropdownOptions}>
              {frequencyOptions.map(option => (
                <TouchableOpacity
                  key={option}
                  style={[
                    settingsStyles.dropdownOption,
                    frequency === option && settingsStyles.dropdownOptionSelected,
                  ]}
                  onPress={() => onFrequencySelect(option)}>
                  <Text
                    style={[
                      settingsStyles.dropdownOptionText,
                      frequency === option && settingsStyles.dropdownOptionTextSelected,
                    ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={settingsStyles.sectionDivider} />

        <View style={settingsStyles.inputGroup}>
          <Text style={[settingsStyles.label, {fontWeight: '700'}]}>Delivery</Text>
          <View style={settingsStyles.toggleRow}>
            <Text style={settingsStyles.toggleLabel}>Push Notifications</Text>
            <Switch
              value={pushNotifications}
              onValueChange={onPushNotificationsChange}
              trackColor={{false: '#767577', true: '#4CAF50'}}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={settingsStyles.toggleRow}>
            <Text style={settingsStyles.toggleLabel}>Email Summaries</Text>
            <Switch
              value={emailSummaries}
              onValueChange={onEmailSummariesChange}
              trackColor={{false: '#767577', true: '#4CAF50'}}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={settingsStyles.sectionDivider} />

        <View style={settingsStyles.inputGroup}>
          <Text style={[settingsStyles.label, {fontWeight: '700'}]}>Privacy</Text>
          <View style={settingsStyles.toggleRow}>
            <Text style={settingsStyles.toggleLabel}>
              Don't personalize my news topics automatically
            </Text>
            <Switch
              value={dontPersonalize}
              onValueChange={onDontPersonalizeChange}
              trackColor={{false: '#767577', true: '#4CAF50'}}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={settingsStyles.toggleRow}>
            <Text style={settingsStyles.toggleLabel}>
              Allow my chat history to improve recommendations
            </Text>
            <Switch
              value={allowChatHistory}
              onValueChange={onAllowChatHistoryChange}
              trackColor={{false: '#767577', true: '#4CAF50'}}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
        <TouchableOpacity style={settingsStyles.saveButton}>
          <Text style={settingsStyles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

