import { expensesContract, type RouteInput, type RouteResponse } from '@movo/contracts';
import { Controller } from '@nestjs/common';
import { Input } from '../../common/route/input.decorator';
import { Route } from '../../common/route/route.decorator';
import { ExpensesService } from './expenses.service';
import { ReportService } from './report.service';

const c = expensesContract;
type In<K extends keyof typeof c> = RouteInput<(typeof c)[K]>;
type Out<K extends keyof typeof c> = Promise<RouteResponse<(typeof c)[K]>>;

/** Category routes come first so "categories" is never read as an expense id. */
@Controller()
export class ExpensesController {
  constructor(
    private readonly expenses: ExpensesService,
    private readonly reports: ReportService,
  ) {}

  @Route(c.listCategories) listCategories(): Out<'listCategories'> {
    return this.expenses.listCategories();
  }
  @Route(c.createCategory) createCategory(
    @Input(c.createCategory) { body }: In<'createCategory'>,
  ): Out<'createCategory'> {
    return this.expenses.createCategory(body.name, body.icon);
  }
  @Route(c.updateCategory) updateCategory(
    @Input(c.updateCategory) { params, body }: In<'updateCategory'>,
  ): Out<'updateCategory'> {
    return this.expenses.updateCategory(params.categoryId, body);
  }
  @Route(c.deleteCategory) async deleteCategory(
    @Input(c.deleteCategory) { params }: In<'deleteCategory'>,
  ): Out<'deleteCategory'> {
    await this.expenses.deleteCategory(params.categoryId);
    return { ok: true };
  }

  @Route(c.list) list(@Input(c.list) { query }: In<'list'>): Out<'list'> {
    return this.expenses.list(query);
  }
  @Route(c.create) create(@Input(c.create) { body }: In<'create'>): Out<'create'> {
    return this.expenses.create(body);
  }
  @Route(c.get) get(@Input(c.get) { params }: In<'get'>): Out<'get'> {
    return this.expenses.get(params.expenseId);
  }
  @Route(c.update) update(@Input(c.update) { params, body }: In<'update'>): Out<'update'> {
    return this.expenses.update(params.expenseId, body);
  }
  @Route(c.approve) approve(@Input(c.approve) { params }: In<'approve'>): Out<'approve'> {
    return this.expenses.decide(params.expenseId, true);
  }
  @Route(c.reject) reject(@Input(c.reject) { params, body }: In<'reject'>): Out<'reject'> {
    return this.expenses.decide(params.expenseId, false, body.reason);
  }
  @Route(c.remove) async remove(@Input(c.remove) { params }: In<'remove'>): Out<'remove'> {
    await this.expenses.remove(params.expenseId);
    return { ok: true };
  }

  @Route(c.listIncome) listIncome(
    @Input(c.listIncome) { query }: In<'listIncome'>,
  ): Out<'listIncome'> {
    return this.expenses.listIncome(query.fy);
  }
  @Route(c.createIncome) createIncome(
    @Input(c.createIncome) { body }: In<'createIncome'>,
  ): Out<'createIncome'> {
    return this.expenses.createIncome(body);
  }
  @Route(c.deleteIncome) async deleteIncome(
    @Input(c.deleteIncome) { params }: In<'deleteIncome'>,
  ): Out<'deleteIncome'> {
    await this.expenses.deleteIncome(params.incomeId);
    return { ok: true };
  }

  @Route(c.report) report(@Input(c.report) { query }: In<'report'>): Out<'report'> {
    return this.reports.report(query.fy);
  }
}
