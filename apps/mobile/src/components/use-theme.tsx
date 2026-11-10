import { createContext, type ReactNode, useContext } from 'react';
import { useColorScheme, View } from 'react-native';

import { palette, radius, shadow, space, type, type ThemeColors } from './theme';

type Scheme = 'light' | 'dark';

// Set by ThemeScope. When null, the phone's own light or dark setting is used.
const ThemeScopeContext = createContext<Scheme | null>(null);

export interface AppTheme {
  colors: ThemeColors;
  space: typeof space;
  radius: typeof radius;
  type: typeof type;
  shadow: typeof shadow;
  dark: boolean;
}

// Forces light or dark colours for the content inside it (used by the dev screen).
export function ThemeScope({ scheme, children }: { scheme: Scheme; children: ReactNode }) {
  return (
    <ThemeScopeContext.Provider value={scheme}>
      <View style={{ backgroundColor: palette[scheme].background, padding: space.lg, borderRadius: radius.md }}>{children}</View>
    </ThemeScopeContext.Provider>
  );
}

// Gives colours, spacing and text styles that match the phone light or dark setting.
export function useTheme(): AppTheme {
  const scope = useContext(ThemeScopeContext);
  const device = useColorScheme();
  const dark = (scope ?? device) === 'dark';
  return { colors: dark ? palette.dark : palette.light, space, radius, type, shadow, dark };
}
