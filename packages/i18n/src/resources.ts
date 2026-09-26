import enAuth from './locales/en/auth.json';
import enCommon from './locales/en/common.json';
import enErrors from './locales/en/errors.json';
import enHome from './locales/en/home.json';
import enManage from './locales/en/manage.json';
import enMe from './locales/en/me.json';
import enMoney from './locales/en/money.json';
import enNotices from './locales/en/notices.json';
import enOnboarding from './locales/en/onboarding.json';
import enSociety from './locales/en/society.json';
import hiAuth from './locales/hi/auth.json';
import hiCommon from './locales/hi/common.json';
import hiErrors from './locales/hi/errors.json';
import hiHome from './locales/hi/home.json';
import hiManage from './locales/hi/manage.json';
import hiMe from './locales/hi/me.json';
import hiMoney from './locales/hi/money.json';
import hiNotices from './locales/hi/notices.json';
import hiOnboarding from './locales/hi/onboarding.json';
import hiSociety from './locales/hi/society.json';
import mrAuth from './locales/mr/auth.json';
import mrCommon from './locales/mr/common.json';
import mrErrors from './locales/mr/errors.json';
import mrHome from './locales/mr/home.json';
import mrManage from './locales/mr/manage.json';
import mrMe from './locales/mr/me.json';
import mrMoney from './locales/mr/money.json';
import mrNotices from './locales/mr/notices.json';
import mrOnboarding from './locales/mr/onboarding.json';
import mrSociety from './locales/mr/society.json';

/** English is the source of truth. The other locales must have the same shape. */
export const en = {
  common: enCommon,
  errors: enErrors,
  auth: enAuth,
  onboarding: enOnboarding,
  home: enHome,
  society: enSociety,
  notices: enNotices,
  money: enMoney,
  me: enMe,
  manage: enManage,
} as const;

export type Resources = typeof en;
export type Namespace = keyof Resources;
export const NAMESPACES = Object.keys(en) as Namespace[];
export const DEFAULT_NAMESPACE: Namespace = 'common';

export const resources = {
  en,
  hi: {
    common: hiCommon,
    errors: hiErrors,
    auth: hiAuth,
    onboarding: hiOnboarding,
    home: hiHome,
    society: hiSociety,
    notices: hiNotices,
    money: hiMoney,
    me: hiMe,
    manage: hiManage,
  },
  mr: {
    common: mrCommon,
    errors: mrErrors,
    auth: mrAuth,
    onboarding: mrOnboarding,
    home: mrHome,
    society: mrSociety,
    notices: mrNotices,
    money: mrMoney,
    me: mrMe,
    manage: mrManage,
  },
} as const;
