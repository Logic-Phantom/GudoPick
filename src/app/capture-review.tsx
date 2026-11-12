import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconButton } from '@/design-system/components';
import { colors, radius, spacing, typography } from '@/design-system/tokens';
import { CaptureSession, type SaveFailure } from '@/domain/capture/capture-session';
import { buildQualityTiles, type PhotoMetrics } from '@/domain/capture/photo-quality';
import { captureFiles, photoLibrary } from '@/infrastructure/files/capture-files';
import { analyzePhotoFile } from '@/infrastructure/native-vision/photo-analysis';

const FAILURE_MESSAGE: Record<SaveFailure, string> = {
  'permission-denied': '사진 추가 권한이 없어 저장하지 못했어요. 다시 누르면 권한을 요청해요.',
  'permission-blocked': '사진 추가 권한이 꺼져 있어요. 기기 설정에서 허용한 뒤 다시 저장해 주세요.',
  'save-failed': '저장하지 못했어요. 저장 공간을 확인하고 다시 시도해 주세요.',
};

/** 촬영 결과: 다시 찍기 / 명시적 저장. 저장 전 사진은 임시 캐시에만 있다. */
export default function CaptureReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ uri: string; width?: string; height?: string; roll?: string; preset?: string }>();
  const uri = params.uri;
  const rollDeg = params.roll !== undefined && params.roll !== '' ? Number(params.roll) : null;

  const session = useMemo(() => new CaptureSession(captureFiles, photoLibrary), []);
  const finished = useRef(false);
  const [phase, setPhase] = useState<'reviewing' | 'saving' | 'saved'>('reviewing');
  const [failure, setFailure] = useState<SaveFailure | null>(null);
  const [metrics, setMetrics] = useState<PhotoMetrics | null | undefined>(undefined);

  useEffect(() => {
    void session.begin({ uri, width: Number(params.width) || 0, height: Number(params.height) || 0 });
    let cancelled = false;
    analyzePhotoFile(uri).then((value) => {
      if (!cancelled) setMetrics(value);
    });
    return () => {
      cancelled = true;
      // 화면을 벗어날 때 저장하지 않은 임시 파일을 정리한다.
      if (!finished.current) void session.discard();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, uri]);

  const retake = async () => {
    if (phase === 'saving') return;
    finished.current = true;
    await session.discard();
    router.back();
  };

  const save = async () => {
    if (phase !== 'reviewing') return;
    setPhase('saving');
    setFailure(null);
    const outcome = await session.save();
    if (outcome.ok) {
      finished.current = true;
      setPhase('saved');
      setTimeout(() => router.back(), 900);
    } else {
      setFailure(outcome.reason);
      setPhase('reviewing');
    }
  };

  // Android 뒤로가기 = 다시 찍기(임시 파일 삭제)
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      void retake();
      return true;
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const tiles = buildQualityTiles(metrics ?? null, rollDeg);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
      <StatusBar style="light" />
      <View style={styles.topBar}>
        <IconButton icon="chevronLeft" label="다시 찍기" color={colors.onDark} onPress={() => void retake()} />
        <IconButton
          icon="check"
          label="저장하기"
          color={colors.onDark}
          disabled={phase !== 'reviewing'}
          onPress={() => void save()}
        />
      </View>

      <View style={styles.imageBox}>
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel="방금 촬영한 사진"
          accessibilityIgnoresInvertColors
        />
      </View>

      <Text style={styles.sectionTitle} accessibilityRole="header">
        촬영 확인
      </Text>
      <View style={styles.tiles}>
        {tiles.map((tile) => {
          const pending = metrics === undefined && tile.key !== 'level';
          const tint = tile.unknown || pending ? colors.onDarkSecondary : tile.ok ? colors.accent : colors.warning;
          return (
            <View
              key={tile.key}
              style={styles.tile}
              accessible
              accessibilityLabel={`${tile.title} ${pending ? '확인 중' : tile.value}`}>
              <View style={[styles.tileIcon, { borderColor: tint }]}>
                <Icon
                  name={tile.unknown || pending ? 'info' : tile.ok ? 'check' : 'close'}
                  size={14}
                  color={tint}
                  strokeWidth={2.4}
                />
              </View>
              <Text style={styles.tileTitle}>{tile.title}</Text>
              <Text style={[styles.tileValue, { color: tint }]}>{pending ? '확인 중' : tile.value}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.note}>
        {params.preset ? `${params.preset} · ` : ''}수평은 셔터를 누른 순간의 기기 기울기, 노출·선명도는 촬영된 사진을
        기기 안에서 확인한 참고 값이에요.
      </Text>

      {failure ? (
        <Pressable
          accessibilityRole={failure === 'permission-blocked' ? 'button' : 'text'}
          onPress={() => {
            if (failure === 'permission-blocked') void Linking.openSettings();
          }}>
          <Text style={styles.failure} accessibilityLiveRegion="assertive">
            {FAILURE_MESSAGE[failure]}
            {failure === 'permission-blocked' ? ' (눌러서 설정 열기)' : ''}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다시 찍기"
          accessibilityHint="이 사진을 저장하지 않고 지운 뒤 카메라로 돌아갑니다"
          disabled={phase === 'saving'}
          onPress={() => void retake()}
          style={({ pressed }) => [styles.button, styles.retake, pressed && styles.pressed]}>
          <Text style={styles.retakeLabel}>다시 찍기</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={phase === 'saved' ? '저장했어요' : '저장하기'}
          accessibilityHint="사진 앱에 이 사진을 추가합니다"
          accessibilityState={{ disabled: phase !== 'reviewing', busy: phase === 'saving' }}
          disabled={phase !== 'reviewing'}
          onPress={() => void save()}
          style={({ pressed }) => [styles.button, styles.save, pressed && styles.pressed]}>
          {phase === 'saved' ? <Icon name="check" size={18} color={colors.ink} strokeWidth={2.4} /> : null}
          <Text style={styles.saveLabel}>
            {phase === 'saving' ? '저장 중…' : phase === 'saved' ? '저장했어요' : '저장하기'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.dark, paddingHorizontal: spacing.lg },
  topBar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  imageBox: {
    flex: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.darkSurface,
    marginTop: spacing.xs,
  },
  image: { width: '100%', height: '100%' },
  sectionTitle: { ...typography.label, color: colors.onDark, marginTop: spacing.xl, marginBottom: spacing.md },
  tiles: {
    flexDirection: 'row',
    backgroundColor: colors.darkSurface,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
  },
  tile: { flex: 1, alignItems: 'center', gap: 6 },
  tileIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: { ...typography.caption, color: colors.onDark },
  tileValue: { ...typography.caption, fontWeight: '700' },
  note: { ...typography.caption, fontSize: 11, color: colors.onDarkSecondary, marginTop: spacing.sm, lineHeight: 16 },
  failure: { ...typography.caption, color: colors.warning, marginTop: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  button: {
    flex: 1,
    height: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  retake: { backgroundColor: colors.darkSurfaceRaised },
  retakeLabel: { ...typography.button, color: colors.onDark },
  save: { backgroundColor: colors.onDark },
  saveLabel: { ...typography.button, color: colors.ink },
  pressed: { opacity: 0.8 },
});
