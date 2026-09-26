import { joinContract, meContract, type RouteInput, type RouteResponse } from '@movo/contracts';
import { Controller } from '@nestjs/common';
import { requireUser } from '../../common/request-store';
import { Input } from '../../common/route/input.decorator';
import { Route } from '../../common/route/route.decorator';
import { ContextService } from './context.service';
import { InvitationsService } from './invitations.service';
import { JoinRequestsService } from './join-requests.service';

const c = joinContract;

@Controller()
export class JoinController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly joinRequests: JoinRequestsService,
    private readonly context: ContextService,
  ) {}

  @Route(meContract.context)
  meContext(): Promise<RouteResponse<typeof meContract.context>> {
    return this.context.getMeContext(requireUser().id);
  }

  @Route(c.acceptInvite)
  acceptInvite(
    @Input(c.acceptInvite) { body }: RouteInput<typeof c.acceptInvite>,
  ): Promise<RouteResponse<typeof c.acceptInvite>> {
    return this.invitations.accept(requireUser().id, body.code);
  }

  @Route(c.preview)
  preview(
    @Input(c.preview) { params }: RouteInput<typeof c.preview>,
  ): Promise<RouteResponse<typeof c.preview>> {
    return this.joinRequests.preview(params.joinCode);
  }

  @Route(c.request)
  request(
    @Input(c.request) { body }: RouteInput<typeof c.request>,
  ): Promise<RouteResponse<typeof c.request>> {
    return this.joinRequests.request(requireUser().id, body);
  }

  @Route(c.cancelRequest)
  async cancel(
    @Input(c.cancelRequest) { params }: RouteInput<typeof c.cancelRequest>,
  ): Promise<{ ok: true }> {
    await this.joinRequests.cancel(requireUser().id, params.requestId);
    return { ok: true };
  }
}
