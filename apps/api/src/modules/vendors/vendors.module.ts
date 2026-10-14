import { Module, type OnModuleInit } from '@nestjs/common';
import { HOME_ORDER, HomeRegistry } from '../../common/home/home-registry';
import { Lifecycle } from '../../common/lifecycle/lifecycle';
import { can } from '../../common/tenant/tenant.types';
import { VendorsController } from './vendors.controller';
import { defaultVendorCategoryRows, VendorsService } from './vendors.service';

@Module({
  controllers: [VendorsController],
  providers: [VendorsService],
  exports: [VendorsService],
})
export class VendorsModule implements OnModuleInit {
  constructor(
    private readonly lifecycle: Lifecycle,
    private readonly home: HomeRegistry,
    private readonly vendors: VendorsService,
  ) {}

  onModuleInit(): void {
    this.lifecycle.onSocietyCreated((tx, societyId) =>
      tx.vendorCategory.createMany({ data: defaultVendorCategoryRows(societyId) }),
    );
    this.home.register({
      module: 'vendors',
      order: HOME_ORDER.vendors,
      load: async (ctx) => {
        if (!can(ctx, 'vendor.manage')) return {};
        const suggestions = await this.vendors.countSuggestions();
        return {
          attention: suggestions > 0 ? [{ type: 'VENDOR_SUGGESTIONS', count: suggestions }] : [],
        };
      },
    });
  }
}
