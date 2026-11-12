export type CameraPermissionStatus = 'not-determined' | 'authorized' | 'denied' | 'restricted';

export type PermissionAction = 'request' | 'open-settings' | null;

export interface PermissionView {
  /** 카메라 미리보기를 보여줄 수 있는지 */
  canShowCamera: boolean;
  title: string;
  body: string;
  action: PermissionAction;
  actionLabel: string | null;
}

/**
 * 카메라 권한 상태 → 화면 안내.
 * - 아직 묻지 않음: 이유를 설명한 뒤 요청
 * - 거부/제한: 다시 요청할 수 없으므로 기기 설정으로 안내
 * - 권한은 있는데 카메라 장치가 없음: 지원되지 않는 기기 안내
 * 어떤 경우에도 앱을 종료하지 않고 '돌아가기'를 제공한다.
 */
export function describeCameraPermission(
  status: CameraPermissionStatus,
  hasDevice: boolean,
): PermissionView {
  if (status === 'authorized') {
    if (hasDevice) {
      return { canShowCamera: true, title: '', body: '', action: null, actionLabel: null };
    }
    return {
      canShowCamera: false,
      title: '사용할 수 있는 카메라가 없어요',
      body: '이 기기에서 카메라를 찾지 못했어요. 다른 앱이 카메라를 사용 중이라면 종료한 뒤 다시 시도해 주세요.',
      action: null,
      actionLabel: null,
    };
  }
  if (status === 'not-determined') {
    return {
      canShowCamera: false,
      title: '카메라 권한이 필요해요',
      body: '구도 가이드를 보여주고 사진을 찍기 위해 카메라를 사용해요. 카메라 화면은 기기 안에서만 분석하고, 직접 셔터를 누를 때만 촬영해요.',
      action: 'request',
      actionLabel: '카메라 허용하기',
    };
  }
  if (status === 'restricted') {
    return {
      canShowCamera: false,
      title: '카메라 사용이 제한되어 있어요',
      body: '기기 정책(자녀 보호, 기기 관리 등)으로 카메라를 사용할 수 없어요. 제한을 해제한 뒤 다시 시도해 주세요.',
      action: 'open-settings',
      actionLabel: '설정 열기',
    };
  }
  return {
    canShowCamera: false,
    title: '카메라 권한이 꺼져 있어요',
    body: '기기 설정에서 구도픽의 카메라 권한을 허용하면 구도 가이드와 촬영을 사용할 수 있어요.',
    action: 'open-settings',
    actionLabel: '설정 열기',
  };
}
