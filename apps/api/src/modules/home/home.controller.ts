import { type HomeSummary, homeContract } from '@movo/contracts';
import { Controller } from '@nestjs/common';
import { Route } from '../../common/route/route.decorator';
import { HomeService } from './home.service';

@Controller()
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Route(homeContract.summary)
  summary(): Promise<HomeSummary> {
    return this.home.summary();
  }
}
