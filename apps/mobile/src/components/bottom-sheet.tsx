import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard, Modal, PanResponder, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from './use-theme';

// Pulling the sheet down further than this closes it.
const CLOSE_DISTANCE = 120;
// A quick downward flick also closes it.
const CLOSE_SPEED = 0.8;

// A bottom sheet that follows the finger. Drag the top part (handle and title) down to close it.
// Tapping the dimmed background also closes it. Let go early and it springs back up.
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const { colors, radius, space, type } = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(false);
  const [height, setHeight] = useState(600);
  // Height of the on-screen keyboard (0 when hidden). The sheet sits above it, so a search box stays visible.
  const [keyboard, setKeyboard] = useState(0);
  // How far the sheet is pushed down. 0 means fully open.
  const offset = useRef(new Animated.Value(600)).current;

  // Keep the latest close function available to the gesture handler.
  const closeRef = useRef<() => void>(() => undefined);

  // Slide the sheet back up into place.
  function springOpen() {
    Animated.spring(offset, { toValue: 0, friction: 9, tension: 70, useNativeDriver: true }).start();
  }

  // Slide the sheet off the bottom, then tell the parent it is closed.
  function animateClosed() {
    Animated.timing(offset, { toValue: height, duration: 220, useNativeDriver: true }).start(() => {
      setMounted(false);
      onClose();
    });
  }
  closeRef.current = animateClosed;

  // Track the keyboard so the sheet can sit above it.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // When the parent opens the sheet, mount it and slide it up. When the parent closes it
  // (for example after an option is picked), slide it down and remove it.
  useEffect(() => {
    if (visible) {
      offset.setValue(height);
      setMounted(true);
    } else if (mounted) {
      Animated.timing(offset, { toValue: height, duration: 220, useNativeDriver: true }).start(() => setMounted(false));
    }
  }, [visible]);

  // Once mounted, slide up into view.
  useEffect(() => {
    if (mounted) springOpen();
  }, [mounted]);

  // Handles the drag on the top part of the sheet.
  const pan = useMemo(
    () =>
      PanResponder.create({
        // The drag area has nothing to tap, so claim the touch straight away.
        onStartShouldSetPanResponder: () => true,
        // Only start a drag when the finger moves mostly up or down.
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        // Follow the finger, but never above the open position.
        onPanResponderMove: (_, g) => offset.setValue(Math.max(0, g.dy)),
        // Decide on release: close if pulled far or flicked down, otherwise spring back.
        onPanResponderRelease: (_, g) => {
          if (g.dy > CLOSE_DISTANCE || g.vy > CLOSE_SPEED) closeRef.current();
          else springOpen();
        },
        onPanResponderTerminate: () => springOpen(),
      }),
    [],
  );

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={() => closeRef.current()}>
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: keyboard, backgroundColor: 'rgba(0,0,0,0.35)' }}>
        {/* Tapping the dim area closes the sheet. The dim covers the whole screen, corners included. */}
        <Pressable style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} onPress={() => closeRef.current()} />

        <Animated.View
          onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: space.xl,
            paddingBottom: insets.bottom + space.xl,
            maxHeight: '75%',
            transform: [{ translateY: offset }],
          }}
        >
          {/* Drag area: the handle and the title. Pulling here moves the whole sheet. */}
          {/* collapsable={false} keeps this view real on Android, so it can receive touches. */}
          <View {...pan.panHandlers} collapsable={false} style={{ paddingTop: space.sm, paddingBottom: space.md }}>
            <View style={{ alignSelf: 'center', width: 48, height: 6, borderRadius: 3, backgroundColor: colors.border, marginBottom: space.lg }} />
            <Text style={[type.heading, { color: colors.text }]}>{title}</Text>
          </View>

          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
