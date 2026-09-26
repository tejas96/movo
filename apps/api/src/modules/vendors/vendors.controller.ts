import { type RouteInput, type RouteResponse, vendorsContract } from '@movo/contracts';
import { Controller } from '@nestjs/common';
import { Input } from '../../common/route/input.decorator';
import { Route } from '../../common/route/route.decorator';
import { VendorsService } from './vendors.service';

const c = vendorsContract;
type In<K extends keyof typeof c> = RouteInput<(typeof c)[K]>;
type Out<K extends keyof typeof c> = Promise<RouteResponse<(typeof c)[K]>>;

@Controller()
export class VendorsController {
  constructor(private readonly vendors: VendorsService) {}

  @Route(c.listCategories) listCategories(): Out<'listCategories'> {
    return this.vendors.listCategories();
  }
  @Route(c.createCategory) createCategory(
    @Input(c.createCategory) { body }: In<'createCategory'>,
  ): Out<'createCategory'> {
    return this.vendors.createCategory(body);
  }
  @Route(c.updateCategory) updateCategory(
    @Input(c.updateCategory) { params, body }: In<'updateCategory'>,
  ): Out<'updateCategory'> {
    return this.vendors.updateCategory(params.categoryId, body);
  }
  @Route(c.deleteCategory) async deleteCategory(
    @Input(c.deleteCategory) { params }: In<'deleteCategory'>,
  ): Out<'deleteCategory'> {
    await this.vendors.deleteCategory(params.categoryId);
    return { ok: true };
  }
  @Route(c.list) list(@Input(c.list) { query }: In<'list'>): Out<'list'> {
    return this.vendors.list(query);
  }
  @Route(c.get) get(@Input(c.get) { params }: In<'get'>): Out<'get'> {
    return this.vendors.get(params.vendorId);
  }
  @Route(c.create) create(@Input(c.create) { body }: In<'create'>): Out<'create'> {
    return this.vendors.create(body);
  }
  @Route(c.update) update(@Input(c.update) { params, body }: In<'update'>): Out<'update'> {
    return this.vendors.update(params.vendorId, body);
  }
  @Route(c.remove) async remove(@Input(c.remove) { params }: In<'remove'>): Out<'remove'> {
    await this.vendors.remove(params.vendorId);
    return { ok: true };
  }
}
