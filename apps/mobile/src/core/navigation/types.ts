import type { ModuleKey, Vehicle, VendorStatus } from '@movo/contracts';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { identifier?: string } | undefined;
  Join: undefined;
  PickFlat: { joinCode: string };
  Pending: undefined;
  Tabs: undefined;
  Notifications: undefined;
  Notices: undefined;
  NoticeDetail: { noticeId: string };
  NoticeEditor: { noticeId?: string } | undefined;
  Directory: { manage?: boolean } | undefined;
  MemberDetail: { membershipId: string };
  ComingSoon: { moduleKey: ModuleKey | 'documents'; title: string };
  SocietySwitcher: undefined;
  Language: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  Privacy: undefined;
  DeleteAccount: undefined;
  Manage: undefined;
  Invitations: undefined;
  InviteMember: undefined;
  JoinRequests: undefined;
  Structure: undefined;
  Services: undefined;
  VendorList: { categoryId?: string; status?: VendorStatus; title: string };
  VendorDetail: { vendorId: string };
  VendorEditor: { vendorId?: string; categoryId?: string } | undefined;
  VendorCategories: undefined;
  Parking: undefined;
  VehicleEditor: { vehicle?: Vehicle; flatId?: string } | undefined;
  ParkingSlots: undefined;
  Emergency: undefined;
  AlertDetail: { alertId: string };
};

export type TabParamList = {
  Home: undefined;
  Society: undefined;
  Money: undefined;
  Market: undefined;
  Me: undefined;
};

export type RootNav = NativeStackNavigationProp<RootStackParamList>;

export function useNav(): RootNav {
  return useNavigation<RootNav>();
}
