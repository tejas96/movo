import { societyKey } from '../api/query-keys';

export const moneyKeys = (societyId: string) => {
  const root = societyKey(societyId);
  return {
    all: [...root, 'money'] as const,
    myDues: [...root, 'money', 'me'] as const,
    flatAccount: (flatId: string) => [...root, 'money', 'flat', flatId] as const,
    bill: (billId: string) => [...root, 'money', 'bill', billId] as const,
    payments: (flatId: string) => [...root, 'money', 'payments', flatId] as const,
    payment: (paymentId: string) => [...root, 'money', 'payment', paymentId] as const,
    collection: [...root, 'money', 'collection'] as const,
    plans: [...root, 'money', 'plans'] as const,
    instructions: [...root, 'money', 'instructions'] as const,
  };
};
