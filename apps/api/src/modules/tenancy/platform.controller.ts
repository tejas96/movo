import { platformContract, type RouteInput, type RouteResponse } from '@movo/contracts';
import { Controller } from '@nestjs/common';
import { Input } from '../../common/route/input.decorator';
import { Route } from '../../common/route/route.decorator';
import { SocietiesService } from './societies.service';

const c = platformContract;

@Controller()
export class PlatformController {
  constructor(private readonly societies: SocietiesService) {}

  @Route(c.createSociety)
  create(
    @Input(c.createSociety) { body }: RouteInput<typeof c.createSociety>,
  ): Promise<RouteResponse<typeof c.createSociety>> {
    return this.societies.create(body);
  }

  @Route(c.listSocieties)
  list(): Promise<RouteResponse<typeof c.listSocieties>> {
    return this.societies.listAll();
  }
}
