import { Text, View } from 'react-native';

import { Icon, type IconName } from './icon';
import { PressSurface } from './press-surface';
import { useTheme } from './use-theme';

interface ChoiceCardProps {
  icon: IconName;
  title: string;
  body: string;
  points: string[]; // short list of what the person gets, each shown with a tick
  color: 'blue' | 'green';
  onPress: () => void;
}

// A big solid colour card, flat like the buttons. It shows a title, one line of
// explanation and a short tick list, so people can tell the two roles apart at a glance.
export function ChoiceCard({ icon, title, body, points, color, onPress }: ChoiceCardProps) {
  const { colors, radius, space, type } = useTheme();
  const isBlue = color === 'blue';
  const text = isBlue ? colors.primaryText : colors.solidText;

  return (
    <PressSurface
      face={isBlue ? colors.primary : colors.solidGreen}
      radius={radius.lg}
      onPress={onPress}
      style={{ padding: space.lg }}
    >
      <View style={{ gap: space.md }}>
        {/* Icon, title and a forward arrow that says "tap to choose" */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={26} color={text} />
          </View>
          <Text style={[type.heading, { color: text, flex: 1 }]}>{title}</Text>
          <Icon name="arrow-forward" size={24} color={text} />
        </View>

        <Text style={[type.body, { color: text, opacity: 0.92 }]}>{body}</Text>

        {/* Thin divider, then the tick list */}
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.28)' }} />
        <View style={{ gap: space.sm }}>
          {points.map((point) => (
            <View key={point} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Icon name="checkmark-circle" size={20} color={text} />
              <Text style={[type.caption, { color: text, flex: 1, fontFamily: 'DMSans_500Medium' }]}>{point}</Text>
            </View>
          ))}
        </View>
      </View>
    </PressSurface>
  );
}
