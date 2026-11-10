import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { Icon } from './icon';
import { useTheme } from './use-theme';

// First letters of the first two words of a name.
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

// A round picture of a person (or a business logo). Without a picture it shows their initials.
export function Avatar({ name, url, size = 48, icon = 'person' }: { name: string; url?: string | null; size?: number; icon?: 'person' | 'business' }) {
  const { colors, type } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: size, height: size }} contentFit="cover" transition={150} accessibilityLabel={name} />
      ) : !initials(name) ? (
        <Icon name={icon} size={Math.round(size * 0.5)} color={colors.primary} />
      ) : (
        <Text style={[type.heading, { color: colors.primary, fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.44) }]}>{initials(name)}</Text>
      )}
    </View>
  );
}
