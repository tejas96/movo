import { z } from 'zod';
import { FlatRefSchema, IdSchema, IsoDateTimeSchema, OkSchema } from '../core/common';
import { defineRoute } from '../core/route';

export const ParkingSlotTypeSchema = z.enum(['TWO_WHEELER', 'FOUR_WHEELER', 'EV', 'OTHER']);
export type ParkingSlotType = z.infer<typeof ParkingSlotTypeSchema>;

export const ParkingSlotStatusSchema = z.enum(['ACTIVE', 'BLOCKED', 'VISITOR']);
export type ParkingSlotStatus = z.infer<typeof ParkingSlotStatusSchema>;

export const VehicleTypeSchema = z.enum(['TWO_WHEELER', 'FOUR_WHEELER', 'EV', 'OTHER']);
export type VehicleType = z.infer<typeof VehicleTypeSchema>;

/** "MH 12 ab-1234" -> "MH12AB1234". Same rule on both sides so duplicates are caught. */
export function normalizeRegistration(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export const RegistrationNoSchema = z
  .string()
  .trim()
  .transform(normalizeRegistration)
  .pipe(z.string().min(4).max(15));

export const VehicleSchema = z.object({
  id: IdSchema,
  flat: FlatRefSchema,
  registrationNo: z.string(),
  type: VehicleTypeSchema,
  makeModel: z.string().nullable(),
  color: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
});
export type Vehicle = z.infer<typeof VehicleSchema>;

export const ParkingAllocationSchema = z.object({
  id: IdSchema,
  flat: FlatRefSchema,
  fromDate: IsoDateTimeSchema,
  notes: z.string().nullable(),
});

export const ParkingSlotSchema = z.object({
  id: IdSchema,
  code: z.string(),
  type: ParkingSlotTypeSchema,
  level: z.string().nullable(),
  status: ParkingSlotStatusSchema,
  /** null = free. */
  allocation: ParkingAllocationSchema.nullable(),
});
export type ParkingSlot = z.infer<typeof ParkingSlotSchema>;

export const MyParkingSchema = z.object({
  flats: z.array(
    z.object({
      flat: FlatRefSchema,
      slots: z.array(ParkingSlotSchema),
      vehicles: z.array(VehicleSchema),
    }),
  ),
  /** true when this member may see every slot and allocation. */
  canSeeAll: z.boolean(),
});
export type MyParking = z.infer<typeof MyParkingSchema>;

const societyParams = z.object({ societyId: IdSchema });
const slotParams = societyParams.extend({ slotId: IdSchema });
const vehicleParams = societyParams.extend({ vehicleId: IdSchema });

const SlotInputSchema = z.object({
  code: z.string().trim().min(1).max(20),
  type: ParkingSlotTypeSchema.default('FOUR_WHEELER'),
  level: z.string().trim().max(20).nullable().optional(),
});

const VehicleInputSchema = z.object({
  flatId: IdSchema,
  registrationNo: RegistrationNoSchema,
  type: VehicleTypeSchema.default('FOUR_WHEELER'),
  makeModel: z.string().trim().max(40).nullable().optional(),
  color: z.string().trim().max(20).nullable().optional(),
});

export const parkingContract = {
  mine: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/parking/me',
    summary: 'Slots and vehicles of my flats',
    module: 'parking',
    params: societyParams,
    response: MyParkingSchema,
  }),

  listSlots: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/parking/slots',
    summary: 'Every slot with its allocation. Managers always; members when the society allows it.',
    module: 'parking',
    params: societyParams,
    query: z.object({
      status: ParkingSlotStatusSchema.optional(),
      free: z.enum(['true', 'false']).optional(),
    }),
    response: z.array(ParkingSlotSchema),
  }),
  createSlots: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/parking/slots',
    summary: 'Add one or many slots. Codes must be unique in the society.',
    module: 'parking',
    permission: 'parking.manage',
    params: societyParams,
    body: z.object({ slots: z.array(SlotInputSchema).min(1).max(500) }).strict(),
    response: z.array(ParkingSlotSchema),
  }),
  updateSlot: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/parking/slots/:slotId',
    summary: 'Rename, retype or block a slot',
    module: 'parking',
    permission: 'parking.manage',
    params: slotParams,
    body: SlotInputSchema.partial().extend({ status: ParkingSlotStatusSchema.optional() }).strict(),
    response: ParkingSlotSchema,
  }),
  allocate: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/parking/slots/:slotId/allocation',
    summary: 'Give a free slot to a flat. A taken slot must be released first.',
    module: 'parking',
    permission: 'parking.manage',
    params: slotParams,
    body: z
      .object({ flatId: IdSchema, notes: z.string().trim().max(200).nullable().optional() })
      .strict(),
    response: ParkingSlotSchema,
  }),
  release: defineRoute({
    method: 'DELETE',
    path: '/v1/societies/:societyId/parking/slots/:slotId/allocation',
    summary: 'End the current allocation of a slot',
    module: 'parking',
    permission: 'parking.manage',
    params: slotParams,
    response: ParkingSlotSchema,
  }),

  listVehicles: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/parking/vehicles',
    summary:
      'Vehicles. Members see their own flats; managers, staff, or everyone (by setting) see all.',
    module: 'parking',
    params: societyParams,
    query: z.object({
      flatId: IdSchema.optional(),
      q: z.string().trim().max(20).optional(),
    }),
    response: z.array(VehicleSchema),
  }),
  createVehicle: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/parking/vehicles',
    summary: 'Register a vehicle to a flat. Your own flat, or any flat with parking.manage.',
    module: 'parking',
    params: societyParams,
    body: VehicleInputSchema.strict(),
    response: VehicleSchema,
  }),
  updateVehicle: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/parking/vehicles/:vehicleId',
    summary: 'Edit a vehicle',
    module: 'parking',
    params: vehicleParams,
    body: VehicleInputSchema.omit({ flatId: true }).partial().strict(),
    response: VehicleSchema,
  }),
  deleteVehicle: defineRoute({
    method: 'DELETE',
    path: '/v1/societies/:societyId/parking/vehicles/:vehicleId',
    summary: 'Remove a vehicle',
    module: 'parking',
    params: vehicleParams,
    response: OkSchema,
  }),
};
