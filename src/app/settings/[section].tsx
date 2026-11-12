import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';

import { HeaderBar, ListRow, Screen, ToggleRow } from '@/design-system/components';
import { colors, radius, spacing, typography } from '@/design-system/tokens';
import { GuidanceMessages } from '@/domain/composition/messages';
import { useAppData } from '@/features/app-data/AppDataProvider';
import { PRIVACY_SECTIONS, SCOPE_SECTIONS, type LegalSection } from '@/shared/legal-content';
import licenses from '@/shared/licenses.generated.json';

const TITLES: Record<string, string> = {
  guide: '촬영 가이드 설정',
  haptics: '진동 알림',
  messages: '알림 문구 설정',
  privacy: '개인정보 처리방침',
  licenses: '오픈소스 라이선스',
  about: '앱 정보',
};

export default function SettingsSectionScreen() {
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section: string }>();
  const key = typeof section === 'string' && section in TITLES ? section : 'about';

  return (
    <Screen edges={['top', 'bottom']}>
      <HeaderBar title={TITLES[key]} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {key === 'guide' ? <GuideSection /> : null}
        {key === 'haptics' ? <HapticsSection /> : null}
        {key === 'messages' ? <MessagesSection /> : null}
        {key === 'privacy' ? <LegalBlocks sections={PRIVACY_SECTIONS} /> : null}
        {key === 'licenses' ? <LicensesSection /> : null}
        {key === 'about' ? <AboutSection /> : null}
      </ScrollView>
    </Screen>
  );
}

function GuideSection() {
  const router = useRouter();
  const { settings, updateSettings, activePreset } = useAppData();
  const permission = useCameraPermission();

  const permissionLabel =
    permission.status === 'authorized'
      ? '허용됨'
      : permission.status === 'not-determined'
        ? '아직 요청하지 않음'
        : permission.status === 'restricted'
          ? '기기 정책으로 제한됨'
          : '거부됨';

  return (
    <View>
      <ToggleRow
        icon="grid"
        label="격자 가이드"
        description="카메라에 3분할 또는 중앙 격자를 보여줘요"
        value={settings.gridEnabled}
        onValueChange={(gridEnabled) => void updateSettings({ gridEnabled })}
      />
      <ToggleRow
        icon="message"
        label="촬영 도움말"
        description="카메라를 열 때 짧은 사용 안내를 보여줘요"
        value={settings.shootingTipsEnabled}
        onValueChange={(shootingTipsEnabled) => void updateSettings({ shootingTipsEnabled })}
      />
      <View style={styles.divider} />
      <ListRow
        icon="sliders"
        label="가이드 강도 · 비율 · 수평 안내"
        description={
          activePreset
            ? `현재 프리셋 '${activePreset.name}'에서 수정해요`
            : '프리셋을 만들면 프리셋별로 설정할 수 있어요'
        }
        onPress={() =>
          activePreset
            ? router.push({ pathname: '/preset-edit', params: { id: activePreset.id } })
            : router.push('/preset-edit')
        }
      />
      <ListRow
        icon="refresh"
        label="취향 다시 설정하기"
        description="온보딩을 다시 진행해 새 '내 취향' 프리셋을 만들어요"
        onPress={() => router.push('/onboarding')}
      />
      <View style={styles.divider} />
      <ListRow
        icon="camera"
        label="카메라 권한"
        description={permissionLabel}
        onPress={() => {
          if (permission.status === 'not-determined') void permission.requestPermission();
          else void Linking.openSettings();
        }}
      />
      <Text style={styles.note}>
        권한을 거부했더라도 기기 설정에서 다시 허용할 수 있어요. 구도픽은 마이크·위치·사진 읽기 권한을 요청하지 않아요.
      </Text>
    </View>
  );
}

function HapticsSection() {
  const { settings, updateSettings } = useAppData();
  return (
    <View>
      <ToggleRow
        icon="vibrate"
        label="준비 완료 진동"
        description="구도가 맞고 안정되면 짧게 진동으로 알려줘요"
        value={settings.hapticsEnabled}
        onValueChange={(hapticsEnabled) => void updateSettings({ hapticsEnabled })}
      />
      <ListRow
        icon="refresh"
        label="진동 테스트"
        description="준비 완료 때와 같은 진동을 한 번 실행해요"
        showChevron={false}
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }}
      />
      <Text style={styles.note}>
        진동을 꺼도 화면의 색·아이콘·문구로 준비 상태를 알려드려요. 자동으로 촬영하지는 않아요.
      </Text>
    </View>
  );
}

function MessagesSection() {
  const { settings, updateSettings } = useAppData();
  const examples = [
    '피사체를 왼쪽 가이드에 맞춰 보세요.',
    GuidanceMessages.closer,
    '오른쪽에 여백을 두세요',
    GuidanceMessages.level,
    GuidanceMessages.ready,
  ];
  return (
    <View>
      <ToggleRow
        icon="message"
        label="안내 문구 표시"
        description="카메라 화면에 짧은 구도 안내 문구를 보여줘요"
        value={settings.guidanceMessagesEnabled}
        onValueChange={(guidanceMessagesEnabled) => void updateSettings({ guidanceMessagesEnabled })}
      />
      <Text style={styles.blockTitle}>안내 문구 예시</Text>
      {examples.map((example) => (
        <View key={example} style={styles.pill}>
          <Text style={styles.pillText}>{example}</Text>
        </View>
      ))}
      <Text style={styles.note}>
        문구를 꺼도 목표 가이드와 격자는 그대로 표시돼요. 문구는 화면 속 피사체를 가이드 쪽으로 맞추는 기준으로
        안내해요.
      </Text>
    </View>
  );
}

function LegalBlocks({ sections }: { sections: readonly LegalSection[] }) {
  return (
    <View>
      {sections.map((block) => (
        <View key={block.title} style={styles.block}>
          <Text style={styles.blockTitle} accessibilityRole="header">
            {block.title}
          </Text>
          {block.body.map((line) => (
            <Text key={line} style={styles.paragraph}>
              {line}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function LicensesSection() {
  return (
    <View>
      <Text style={styles.paragraph}>
        구도픽은 아래 오픈소스 소프트웨어와 SDK를 사용해요. 전체 목록({licenses.total}개 패키지)과 라이선스 조건은
        프로젝트 저장소의 docs/THIRD_PARTY_NOTICES.md, docs/LICENSES.md 에 있어요.
      </Text>

      <Text style={styles.blockTitle}>약관이 따로 적용되는 SDK</Text>
      <LicenseRow name="Google ML Kit (얼굴 감지 · 객체 감지)" detail="Google ML Kit 서비스 약관 — 오픈소스 라이선스가 아니에요" />
      <LicenseRow name="AndroidX CameraX" detail="Apache-2.0" />

      <Text style={styles.blockTitle}>직접 사용하는 패키지</Text>
      {licenses.direct.map((item) => (
        <LicenseRow key={item.name} name={item.name} detail={`${item.version} · ${item.license}`} />
      ))}

      <Text style={styles.blockTitle}>이미지</Text>
      <Text style={styles.paragraph}>
        온보딩·프리셋의 예시 이미지는 AI로 생성한 샘플이며 실제 장소·인물·제품이 아니에요. 아이콘과 구도 도식은 자체
        제작했어요.
      </Text>
      <Text style={styles.note}>목록 생성일: {licenses.generatedAt}</Text>
    </View>
  );
}

function LicenseRow({ name, detail }: { name: string; detail: string }) {
  return (
    <View style={styles.licenseRow}>
      <Text style={styles.licenseName}>{name}</Text>
      <Text style={styles.licenseDetail}>{detail}</Text>
    </View>
  );
}

function AboutSection() {
  const router = useRouter();
  const { resetAllData } = useAppData();
  const version = Constants.expoConfig?.version ?? '-';

  const confirmReset = () => {
    Alert.alert(
      '데이터 초기화',
      '앱에 저장된 프리셋, 취향(온보딩), 설정을 모두 지워요.\n\n사진 앱에 이미 저장한 사진은 지워지지 않아요.\n이 작업은 되돌릴 수 없어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '초기화',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await resetAllData();
              router.dismissAll();
              router.replace('/onboarding');
            })();
          },
        },
      ],
    );
  };

  return (
    <View>
      <ListRow label="앱 이름" right={<Text style={styles.value}>구도픽 (GudoPick)</Text>} />
      <ListRow label="버전" right={<Text style={styles.value}>{version}</Text>} />
      <View style={styles.divider} />
      <LegalBlocks sections={SCOPE_SECTIONS} />
      <View style={styles.divider} />
      <ListRow
        icon="trash"
        label="데이터 초기화"
        description="프리셋·취향·설정 삭제 (저장한 사진은 유지)"
        destructive
        showChevron={false}
        onPress={confirmReset}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxxl },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.md },
  note: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.lg, lineHeight: 18 },
  block: { marginBottom: spacing.lg },
  blockTitle: { ...typography.label, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.sm },
  paragraph: { ...typography.body, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.sm },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  pillText: { ...typography.caption, color: colors.onInk },
  licenseRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  licenseName: { ...typography.body, fontSize: 14, color: colors.text },
  licenseDetail: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  value: { ...typography.body, fontSize: 14, color: colors.textSecondary },
});
