import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';

import { IconButton, PrimaryButton, SegmentedChips, TextButton } from '@/design-system/components';
import { colors, radius, spacing, typography } from '@/design-system/tokens';
import { detectorKindForMode } from '@/domain/composition/target';
import type {
  AspectRatioPreset,
  CameraPosition,
  DetectionResult,
  ShootingMode,
  Size,
} from '@/domain/composition/types';
import { coverKeyForMode } from '@/domain/preferences/preset';
import {
  createProfileFromAnswers,
  DEFAULT_ANSWERS,
  suggestedPlacementAndSize,
  type PreferenceAnswers,
} from '@/domain/preferences/profile-factory';
import { useAppData } from '@/features/app-data/AppDataProvider';
import { GuideOverlay } from '@/features/camera/GuideOverlay';
import { describeCameraPermission, type CameraPermissionStatus } from '@/features/camera/permission-state';
import { useGuidance } from '@/features/guidance/useGuidance';
import { useLevelSensor } from '@/features/guidance/useLevelSensor';
import { MODE_OPTIONS, modeLabel, RATIO_OPTIONS } from '@/features/preferences/options';
import { useSubjectDetection } from '@/features/subject-detection/useSubjectDetection';
import { createTempCapturePath } from '@/infrastructure/files/capture-files';
import { sampleImage } from '@/shared/sample-images';

const TOP_BAR = 56;
const BOTTOM_BAR = 132;
const RATIOS: readonly AspectRatioPreset[] = ['1:1', '4:5', '3:4', '9:16'];
const QUICK_MODES: readonly ShootingMode[] = ['portrait', 'food', 'landscape', 'ootd'];

export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { activePreset, presets, settings, updateSettings, selectPreset } = useAppData();

  const quickMode = QUICK_MODES.find((mode) => mode === params.mode) ?? null;

  const [position, setPosition] = useState<CameraPosition>('back');
  const [flashOn, setFlashOn] = useState(false);
  const [ratioOverride, setRatioOverride] = useState<AspectRatioPreset | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [cameraStarted, setCameraStarted] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tipVisible, setTipVisible] = useState(settings.shootingTipsEnabled);

  // 화면 포커스 / 앱 상태에 따라 카메라·분석을 켜고 끈다.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
        setCameraStarted(false);
      };
    }, []),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      setAppActive(next === 'active');
      if (next !== 'active') setCameraStarted(false);
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!tipVisible) return;
    const timer = setTimeout(() => setTipVisible(false), 4500);
    return () => clearTimeout(timer);
  }, [tipVisible]);

  // 이번 촬영에 쓸 프로필: 빠른 모드 > 기본 프리셋 > 기본값. 비율은 화면에서 임시로 바꿀 수 있다.
  const baseAnswers = useMemo<PreferenceAnswers>(() => {
    if (quickMode) {
      return { ...DEFAULT_ANSWERS, ...suggestedPlacementAndSize(DEFAULT_ANSWERS.style), mode: quickMode };
    }
    return activePreset?.answers ?? DEFAULT_ANSWERS;
  }, [quickMode, activePreset]);
  const profileName = quickMode ? `${modeLabel(quickMode)} 빠른 모드` : (activePreset?.name ?? '기본 구도');
  const profile = useMemo(
    () =>
      createProfileFromAnswers(
        { ...baseAnswers, aspectRatio: ratioOverride ?? baseAnswers.aspectRatio },
        { id: quickMode ? `quick-${quickMode}` : (activePreset?.id ?? 'default'), name: profileName },
      ),
    [baseAnswers, ratioOverride, quickMode, activePreset?.id, profileName],
  );

  const permission = useCameraPermission();
  const device = useCameraDevice(position);
  const hasFlash = device?.hasFlash === true;
  const live = focused && appActive && permission.hasPermission && device !== undefined;

  // 프리뷰 영역: 화면 너비 × 4:3(세로). 화면이 짧으면 높이를 줄인다(프리뷰는 cover로 채움).
  const previewSize = useMemo<Size>(() => {
    const maxHeight = window.height - insets.top - insets.bottom - TOP_BAR - BOTTOM_BAR;
    return { width: window.width, height: Math.max(Math.min((window.width * 4) / 3, maxHeight), 200) };
  }, [window.width, window.height, insets.top, insets.bottom]);

  const detectorKind = detectorKindForMode(profile.mode);
  const level = useLevelSensor(live && profile.levelGuide);

  const guidanceRef = useRef<(detection: DetectionResult | null) => void>(() => {});
  const detection = useSubjectDetection({
    kind: detectorKind,
    enabled: live && cameraStarted,
    previewMirrored: position === 'front',
    onDetection: (result) => guidanceRef.current(result),
  });
  const guidance = useGuidance({
    profile,
    viewSize: previewSize,
    enabled: live,
    detectorAvailable: detection.detectorAvailable,
    rollRef: level.rollRef,
  });
  const pushDetection = guidance.pushDetection;
  useEffect(() => {
    guidanceRef.current = pushDetection;
  }, [pushDetection]);

  const photoOutput = usePhotoOutput({
    targetResolution: CommonResolutions.UHD_4_3,
    containerFormat: 'jpeg',
    quality: 0.92,
    qualityPrioritization: 'balanced',
  });
  const frameOutput = detection.frameOutput;
  const outputs = useMemo(
    () => (detectorKind !== null && detection.detectorAvailable ? [photoOutput, frameOutput] : [photoOutput]),
    [photoOutput, frameOutput, detectorKind, detection.detectorAvailable],
  );

  // 준비 완료 진동 (설정에서 끌 수 있음). 자동 촬영은 하지 않는다.
  const status = guidance.result.status;
  const previousStatus = useRef(status);
  useEffect(() => {
    if (status === 'ready' && previousStatus.current !== 'ready' && settings.hapticsEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    previousStatus.current = status;
  }, [status, settings.hapticsEnabled]);

  const onShutter = async () => {
    if (capturing || !live || !cameraStarted) return;
    setCapturing(true);
    setErrorMessage(null);
    try {
      const photo = await photoOutput.capturePhoto(
        { flashMode: flashOn && hasFlash ? 'on' : 'off', enableShutterSound: true },
        {},
      );
      try {
        // 사용자가 저장을 누르기 전까지는 앱 캐시의 임시 파일로만 둔다.
        const uri = createTempCapturePath('jpg');
        await photo.saveToFileAsync(decodeURIComponent(uri.replace(/^file:\/\//, '')));
        const levelAtShutter = guidance.result.level;
        router.push({
          pathname: '/capture-review',
          params: {
            uri,
            width: String(photo.width),
            height: String(photo.height),
            roll: levelAtShutter ? levelAtShutter.rollDeg.toFixed(1) : '',
            preset: profileName,
          },
        });
      } finally {
        photo.dispose();
      }
    } catch {
      setErrorMessage('촬영하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setCapturing(false);
    }
  };

  const cycleRatio = () => {
    const current = profile.aspectRatio;
    setRatioOverride(RATIOS[(RATIOS.indexOf(current) + 1) % RATIOS.length]);
  };

  const coverKey = quickMode ? coverKeyForMode(quickMode) : (activePreset?.coverKey ?? coverKeyForMode(profile.mode));
  const modeNote = MODE_OPTIONS.find((option) => option.value === profile.mode)?.note ?? '';

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      <View style={styles.topBar}>
        <IconButton
          icon={flashOn && hasFlash ? 'flash' : 'flashOff'}
          label={hasFlash ? (flashOn ? '플래시 끄기' : '플래시 켜기') : '이 카메라는 플래시를 지원하지 않아요'}
          color={colors.onDark}
          disabled={!hasFlash}
          onPress={() => setFlashOn((value) => !value)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`비율 프레임 ${profile.aspectRatio}, 눌러서 변경`}
          onPress={cycleRatio}
          hitSlop={10}
          style={({ pressed }) => [styles.ratioChip, pressed && styles.pressed]}>
          <Text style={styles.ratioText}>{profile.aspectRatio}</Text>
        </Pressable>
        <IconButton
          icon="flip"
          label={position === 'back' ? '전면 카메라로 전환' : '후면 카메라로 전환'}
          color={colors.onDark}
          onPress={() => {
            setCameraStarted(false);
            setFlashOn(false);
            setPosition((value) => (value === 'back' ? 'front' : 'back'));
          }}
        />
      </View>

      <View style={styles.previewArea}>
        <View style={[styles.preview, previewSize]}>
          {permission.hasPermission && device !== undefined ? (
            <>
              <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={live}
                outputs={outputs}
                resizeMode="cover"
                enableNativeZoomGesture
                onStarted={() => setCameraStarted(true)}
                onPreviewStarted={() => setCameraStarted(true)}
                onStopped={() => setCameraStarted(false)}
                onError={() => setErrorMessage('카메라를 사용할 수 없어요. 다른 앱이 카메라를 쓰고 있는지 확인해 주세요.')}
              />
              <GuideOverlay
                size={previewSize}
                profile={profile}
                result={guidance.result}
                cropRect={guidance.cropRect}
                targetRect={guidance.targetRect}
                subjectRect={guidance.subjectRect}
                gridEnabled={settings.gridEnabled}
                messagesEnabled={settings.guidanceMessagesEnabled}
              />
              {tipVisible ? (
                <View style={styles.tip} pointerEvents="none">
                  <Text style={styles.tipText}>
                    {profileName} · {modeNote}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <PermissionPanel
              status={permission.status}
              hasDevice={device !== undefined}
              onRequest={() => void permission.requestPermission()}
              onBack={() => router.back()}
            />
          )}
        </View>
        {errorMessage ? (
          <Text style={styles.error} accessibilityLiveRegion="assertive">
            {errorMessage}
          </Text>
        ) : null}
      </View>

      <View style={styles.bottomBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`현재 프리셋 ${profileName}, 눌러서 프리셋과 가이드 옵션 열기`}
          onPress={() => setSheetOpen(true)}
          style={({ pressed }) => [styles.thumbButton, pressed && styles.pressed]}>
          <Image source={sampleImage(coverKey)} style={styles.thumb} accessibilityIgnoresInvertColors />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="촬영"
          accessibilityHint="사진을 촬영한 뒤 결과를 확인하는 화면으로 이동합니다"
          accessibilityState={{ disabled: !live || !cameraStarted || capturing }}
          disabled={!live || !cameraStarted || capturing}
          onPress={() => void onShutter()}
          style={({ pressed }) => [
            styles.shutter,
            status === 'ready' && styles.shutterReady,
            (!live || !cameraStarted || capturing) && styles.shutterDisabled,
            pressed && styles.shutterPressed,
          ]}>
          <View style={styles.shutterInner} />
        </Pressable>

        <IconButton
          icon="sliders"
          label="프리셋과 가이드 옵션"
          color={colors.onDark}
          size={28}
          onPress={() => setSheetOpen(true)}
          style={styles.sideButton}
        />
      </View>

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={styles.sheetBackdrop} accessibilityLabel="옵션 닫기" onPress={() => setSheetOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.sheetHandle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.sheetTitle}>프리셋</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
              {presets.map((preset) => {
                const selected = !quickMode && preset.id === activePreset?.id;
                return (
                  <Pressable
                    key={preset.id}
                    accessibilityRole="radio"
                    accessibilityLabel={preset.name}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setRatioOverride(null);
                      void selectPreset(preset.id);
                      if (quickMode) router.setParams({ mode: undefined });
                    }}
                    style={styles.presetItem}>
                    <Image
                      source={sampleImage(preset.coverKey)}
                      style={[styles.presetThumb, selected && styles.presetThumbSelected]}
                      accessibilityIgnoresInvertColors
                    />
                    <Text style={[styles.presetName, selected && styles.presetNameSelected]} numberOfLines={1}>
                      {preset.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {quickMode ? (
              <Text style={styles.sheetNote}>
                지금은 {modeLabel(quickMode)} 빠른 모드예요. 프리셋을 고르면 그 프리셋으로 바뀌어요.
              </Text>
            ) : null}

            <Text style={styles.sheetTitle}>비율 프레임</Text>
            <SegmentedChips
              tone="dark"
              accessibilityLabel="비율 프레임"
              options={RATIO_OPTIONS}
              value={profile.aspectRatio}
              onChange={setRatioOverride}
            />
            <Text style={styles.sheetNote}>
              비율 프레임은 촬영 참고용이에요. 사진은 카메라 원본 비율로 저장돼요.
            </Text>

            <View style={styles.sheetToggle}>
              <Text style={styles.sheetToggleLabel}>격자 가이드</Text>
              <Switch
                accessibilityLabel="격자 가이드"
                value={settings.gridEnabled}
                onValueChange={(gridEnabled) => void updateSettings({ gridEnabled })}
                trackColor={{ false: colors.darkSurfaceRaised, true: colors.accent }}
                thumbColor={colors.onDark}
              />
            </View>
            <View style={styles.sheetToggle}>
              <Text style={styles.sheetToggleLabel}>안내 문구</Text>
              <Switch
                accessibilityLabel="안내 문구"
                value={settings.guidanceMessagesEnabled}
                onValueChange={(guidanceMessagesEnabled) => void updateSettings({ guidanceMessagesEnabled })}
                trackColor={{ false: colors.darkSurfaceRaised, true: colors.accent }}
                thumbColor={colors.onDark}
              />
            </View>

            <TextButton
              label="카메라 닫기"
              color={colors.onDarkSecondary}
              onPress={() => {
                setSheetOpen(false);
                router.back();
              }}
              style={styles.sheetClose}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function PermissionPanel({
  status,
  hasDevice,
  onRequest,
  onBack,
}: {
  status: CameraPermissionStatus;
  hasDevice: boolean;
  onRequest: () => void;
  onBack: () => void;
}) {
  const view = describeCameraPermission(status, hasDevice);
  return (
    <View style={styles.permission}>
      <Text style={styles.permissionTitle} accessibilityRole="header">
        {view.title}
      </Text>
      <Text style={styles.permissionBody}>{view.body}</Text>
      {view.action && view.actionLabel ? (
        <PrimaryButton
          label={view.actionLabel}
          onPress={view.action === 'request' ? onRequest : () => void Linking.openSettings()}
          showArrow={false}
          style={styles.permissionButton}
        />
      ) : null}
      <TextButton label="돌아가기" color={colors.onDarkSecondary} onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.dark },
  topBar: {
    height: TOP_BAR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  ratioChip: {
    minWidth: 44,
    height: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.onDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratioText: { ...typography.caption, color: colors.onDark, fontWeight: '700' },
  previewArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  preview: { backgroundColor: colors.darkSurface, overflow: 'hidden' },
  tip: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: '44%',
    alignItems: 'center',
  },
  tipText: {
    ...typography.caption,
    color: colors.onDark,
    backgroundColor: colors.scrim,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    overflow: 'hidden',
    textAlign: 'center',
  },
  error: { ...typography.caption, color: colors.warning, marginTop: spacing.sm, textAlign: 'center' },
  bottomBar: {
    height: BOTTOM_BAR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
  },
  thumbButton: { width: 52, height: 52, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.darkSurface },
  thumb: { width: 52, height: 52 },
  sideButton: { width: 52, height: 52 },
  shutter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 4,
    borderColor: colors.onDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterReady: { borderColor: colors.accent },
  shutterDisabled: { opacity: 0.4 },
  shutterPressed: { transform: [{ scale: 0.94 }] },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.onDark },
  pressed: { opacity: 0.7 },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxxl },
  permissionTitle: { ...typography.heading, color: colors.onDark, textAlign: 'center' },
  permissionBody: {
    ...typography.body,
    fontSize: 14,
    color: colors.onDarkSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
  permissionButton: { alignSelf: 'stretch', backgroundColor: colors.darkSurfaceRaised },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '72%',
    backgroundColor: colors.darkSurface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.darkSurfaceRaised,
    marginBottom: spacing.sm,
  },
  sheetTitle: { ...typography.label, color: colors.onDark, marginTop: spacing.lg, marginBottom: spacing.md },
  sheetNote: { ...typography.caption, color: colors.onDarkSecondary, marginTop: spacing.sm },
  presetRow: { gap: spacing.md },
  presetItem: { width: 72, alignItems: 'center' },
  presetThumb: { width: 64, height: 64, borderRadius: radius.md, borderWidth: 2, borderColor: 'transparent' },
  presetThumbSelected: { borderColor: colors.accent },
  presetName: { ...typography.caption, fontSize: 11, color: colors.onDarkSecondary, marginTop: 6 },
  presetNameSelected: { color: colors.onDark },
  sheetToggle: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sheetToggleLabel: { ...typography.body, color: colors.onDark },
  sheetClose: { marginTop: spacing.md },
});
