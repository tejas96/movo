import type { FeatureRoutes } from '../../core/navigation/routes';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { LoginScreen } from './LoginScreen';
import { RegisterScreen } from './RegisterScreen';
import { ResetPasswordScreen } from './ResetPasswordScreen';
import { WelcomeScreen } from './WelcomeScreen';

export type AuthParams = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { identifier?: string } | undefined;
};

export const authRoutes: FeatureRoutes<AuthParams> = {
  screens: [
    {
      name: 'Welcome',
      component: WelcomeScreen,
      group: 'auth',
      when: (flags) => flags.showWelcome,
    },
    { name: 'Login', component: LoginScreen, group: 'auth' },
    { name: 'Register', component: RegisterScreen, group: 'auth' },
    { name: 'ForgotPassword', component: ForgotPasswordScreen, group: 'auth' },
    { name: 'ResetPassword', component: ResetPasswordScreen, group: 'auth' },
  ],
};
