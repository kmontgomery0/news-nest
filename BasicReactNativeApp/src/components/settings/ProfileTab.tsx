import React, {useState} from 'react';
import {View, Text, TextInput, TouchableOpacity} from 'react-native';
import {settingsStyles} from '../../styles/settingsStyles';

interface ProfileTabProps {
  name: string;
  email: string;
  password: string;
  day: string;
  month: string;
  year: string;
  onNameChange: (text: string) => void;
  onEmailChange: (text: string) => void;
  onPasswordChange: (text: string) => void;
  onDayChange: (text: string) => void;
  onMonthChange: (text: string) => void;
  onYearChange: (text: string) => void;
  onSave?: () => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  name,
  email,
  password,
  day,
  month,
  year,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onDayChange,
  onMonthChange,
  onYearChange,
  onSave,
}) => {
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [editedInputs, setEditedInputs] = useState<Set<string>>(new Set());

  const handleInputFocus = (inputName: string) => {
    setFocusedInput(inputName);
    setEditedInputs(prev => new Set(prev).add(inputName));
  };

  const handleSave = () => {
    setFocusedInput(null);
    setEditedInputs(new Set());
    onSave?.();
  };
  return (
    <View style={settingsStyles.tabContent}>
      <View style={settingsStyles.section}>
        <View style={settingsStyles.inputGroup}>
          <Text style={settingsStyles.label}>Name</Text>
          <TextInput
            style={[
              settingsStyles.input,
              !editedInputs.has('name') && settingsStyles.inputInactive,
            ]}
            value={name}
            onChangeText={onNameChange}
            placeholder="Name"
            onFocus={() => handleInputFocus('name')}
            onBlur={() => setFocusedInput(null)}
          />
        </View>

        <View style={settingsStyles.inputGroup}>
          <Text style={settingsStyles.label}>Email</Text>
          <TextInput
            style={[
              settingsStyles.input,
              !editedInputs.has('email') && settingsStyles.inputInactive,
            ]}
            value={email}
            onChangeText={onEmailChange}
            placeholder="Email"
            editable={false}
            selectTextOnFocus={false}
            onFocus={() => {}}
            onBlur={() => setFocusedInput(null)}
          />
        </View>

        <View style={settingsStyles.inputGroup}>
          <Text style={settingsStyles.label}>Password</Text>
          <TextInput
            style={[
              settingsStyles.input,
              !editedInputs.has('password') && settingsStyles.inputInactive,
            ]}
            value={password}
            onChangeText={onPasswordChange}
            placeholder="New password"
            secureTextEntry
            onFocus={() => handleInputFocus('password')}
            onBlur={() => setFocusedInput(null)}
          />
        </View>

        <View style={settingsStyles.inputGroup}>
          <Text style={settingsStyles.label}>Date of Birth</Text>
          <View style={settingsStyles.dateInputContainer}>
            <TextInput
              style={[
                settingsStyles.input,
                settingsStyles.dateInput,
                !editedInputs.has('day') && settingsStyles.inputInactive,
              ]}
              value={day}
              onChangeText={onDayChange}
              placeholder="DD"
              keyboardType="numeric"
              onFocus={() => handleInputFocus('day')}
              onBlur={() => setFocusedInput(null)}
            />
            <TextInput
              style={[
                settingsStyles.input,
                settingsStyles.dateInput,
                !editedInputs.has('month') && settingsStyles.inputInactive,
              ]}
              value={month}
              onChangeText={onMonthChange}
              placeholder="MM"
              keyboardType="numeric"
              onFocus={() => handleInputFocus('month')}
              onBlur={() => setFocusedInput(null)}
            />
            <TextInput
              style={[
                settingsStyles.input,
                settingsStyles.dateInput,
                !editedInputs.has('year') && settingsStyles.inputInactive,
              ]}
              value={year}
              onChangeText={onYearChange}
              placeholder="YYYY"
              keyboardType="numeric"
              onFocus={() => handleInputFocus('year')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>
        </View>
        <TouchableOpacity style={settingsStyles.saveButton} onPress={handleSave}>
          <Text style={settingsStyles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

