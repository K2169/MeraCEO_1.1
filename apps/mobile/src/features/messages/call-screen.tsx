import { useAudioPlayer } from 'expo-audio';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Vibration, PermissionsAndroid, Platform, Pressable, Text, View, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
  RenderModeType,
  RtcSurfaceView,
  type IRtcEngine,
} from 'react-native-agora';

import { Avatar } from '@/components/avatar';
import { Icon, type IconName } from '@/components/icon';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { t } from '@/i18n';
import { api, type CallInvitation, type RequestItem } from '@/lib/api';

function CallControl({
  label,
  icon,
  onPress,
  color,
  surface,
  borderRadius,
  textStyle,
  disabled,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  color: string;
  surface: string;
  borderRadius: number;
  textStyle: TextStyle;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius, backgroundColor: surface, opacity: disabled ? 0.45 : pressed ? 0.7 : 1 })}>
        <View style={{ transform: [{ rotate: icon === 'call-outline' ? '135deg' : '0deg' }] }}>
          <Icon name={icon} size={24} color={color} />
        </View>
      </Pressable>
      <Text numberOfLines={2} style={[textStyle, { color: colors.text, textAlign: 'center', minHeight: 32 }]}>{label}</Text>
    </View>
  );
}

export function CallScreen() {
  const { requestId, callId } = useLocalSearchParams<{ requestId: string; callId: string }>();
  const { colors, radius, space, type } = useTheme();
  const { token, user } = useSession();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const ringtone = useAudioPlayer(require('../../../assets/incoming-call.wav'));
  const engine = useRef<IRtcEngine | null>(null);
  const joining = useRef(false);
  const [rtcEngine, setRtcEngine] = useState<IRtcEngine | null>(null);
  const [call, setCall] = useState<CallInvitation | null>(null);
  const [request, setRequest] = useState<RequestItem | null>(null);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanupEngine = useCallback(() => {
    const activeEngine = engine.current;
    if (!activeEngine) return;
    engine.current = null;
    activeEngine.removeAllListeners();
    activeEngine.leaveChannel();
    activeEngine.release();
  }, []);

  useEffect(() => () => cleanupEngine(), [cleanupEngine]);

  useEffect(() => {
    if (!token || !requestId || !callId) return;
    let live = true;
    const load = async () => {
      try {
        const [active, thread] = await Promise.all([
          api.getActiveCall(token, requestId),
          api.getMessages(token, requestId),
        ]);
        if (!live) return;
        setRequest(thread.request);
        if (!active.call || active.call.id !== callId) {
          setEnded(true);
          cleanupEngine();
        } else setCall(active.call);
      } catch { if (live) setError(t('call.failed')); }
      finally { if (live) setLoading(false); }
    };
    void load();
    const interval = setInterval(() => {
      void api.getActiveCall(token, requestId).then(({ call: active }) => {
        if (!live) return;
        if (!active || active.id !== callId) {
          setEnded(true);
          cleanupEngine();
          return;
        }
        setCall(active);
      }).catch(() => undefined);
    }, 2500);
    return () => { live = false; clearInterval(interval); };
  }, [callId, cleanupEngine, requestId, token]);

  const otherName = user?.id === call?.callerId
    ? (user?.role === 'owner' ? request?.professional?.name : request?.owner?.businessName)
    : (user?.role === 'owner' ? request?.professional?.name : request?.owner?.businessName);
  const isIncoming = Boolean(call && user?.id === call.recipientId && call.status === 'ringing');

  // Ring only while the incoming screen is visible; always stop on exit or response.
  useEffect(() => {
    if (!isIncoming || ended || busy) return;
    const ring = () => {
      if (AppState.currentState === 'active') {
        Vibration.vibrate([0, 500, 800], true);
        // Expo Audio exposes looping as a mutable native-player property.
        // eslint-disable-next-line react-hooks/immutability
        ringtone.loop = true;
        ringtone.play();
      }
    };
    ring();
    const subscription = AppState.addEventListener('change', (state) => {
      Vibration.cancel();
      ringtone.pause();
      if (state === 'active') ring();
    });
    return () => { Vibration.cancel(); ringtone.pause(); subscription.remove(); };
  }, [isIncoming, ended, busy, ringtone]);

  const joinCall = useCallback(async () => {
    if (!token || !call || !user || joining.current || engine.current) return;
    joining.current = true;
    setBusy(true);
    setError(null);
    try {
      if (Platform.OS === 'android') {
        const permissions = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
        if (Object.values(permissions).some((status) => status !== PermissionsAndroid.RESULTS.GRANTED)) {
          setError(t('call.permissionDenied'));
          return;
        }
      }
      const credentials = await api.getCallCredentials(token, requestId, call.id);
      const rtc = createAgoraRtcEngine();
      engine.current = rtc;
      setRtcEngine(rtc);
      rtc.addListener('onJoinChannelSuccess', () => setJoined(true));
      rtc.addListener('onUserJoined', (_connection, uid) => setRemoteUid(uid));
      rtc.addListener('onUserOffline', () => setRemoteUid(null));
      rtc.addListener('onError', () => setError(t('call.failed')));
      rtc.initialize({ appId: credentials.appId });
      rtc.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);
      rtc.enableAudio();
      rtc.enableVideo();
      rtc.startPreview();
      rtc.joinChannel(credentials.token, credentials.channelName, credentials.uid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishCameraTrack: true,
        publishMicrophoneTrack: true,
        autoSubscribeAudio: true,
        autoSubscribeVideo: true,
      });
    } catch {
      cleanupEngine();
      setError(t('call.failed'));
    } finally {
      joining.current = false;
      setBusy(false);
    }
  }, [call, cleanupEngine, requestId, token, user]);

  useEffect(() => {
    if (!call || ended || !user) return;
    const callerMayJoin = call.status === 'ringing' && call.callerId === user.id;
    if (call.status !== 'accepted' && !callerMayJoin) return;
    const timeout = setTimeout(() => { void joinCall(); }, 0);
    return () => clearTimeout(timeout);
  }, [call, ended, joinCall, user]);

  const respond = async (action: 'accept' | 'decline' | 'end') => {
    if (!token || !call || busy) return;
    setBusy(true);
    try {
      await api.updateCall(token, requestId, call.id, action);
      if (action === 'decline' || action === 'end') {
        setEnded(true);
        cleanupEngine();
        router.back();
      } else {
        setCall({ ...call, status: 'accepted' });
      }
    } catch { setError(t('call.failed')); }
    finally { setBusy(false); }
  };

  const toggleMute = () => {
    const next = !muted;
    rtcEngine?.muteLocalAudioStream(next);
    setMuted(next);
  };
  const toggleCamera = () => {
    const next = !cameraOn;
    rtcEngine?.muteLocalVideoStream(!next);
    setCameraOn(next);
  };
  const flipCamera = () => { rtcEngine?.switchCamera(); };

  if (isIncoming && !ended) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl, gap: space.lg }}>
        <Avatar name={otherName ?? ''} url={null} size={88} icon="person" />
        <View style={{ alignItems: 'center', gap: space.xs }}>
          <Text accessibilityRole="header" style={[type.title, { color: colors.text }]}>{otherName || t('chat.conversation')}</Text>
          <Text style={[type.body, { color: colors.muted }]}>{t('call.incoming')}</Text>
        </View>
        {error ? <Text accessibilityRole="alert" style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>{error}</Text> : null}
        {/* Keep each action and its label together, with distinct answer/end symbols. */}
        <View style={{ alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-evenly', marginTop: space.xl, gap: space.lg }}>
          {(['decline', 'accept'] as const).map((action) => (
            <View key={action} style={{ alignItems: 'center', gap: space.sm }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(`call.${action}`)}
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={() => void respond(action)}
                style={({ pressed }) => ({ width: 72, height: 72, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: action === 'decline' ? colors.danger : colors.primary, opacity: busy ? 0.5 : pressed ? 0.75 : 1 })}
              >
                <View style={{ transform: [{ rotate: action === 'decline' ? '135deg' : '0deg' }] }}>
                  <Icon name="call-outline" size={28} color={colors.primaryText} />
                </View>
              </Pressable>
              <Text style={[type.body, { color: colors.text }]}>{t(`call.${action}`)}</Text>
            </View>
          ))}
        </View>
        {busy ? <ActivityIndicator color={colors.primary} /> : null}
      </View>
    );
  }

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>;

  if (ended || !call) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingHorizontal: space.xl, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
          {/* A quiet status treatment distinguishes a finished call from an incoming invitation. */}
          <View style={{ width: 104, height: 104, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ transform: [{ rotate: '135deg' }] }}>
              <Icon name="call-outline" size={40} color={colors.muted} />
            </View>
          </View>
          <View style={{ alignItems: 'center', gap: space.sm }}>
            <Text accessibilityRole="header" style={[type.title, { color: colors.text, textAlign: 'center' }]}>{t('call.ended')}</Text>
            {otherName ? <Text style={[type.body, { color: colors.muted, textAlign: 'center' }]}>{otherName}</Text> : null}
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={({ pressed }) => ({ minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.lg, borderRadius: radius.md, backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 })}>
          <Icon name="arrow-back" size={20} color={colors.primaryText} />
          <Text style={[type.body, { color: colors.primaryText, textAlign: 'center' }]}>{t('common.back')}</Text>
        </Pressable>
      </View>
    );
  }

  const callStatus = error || (joined ? t('call.connected') : call.status === 'ringing' ? t('call.outgoing') : t('call.joining'));
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, backgroundColor: colors.text }}>
        {remoteUid !== null ? (
          <RtcSurfaceView style={{ flex: 1 }} canvas={{ uid: remoteUid, renderMode: RenderModeType.RenderModeHidden }} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
            <Avatar name={otherName ?? ''} url={null} size={84} icon="person" />
            <Text style={[type.body, { color: colors.primaryText }]}>{callStatus}</Text>
          </View>
        )}
        {joined && cameraOn ? (
          <View style={{ position: 'absolute', top: insets.top + space.md, right: space.md, width: 112, height: 160, overflow: 'hidden', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}>
            <RtcSurfaceView style={{ flex: 1 }} canvas={{ uid: 0, renderMode: RenderModeType.RenderModeHidden }} zOrderMediaOverlay />
          </View>
        ) : null}
        <View style={{ position: 'absolute', top: insets.top + space.md, left: space.lg, right: 128, gap: 2 }}>
          <Text numberOfLines={1} style={[type.heading, { color: colors.primaryText }]}>{otherName || t('chat.conversation')}</Text>
          <Text style={[type.caption, { color: colors.primaryText, opacity: 0.8 }]}>{callStatus}</Text>
        </View>
      </View>
      <View style={{ paddingTop: space.lg, paddingBottom: Math.max(insets.bottom, space.md), paddingHorizontal: space.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
        {error ? <Text accessibilityRole="alert" style={[type.caption, { color: colors.danger, textAlign: 'center', marginBottom: space.sm }]}>{error}</Text> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', gap: space.xs }}>
          <CallControl label={t(muted ? 'call.unmute' : 'call.mute')} icon={muted ? 'mic-off-outline' : 'mic-outline'} onPress={toggleMute} color={colors.text} surface={muted ? colors.border : colors.surface} borderRadius={radius.pill} textStyle={type.footnote} disabled={busy} />
          <CallControl label={t(cameraOn ? 'call.cameraOn' : 'call.cameraOff')} icon="camera" onPress={toggleCamera} color={colors.text} surface={colors.surface} borderRadius={radius.pill} textStyle={type.footnote} disabled={busy} />
          <CallControl label={t('call.switchCamera')} icon="refresh-outline" onPress={flipCamera} color={colors.text} surface={colors.surface} borderRadius={radius.pill} textStyle={type.footnote} disabled={busy} />
          <CallControl label={t('call.hangUp')} icon="call-outline" onPress={() => void respond('end')} color={colors.primaryText} surface={colors.danger} borderRadius={radius.pill} textStyle={type.footnote} disabled={busy} />
        </View>
        {busy && !joined ? <ActivityIndicator style={{ marginTop: space.sm }} color={colors.primary} /> : null}
      </View>
    </View>
  );
}
