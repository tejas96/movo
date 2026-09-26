import { emergencyContract, type RouteInput, type RouteResponse } from '@movo/contracts';
import { Controller } from '@nestjs/common';
import { Input } from '../../common/route/input.decorator';
import { Route } from '../../common/route/route.decorator';
import { EmergencyService } from './emergency.service';

const c = emergencyContract;
type In<K extends keyof typeof c> = RouteInput<(typeof c)[K]>;
type Out<K extends keyof typeof c> = Promise<RouteResponse<(typeof c)[K]>>;

@Controller()
export class EmergencyController {
  constructor(private readonly emergency: EmergencyService) {}

  @Route(c.listContacts) listContacts(): Out<'listContacts'> {
    return this.emergency.listContacts();
  }
  @Route(c.createContact) createContact(
    @Input(c.createContact) { body }: In<'createContact'>,
  ): Out<'createContact'> {
    return this.emergency.createContact(body);
  }
  @Route(c.updateContact) updateContact(
    @Input(c.updateContact) { params, body }: In<'updateContact'>,
  ): Out<'updateContact'> {
    return this.emergency.updateContact(params.contactId, body);
  }
  @Route(c.deleteContact) async deleteContact(
    @Input(c.deleteContact) { params }: In<'deleteContact'>,
  ): Out<'deleteContact'> {
    await this.emergency.deleteContact(params.contactId);
    return { ok: true };
  }
  @Route(c.listAlerts) listAlerts(
    @Input(c.listAlerts) { query }: In<'listAlerts'>,
  ): Out<'listAlerts'> {
    return this.emergency.listAlerts(query);
  }
  @Route(c.getAlert) getAlert(@Input(c.getAlert) { params }: In<'getAlert'>): Out<'getAlert'> {
    return this.emergency.getAlert(params.alertId);
  }
  @Route(c.raiseAlert) raiseAlert(
    @Input(c.raiseAlert) { body }: In<'raiseAlert'>,
  ): Out<'raiseAlert'> {
    return this.emergency.raiseAlert(body);
  }
  @Route(c.resolveAlert) resolveAlert(
    @Input(c.resolveAlert) { params, body }: In<'resolveAlert'>,
  ): Out<'resolveAlert'> {
    return this.emergency.resolveAlert(params.alertId, body);
  }
}
