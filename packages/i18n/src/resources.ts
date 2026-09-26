import enAuth from './locales/en/auth.json';
import enCommon from './locales/en/common.json';
import enEmergency from './locales/en/emergency.json';
import enErrors from './locales/en/errors.json';
import enEvents from './locales/en/events.json';
import enHome from './locales/en/home.json';
import enManage from './locales/en/manage.json';
import enMe from './locales/en/me.json';
import enMeetings from './locales/en/meetings.json';
import enMoney from './locales/en/money.json';
import enNotices from './locales/en/notices.json';
import enOnboarding from './locales/en/onboarding.json';
import enParking from './locales/en/parking.json';
import enServices from './locales/en/services.json';
import enSociety from './locales/en/society.json';
import hiAuth from './locales/hi/auth.json';
import hiCommon from './locales/hi/common.json';
import hiEmergency from './locales/hi/emergency.json';
import hiErrors from './locales/hi/errors.json';
import hiEvents from './locales/hi/events.json';
import hiHome from './locales/hi/home.json';
import hiManage from './locales/hi/manage.json';
import hiMe from './locales/hi/me.json';
import hiMeetings from './locales/hi/meetings.json';
import hiMoney from './locales/hi/money.json';
import hiNotices from './locales/hi/notices.json';
import hiOnboarding from './locales/hi/onboarding.json';
import hiParking from './locales/hi/parking.json';
import hiServices from './locales/hi/services.json';
import hiSociety from './locales/hi/society.json';
import mrAuth from './locales/mr/auth.json';
import mrCommon from './locales/mr/common.json';
import mrEmergency from './locales/mr/emergency.json';
import mrErrors from './locales/mr/errors.json';
import mrEvents from './locales/mr/events.json';
import mrHome from './locales/mr/home.json';
import mrManage from './locales/mr/manage.json';
import mrMe from './locales/mr/me.json';
import mrMeetings from './locales/mr/meetings.json';
import mrMoney from './locales/mr/money.json';
import mrNotices from './locales/mr/notices.json';
import mrOnboarding from './locales/mr/onboarding.json';
import mrParking from './locales/mr/parking.json';
import mrServices from './locales/mr/services.json';
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
  parking: enParking,
  services: enServices,
  emergency: enEmergency,
  meetings: enMeetings,
  events: enEvents,
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
    parking: hiParking,
    services: hiServices,
    emergency: hiEmergency,
    meetings: hiMeetings,
    events: hiEvents,
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
    parking: mrParking,
    services: mrServices,
    emergency: mrEmergency,
    meetings: mrMeetings,
    events: mrEvents,
  },
} as const;
