import { Text, TextInput, View } from 'react-native';

import { useTheme } from './use-theme';

interface InputProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string;
  helper?: string; // short guidance shown under the field when there is no error
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'number-pad' | 'phone-pad' | 'url' | 'email-address';
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words';
}

// A friendly text field: label above, big rounded box, red message when something is wrong.
export function Input({ label, value, onChangeText, placeholder, error, helper, multiline = false, keyboardType = 'default', autoCapitalize, maxLength }: InputProps) {
  const { colors, radius, space, type } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <Text style={[type.caption, { color: colors.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        style={{
          fontSize: 17,
          color: colors.text,
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: error ? colors.danger : colors.border,
          borderRadius: radius.md,
          paddingHorizontal: space.lg,
          paddingVertical: space.sm,
          minHeight: multiline ? 96 : 52,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
      {error ? <Text style={[type.caption, { color: colors.danger }]}>{error}</Text> : helper ? <Text style={[type.caption, { color: colors.muted, fontFamily: 'DMSans_500Medium' }]}>{helper}</Text> : null}
    </View>
  );
}
