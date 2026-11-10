import { Text, View } from 'react-native';

import { IconBubble } from './icon-bubble';
import { type IconName } from './icon';
import { useTheme } from './use-theme';

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  body: string;
}

// A quiet message for a screen with nothing to show yet: a small icon, a short title and one line of help.
export function EmptyState({ icon = 'sparkles-outline', title, body }: EmptyStateProps) {
  const { colors, space, type } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: space.sm, paddingTop: space.xxl, paddingHorizontal: space.lg }}>
      <IconBubble icon={icon} size={56} />
      <Text style={[type.heading, { color: colors.text, textAlign: 'center', marginTop: space.xs }]}>{title}</Text>
      <Text style={[type.body, { color: colors.muted, textAlign: 'center', maxWidth: 300 }]}>{body}</Text>
    </View>
  );
}
