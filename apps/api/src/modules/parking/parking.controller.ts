import { parkingContract, type RouteInput, type RouteResponse } from '@movo/contracts';
import { Controller } from '@nestjs/common';
import { Input } from '../../common/route/input.decorator';
import { Route } from '../../common/route/route.decorator';
import { ParkingService } from './parking.service';

const c = parkingContract;
type In<K extends keyof typeof c> = RouteInput<(typeof c)[K]>;
type Out<K extends keyof typeof c> = Promise<RouteResponse<(typeof c)[K]>>;

@Controller()
export class ParkingController {
  constructor(private readonly parking: ParkingService) {}

  @Route(c.mine) mine(): Out<'mine'> {
    return this.parking.mine();
  }
  @Route(c.listSlots) listSlots(@Input(c.listSlots) { query }: In<'listSlots'>): Out<'listSlots'> {
    return this.parking.listSlots(query);
  }
  @Route(c.createSlots) createSlots(
    @Input(c.createSlots) { body }: In<'createSlots'>,
  ): Out<'createSlots'> {
    return this.parking.createSlots(body);
  }
  @Route(c.updateSlot) updateSlot(
    @Input(c.updateSlot) { params, body }: In<'updateSlot'>,
  ): Out<'updateSlot'> {
    return this.parking.updateSlot(params.slotId, body);
  }
  @Route(c.allocate) allocate(
    @Input(c.allocate) { params, body }: In<'allocate'>,
  ): Out<'allocate'> {
    return this.parking.allocate(params.slotId, body);
  }
  @Route(c.release) release(@Input(c.release) { params }: In<'release'>): Out<'release'> {
    return this.parking.release(params.slotId);
  }
  @Route(c.listVehicles) listVehicles(
    @Input(c.listVehicles) { query }: In<'listVehicles'>,
  ): Out<'listVehicles'> {
    return this.parking.listVehicles(query);
  }
  @Route(c.createVehicle) createVehicle(
    @Input(c.createVehicle) { body }: In<'createVehicle'>,
  ): Out<'createVehicle'> {
    return this.parking.createVehicle(body);
  }
  @Route(c.updateVehicle) updateVehicle(
    @Input(c.updateVehicle) { params, body }: In<'updateVehicle'>,
  ): Out<'updateVehicle'> {
    return this.parking.updateVehicle(params.vehicleId, body);
  }
  @Route(c.deleteVehicle) async deleteVehicle(
    @Input(c.deleteVehicle) { params }: In<'deleteVehicle'>,
  ): Out<'deleteVehicle'> {
    await this.parking.deleteVehicle(params.vehicleId);
    return { ok: true };
  }
}
