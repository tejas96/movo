import type {
  ExpenseStatus,
  ListingKind,
  ModuleKey,
  OrderRole,
  TaskView,
  Vehicle,
  VendorStatus,
} from '@movo/contracts';
import { type NavigatorScreenParams, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { identifier?: string } | undefined;
  Join: undefined;
  PickFlat: { joinCode: string };
  Pending: undefined;
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
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
  Meetings: undefined;
  MeetingDetail: { meetingId: string };
  MeetingEditor: { meetingId?: string } | undefined;
  Events: undefined;
  EventDetail: { eventId: string };
  EventEditor: { eventId?: string } | undefined;
  Bill: { billId: string };
  Receipt: { paymentId: string };
  Payments: { flatId?: string } | undefined;
  HowToPay: { amountPaise?: number; note?: string } | undefined;
  RecordPayment: { flatId?: string } | undefined;
  FlatAccount: { flatId: string };
  BillingPlans: undefined;
  PlanEditor: { planId?: string } | undefined;
  AdhocBill: undefined;
  PaymentInstructions: undefined;
  Expenses: { status?: ExpenseStatus } | undefined;
  ExpenseDetail: { expenseId: string };
  ExpenseEditor: { expenseId?: string } | undefined;
  ExpenseCategories: undefined;
  Duties: undefined;
  DutyDetail: { dutyId: string };
  DutyEditor: undefined;
  Tasks: { view?: TaskView } | undefined;
  TaskDetail: { taskId: string };
  TaskEditor: { taskId?: string } | undefined;
  Rewards: undefined;
  SocietyProfile: undefined;
  Roles: undefined;
  RoleEditor: { roleId?: string } | undefined;
  Modules: undefined;
  AR: undefined;
  FloorMap: { levelId?: string; destinationId?: string } | undefined;
  ModuleSettings: { moduleKey: ModuleKey };
  AuditLog: undefined;
  Listing: { listingId: string };
  ListingEditor: { listingId?: string; kind?: ListingKind } | undefined;
  MyListings: undefined;
  Orders: { role?: OrderRole } | undefined;
  OrderDetail: { orderId: string };
  MarketReports: undefined;
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
