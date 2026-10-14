import type { FeatureRoutes } from '../../core/navigation/routes';
import { ChangePasswordScreen } from './ChangePasswordScreen';
import { DeleteAccountScreen } from './DeleteAccountScreen';
import { EditProfileScreen } from './EditProfileScreen';
import { LanguageScreen } from './LanguageScreen';
import { PrivacyScreen } from './PrivacyScreen';
import { SocietySwitcherScreen } from './SocietySwitcherScreen';

export type MeParams = {
  SocietySwitcher: undefined;
  Language: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  Privacy: undefined;
  DeleteAccount: undefined;
};

export const meRoutes: FeatureRoutes<MeParams> = {
  screens: [
    {
      name: 'SocietySwitcher',
      component: SocietySwitcherScreen,
      group: 'app',
      options: { presentation: 'modal', animation: 'slide_from_bottom' },
    },
    { name: 'Language', component: LanguageScreen, group: 'app' },
    { name: 'EditProfile', component: EditProfileScreen, group: 'app' },
    { name: 'ChangePassword', component: ChangePasswordScreen, group: 'app' },
    { name: 'Privacy', component: PrivacyScreen, group: 'app' },
    { name: 'DeleteAccount', component: DeleteAccountScreen, group: 'app' },
  ],
};
