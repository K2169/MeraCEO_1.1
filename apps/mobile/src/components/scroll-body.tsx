import { type ReactNode, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { useTheme } from './use-theme';

// A scrolling area with its own always-visible scrollbar. The bar only appears when the content
// is taller than the space it has, so short steps look clean and long ones clearly show that
// there is more below. It draws the same on Android and iOS.
export function ScrollBody({ children }: { children: ReactNode }) {
  const { colors, space } = useTheme();
  const [viewHeight, setViewHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollY, setScrollY] = useState(0);

  // Only draw the bar when there is something to scroll to.
  const overflows = contentHeight > viewHeight + 1 && viewHeight > 0;
  // The thumb is as tall as the visible share of the content, with a minimum so it stays easy to see.
  const thumbHeight = overflows ? Math.max(48, (viewHeight * viewHeight) / contentHeight) : 0;
  // Its position follows how far down the content is scrolled.
  const maxScroll = Math.max(1, contentHeight - viewHeight);
  const thumbTop = overflows ? Math.min(1, Math.max(0, scrollY / maxScroll)) * (viewHeight - thumbHeight) : 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onLayout={(e) => setViewHeight(e.nativeEvent.layout.height)}
        onContentSizeChange={(_, h) => setContentHeight(h)}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
      >
        {children}
      </ScrollView>
      {overflows ? (
        // The track sits in the page margin to the right of the content, so it never covers a field.
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, right: -space.md, width: 6, borderRadius: 3, backgroundColor: colors.border }}>
          <View style={{ position: 'absolute', top: thumbTop, height: thumbHeight, width: 6, borderRadius: 3, backgroundColor: colors.primary }} />
        </View>
      ) : null}
    </View>
  );
}
