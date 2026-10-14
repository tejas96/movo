import { z } from 'zod';
import { IdSchema, SocietyParamsSchema } from '../core/common';
import { FlatStatusSchema, OccupancyRelationSchema } from '../core/enums';
import { defineRoute } from '../core/route';

export const BuildingSchema = z.object({
  id: IdSchema,
  name: z.string(),
  floorsCount: z.number().int().nullable(),
  sortOrder: z.number().int(),
  flatCount: z.number().int(),
});
export type Building = z.infer<typeof BuildingSchema>;

export const FlatOccupantSchema = z.object({
  membershipId: IdSchema,
  displayName: z.string(),
  relation: OccupancyRelationSchema,
  isPrimaryContact: z.boolean(),
});

export const FlatSchema = z.object({
  id: IdSchema,
  buildingId: IdSchema.nullable(),
  buildingName: z.string().nullable(),
  number: z.string(),
  floor: z.number().int().nullable(),
  type: z.string().nullable(),
  areaSqft: z.number().int().nullable(),
  status: FlatStatusSchema,
  occupants: z.array(FlatOccupantSchema),
});
export type Flat = z.infer<typeof FlatSchema>;

const FlatInputSchema = z.object({
  buildingId: IdSchema.nullable().optional(),
  number: z.string().trim().min(1).max(20),
  floor: z.number().int().min(-5).max(200).nullable().optional(),
  type: z.string().trim().max(20).nullable().optional(),
  areaSqft: z.number().int().min(1).max(100000).nullable().optional(),
});

/** Buildings (wings) and flats. Part of societyContract. */
export const societyStructureRoutes = {
  listBuildings: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/buildings',
    summary: 'Buildings or wings',
    params: SocietyParamsSchema,
    response: z.array(BuildingSchema),
  }),
  createBuilding: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/buildings',
    summary: 'Add a building or wing',
    permission: 'society.structure.manage',
    params: SocietyParamsSchema,
    body: z
      .object({
        name: z.string().trim().min(1).max(40),
        floorsCount: z.number().int().min(1).max(200).nullable().optional(),
      })
      .strict(),
    response: BuildingSchema,
  }),
  updateBuilding: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/buildings/:buildingId',
    summary: 'Rename or reorder a building',
    permission: 'society.structure.manage',
    params: SocietyParamsSchema.extend({ buildingId: IdSchema }),
    body: z
      .object({
        name: z.string().trim().min(1).max(40).optional(),
        floorsCount: z.number().int().min(1).max(200).nullable().optional(),
        sortOrder: z.number().int().optional(),
      })
      .strict(),
    response: BuildingSchema,
  }),

  listFlats: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/flats',
    summary: 'Flats with their occupants',
    params: SocietyParamsSchema,
    query: z.object({ buildingId: IdSchema.optional() }),
    response: z.array(FlatSchema),
  }),
  createFlats: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/flats',
    summary: 'Add one or many flats',
    permission: 'society.structure.manage',
    params: SocietyParamsSchema,
    body: z.object({ flats: z.array(FlatInputSchema).min(1).max(500) }).strict(),
    response: z.array(FlatSchema),
  }),
  updateFlat: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/flats/:flatId',
    summary: 'Edit a flat',
    permission: 'society.structure.manage',
    params: SocietyParamsSchema.extend({ flatId: IdSchema }),
    body: FlatInputSchema.partial().extend({ status: FlatStatusSchema.optional() }).strict(),
    response: FlatSchema,
  }),
};
