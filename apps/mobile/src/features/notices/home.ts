import type { FeatureHome } from '../home/types';

export const noticesHome: FeatureHome = {
  attention: {
    IMPORTANT_NOTICE: {
      id: (item) => item.noticeId,
      row: (item, { t, nav }) => ({
        icon: item.priority === 'EMERGENCY' ? 'emergency' : 'notices',
        title: item.title,
        subtitle: t('home:attention.IMPORTANT_NOTICE.sub'),
        onPress: () => nav.navigate('NoticeDetail', { noticeId: item.noticeId }),
      }),
    },
  },
};
