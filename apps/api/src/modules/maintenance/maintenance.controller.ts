import { maintenanceContract, type RouteInput, type RouteResponse } from '@movo/contracts';
import { Controller } from '@nestjs/common';
import { Input } from '../../common/route/input.decorator';
import { Route } from '../../common/route/route.decorator';
import { AccountsService } from './accounts.service';
import { BillsService } from './bills.service';
import { PaymentsService } from './payments.service';
import { PlansService } from './plans.service';

const c = maintenanceContract;
type In<K extends keyof typeof c> = RouteInput<(typeof c)[K]>;
type Out<K extends keyof typeof c> = Promise<RouteResponse<(typeof c)[K]>>;

@Controller()
export class MaintenanceController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly bills: BillsService,
    private readonly payments: PaymentsService,
    private readonly plans: PlansService,
  ) {}

  @Route(c.myDues) myDues(): Out<'myDues'> {
    return this.accounts.myDues();
  }
  @Route(c.flatAccount) flatAccount(
    @Input(c.flatAccount) { params }: In<'flatAccount'>,
  ): Out<'flatAccount'> {
    return this.accounts.flatAccount(params.flatId);
  }
  @Route(c.collection) collection(): Out<'collection'> {
    return this.accounts.collection();
  }

  @Route(c.listBills) listBills(@Input(c.listBills) { query }: In<'listBills'>): Out<'listBills'> {
    return this.bills.list(query);
  }
  @Route(c.generateBills) generateBills(): Out<'generateBills'> {
    return this.bills.generateNow();
  }
  @Route(c.createAdhocBills) createAdhocBills(
    @Input(c.createAdhocBills) { body }: In<'createAdhocBills'>,
  ): Out<'createAdhocBills'> {
    return this.bills.createAdhoc(body);
  }
  @Route(c.getBill) getBill(@Input(c.getBill) { params }: In<'getBill'>): Out<'getBill'> {
    return this.bills.get(params.billId);
  }
  @Route(c.waiveBill) waiveBill(
    @Input(c.waiveBill) { params, body }: In<'waiveBill'>,
  ): Out<'waiveBill'> {
    return this.bills.waive(params.billId, body.reason);
  }
  @Route(c.waiveLateFee) waiveLateFee(
    @Input(c.waiveLateFee) { params, body }: In<'waiveLateFee'>,
  ): Out<'waiveLateFee'> {
    return this.bills.waiveLateFee(params.billId, body.reason);
  }

  @Route(c.listPayments) listPayments(
    @Input(c.listPayments) { query }: In<'listPayments'>,
  ): Out<'listPayments'> {
    return this.payments.list(query);
  }
  @Route(c.getPayment) getPayment(
    @Input(c.getPayment) { params }: In<'getPayment'>,
  ): Out<'getPayment'> {
    return this.payments.get(params.paymentId);
  }
  @Route(c.recordPayment) recordPayment(
    @Input(c.recordPayment) { body }: In<'recordPayment'>,
  ): Out<'recordPayment'> {
    return this.payments.record(body);
  }
  @Route(c.reversePayment) reversePayment(
    @Input(c.reversePayment) { params, body }: In<'reversePayment'>,
  ): Out<'reversePayment'> {
    return this.payments.reverse(params.paymentId, body.reason);
  }

  @Route(c.listPlans) listPlans(): Out<'listPlans'> {
    return this.plans.listPlans();
  }
  @Route(c.createPlan) createPlan(
    @Input(c.createPlan) { body }: In<'createPlan'>,
  ): Out<'createPlan'> {
    return this.plans.createPlan(body);
  }
  @Route(c.updatePlan) updatePlan(
    @Input(c.updatePlan) { params, body }: In<'updatePlan'>,
  ): Out<'updatePlan'> {
    return this.plans.updatePlan(params.planId, body);
  }
  @Route(c.setPlanOverride) setPlanOverride(
    @Input(c.setPlanOverride) { params, body }: In<'setPlanOverride'>,
  ): Out<'setPlanOverride'> {
    return this.plans.setOverride(params.planId, body.flatId, body.amountPaise);
  }

  @Route(c.listInstructions) listInstructions(): Out<'listInstructions'> {
    return this.plans.listInstructions();
  }
  @Route(c.createInstruction) createInstruction(
    @Input(c.createInstruction) { body }: In<'createInstruction'>,
  ): Out<'createInstruction'> {
    return this.plans.createInstruction(body);
  }
  @Route(c.updateInstruction) updateInstruction(
    @Input(c.updateInstruction) { params, body }: In<'updateInstruction'>,
  ): Out<'updateInstruction'> {
    return this.plans.updateInstruction(params.instructionId, body);
  }
  @Route(c.deleteInstruction) async deleteInstruction(
    @Input(c.deleteInstruction) { params }: In<'deleteInstruction'>,
  ): Out<'deleteInstruction'> {
    await this.plans.deleteInstruction(params.instructionId);
    return { ok: true };
  }
}
