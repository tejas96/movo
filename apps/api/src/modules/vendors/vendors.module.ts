import { Module, type OnModuleInit } from '@nestjs/common';
import { Lifecycle } from '../../common/lifecycle/lifecycle';
import { VendorsController } from './vendors.controller';
import { defaultVendorCategoryRows, VendorsService } from './vendors.service';

@Module({
  controllers: [VendorsController],
  providers: [VendorsService],
  exports: [VendorsService],
})
export class VendorsModule implements OnModuleInit {
  constructor(private readonly lifecycle: Lifecycle) {}

  onModuleInit(): void {
    this.lifecycle.onSocietyCreated((tx, societyId) =>
      tx.vendorCategory.createMany({ data: defaultVendorCategoryRows(societyId) }),
    );
  }
}
