import { maintenanceBillRoutes } from './bills.contract';
import { maintenanceInstructionRoutes } from './instructions.contract';
import { maintenancePaymentRoutes } from './payments.contract';
import { maintenancePlanRoutes } from './plans.contract';

export * from './maintenance.schemas';

/** Every maintenance route. The parts live in one file per area; keys and order are unchanged. */
export const maintenanceContract = {
  ...maintenanceBillRoutes,
  ...maintenancePaymentRoutes,
  ...maintenancePlanRoutes,
  ...maintenanceInstructionRoutes,
};
