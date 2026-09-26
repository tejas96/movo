import { Button, EmptyState, Screen, Text } from '@movo/design-system';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { ForgotPasswordScreen } from '../../features/auth/ForgotPasswordScreen';
import { LoginScreen } from '../../features/auth/LoginScreen';
import { RegisterScreen } from '../../features/auth/RegisterScreen';
import { ResetPasswordScreen } from '../../features/auth/ResetPasswordScreen';
import { DirectoryScreen } from '../../features/directory/DirectoryScreen';
import { MemberDetailScreen } from '../../features/directory/MemberDetailScreen';
import { AlertDetailScreen } from '../../features/emergency/AlertDetailScreen';
import { EmergencyScreen } from '../../features/emergency/EmergencyScreen';
import { EventDetailScreen } from '../../features/events/EventDetailScreen';
import { EventEditorScreen } from '../../features/events/EventEditorScreen';
import { EventsScreen } from '../../features/events/EventsScreen';
import { ExpenseCategoriesScreen } from '../../features/expenses/ExpenseCategoriesScreen';
import { ExpenseDetailScreen } from '../../features/expenses/ExpenseDetailScreen';
import { ExpenseEditorScreen } from '../../features/expenses/ExpenseEditorScreen';
import { ExpensesScreen } from '../../features/expenses/ExpensesScreen';
import { NotificationsScreen } from '../../features/home/NotificationsScreen';
import { InvitationsScreen } from '../../features/manage/InvitationsScreen';
import { InviteMemberScreen } from '../../features/manage/InviteMemberScreen';
import { JoinRequestsScreen } from '../../features/manage/JoinRequestsScreen';
import { ManageHomeScreen } from '../../features/manage/ManageHomeScreen';
import { StructureScreen } from '../../features/manage/StructureScreen';
import { ComingSoonScreen } from '../../features/market/ComingSoonScreen';
import { ChangePasswordScreen } from '../../features/me/ChangePasswordScreen';
import { DeleteAccountScreen } from '../../features/me/DeleteAccountScreen';
import { EditProfileScreen } from '../../features/me/EditProfileScreen';
import { LanguageScreen } from '../../features/me/LanguageScreen';
import { PrivacyScreen } from '../../features/me/PrivacyScreen';
import { SocietySwitcherScreen } from '../../features/me/SocietySwitcherScreen';
import { MeetingDetailScreen } from '../../features/meetings/MeetingDetailScreen';
import { MeetingEditorScreen } from '../../features/meetings/MeetingEditorScreen';
import { MeetingsScreen } from '../../features/meetings/MeetingsScreen';
import { AdhocBillScreen } from '../../features/money/AdhocBillScreen';
import { BillingPlansScreen } from '../../features/money/BillingPlansScreen';
import { BillScreen } from '../../features/money/BillScreen';
import { FlatAccountScreen } from '../../features/money/FlatAccountScreen';
import { HowToPayScreen } from '../../features/money/HowToPayScreen';
import { PaymentInstructionsScreen } from '../../features/money/PaymentInstructionsScreen';
import { PaymentsScreen } from '../../features/money/PaymentsScreen';
import { PlanEditorScreen } from '../../features/money/PlanEditorScreen';
import { ReceiptScreen } from '../../features/money/ReceiptScreen';
import { RecordPaymentScreen } from '../../features/money/RecordPaymentScreen';
import { NoticeDetailScreen } from '../../features/notices/NoticeDetailScreen';
import { NoticeEditorScreen } from '../../features/notices/NoticeEditorScreen';
import { NoticesScreen } from '../../features/notices/NoticesScreen';
import { JoinScreen } from '../../features/onboarding/JoinScreen';
import { PendingScreen } from '../../features/onboarding/PendingScreen';
import { PickFlatScreen } from '../../features/onboarding/PickFlatScreen';
import { ParkingScreen } from '../../features/parking/ParkingScreen';
import { ParkingSlotsScreen } from '../../features/parking/ParkingSlotsScreen';
import { VehicleEditorScreen } from '../../features/parking/VehicleEditorScreen';
import { ServicesScreen } from '../../features/services/ServicesScreen';
import { VendorCategoriesScreen } from '../../features/services/VendorCategoriesScreen';
import { VendorDetailScreen } from '../../features/services/VendorDetailScreen';
import { VendorEditorScreen } from '../../features/services/VendorEditorScreen';
import { VendorListScreen } from '../../features/services/VendorListScreen';
import { signOut } from '../auth/auth';
import { useSessionStore } from '../auth/session.store';
import { useBootstrap } from '../auth/use-bootstrap';
import { useMeContext } from '../tenant/hooks';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function Splash() {
  return (
    <View className="flex-1 items-center justify-center bg-canvas">
      <View className="h-16 w-16 items-center justify-center rounded-md bg-ink">
        <Text variant="h1" tone="inverse">
          M
        </Text>
      </View>
      <ActivityIndicator className="mt-6" />
    </View>
  );
}

function ContextError({ retry }: { retry: () => void }) {
  const { t } = useTranslation('common');
  return (
    <Screen>
      <View className="flex-1 justify-center">
        <EmptyState
          icon="warning"
          title={t('states.errorTitle')}
          body={t('states.errorBody')}
          actionLabel={t('actions.retry')}
          onAction={retry}
        />
        <Button
          label={t('actions.signOut')}
          variant="ghost"
          onPress={() => void signOut()}
          className="mt-2"
        />
      </View>
    </Screen>
  );
}

/**
 * Three worlds, one stack: signed out (auth), signed in without a society (join), and the app.
 * React Navigation swaps the screen set when the session or membership changes.
 */
export function RootNavigator() {
  useBootstrap();
  const status = useSessionStore((s) => s.status);
  const ctx = useMeContext(status === 'signedIn');

  if (status === 'booting') return <Splash />;
  if (status === 'signedIn' && !ctx.data) {
    if (ctx.isError) return <ContextError retry={() => void ctx.refetch()} />;
    return <Splash />;
  }
  const hasSociety = Boolean(ctx.data?.memberships.some((m) => m.status === 'ACTIVE'));

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      {status === 'signedOut' ? (
        <Stack.Group>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </Stack.Group>
      ) : !hasSociety ? (
        <Stack.Group>
          <Stack.Screen name="Join" component={JoinScreen} />
          <Stack.Screen name="PickFlat" component={PickFlatScreen} />
          <Stack.Screen name="Pending" component={PendingScreen} />
        </Stack.Group>
      ) : (
        <Stack.Group>
          <Stack.Screen name="Tabs" component={MainTabs} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Notices" component={NoticesScreen} />
          <Stack.Screen name="NoticeDetail" component={NoticeDetailScreen} />
          <Stack.Screen
            name="NoticeEditor"
            component={NoticeEditorScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="Directory" component={DirectoryScreen} />
          <Stack.Screen name="MemberDetail" component={MemberDetailScreen} />
          <Stack.Screen name="ComingSoon" component={ComingSoonScreen} />
          <Stack.Screen
            name="SocietySwitcher"
            component={SocietySwitcherScreen}
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="Language" component={LanguageScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
          <Stack.Screen name="Privacy" component={PrivacyScreen} />
          <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
          <Stack.Screen name="Manage" component={ManageHomeScreen} />
          <Stack.Screen name="Invitations" component={InvitationsScreen} />
          <Stack.Screen name="InviteMember" component={InviteMemberScreen} />
          <Stack.Screen name="JoinRequests" component={JoinRequestsScreen} />
          <Stack.Screen name="Structure" component={StructureScreen} />
          <Stack.Screen name="Services" component={ServicesScreen} />
          <Stack.Screen name="VendorList" component={VendorListScreen} />
          <Stack.Screen name="VendorDetail" component={VendorDetailScreen} />
          <Stack.Screen
            name="VendorEditor"
            component={VendorEditorScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="VendorCategories" component={VendorCategoriesScreen} />
          <Stack.Screen name="Parking" component={ParkingScreen} />
          <Stack.Screen
            name="VehicleEditor"
            component={VehicleEditorScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="ParkingSlots" component={ParkingSlotsScreen} />
          <Stack.Screen name="Emergency" component={EmergencyScreen} />
          <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
          <Stack.Screen name="Meetings" component={MeetingsScreen} />
          <Stack.Screen name="MeetingDetail" component={MeetingDetailScreen} />
          <Stack.Screen
            name="MeetingEditor"
            component={MeetingEditorScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="Events" component={EventsScreen} />
          <Stack.Screen name="EventDetail" component={EventDetailScreen} />
          <Stack.Screen
            name="EventEditor"
            component={EventEditorScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="Bill" component={BillScreen} />
          <Stack.Screen name="Receipt" component={ReceiptScreen} />
          <Stack.Screen name="Payments" component={PaymentsScreen} />
          <Stack.Screen name="HowToPay" component={HowToPayScreen} />
          <Stack.Screen
            name="RecordPayment"
            component={RecordPaymentScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="FlatAccount" component={FlatAccountScreen} />
          <Stack.Screen name="BillingPlans" component={BillingPlansScreen} />
          <Stack.Screen
            name="PlanEditor"
            component={PlanEditorScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="AdhocBill"
            component={AdhocBillScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="PaymentInstructions" component={PaymentInstructionsScreen} />
          <Stack.Screen name="Expenses" component={ExpensesScreen} />
          <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} />
          <Stack.Screen
            name="ExpenseEditor"
            component={ExpenseEditorScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="ExpenseCategories" component={ExpenseCategoriesScreen} />
          <Stack.Screen name="Join" component={JoinScreen} />
          <Stack.Screen name="PickFlat" component={PickFlatScreen} />
          <Stack.Screen name="Pending" component={PendingScreen} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}
