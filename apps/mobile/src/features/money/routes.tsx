import { editorOptions, type FeatureRoutes } from '../../core/navigation/routes';
import { AdhocBillScreen } from './AdhocBillScreen';
import { BillingPlansScreen } from './BillingPlansScreen';
import { BillScreen } from './BillScreen';
import { FlatAccountScreen } from './FlatAccountScreen';
import { HowToPayScreen } from './HowToPayScreen';
import { PaymentInstructionsScreen } from './PaymentInstructionsScreen';
import { PaymentsScreen } from './PaymentsScreen';
import { PlanEditorScreen } from './PlanEditorScreen';
import { ReceiptScreen } from './ReceiptScreen';
import { RecordPaymentScreen } from './RecordPaymentScreen';

export type MoneyParams = {
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
};

export const moneyRoutes: FeatureRoutes<MoneyParams> = {
  screens: [
    { name: 'Bill', component: BillScreen, group: 'app' },
    { name: 'Receipt', component: ReceiptScreen, group: 'app' },
    { name: 'Payments', component: PaymentsScreen, group: 'app' },
    { name: 'HowToPay', component: HowToPayScreen, group: 'app' },
    { name: 'RecordPayment', component: RecordPaymentScreen, group: 'app', options: editorOptions },
    { name: 'FlatAccount', component: FlatAccountScreen, group: 'app' },
    { name: 'BillingPlans', component: BillingPlansScreen, group: 'app' },
    { name: 'PlanEditor', component: PlanEditorScreen, group: 'app', options: editorOptions },
    { name: 'AdhocBill', component: AdhocBillScreen, group: 'app', options: editorOptions },
    { name: 'PaymentInstructions', component: PaymentInstructionsScreen, group: 'app' },
  ],
  notifications: [
    { kind: 'bill', route: 'Bill', param: 'billId' },
    { kind: 'payment', route: 'Receipt', param: 'paymentId' },
  ],
};
