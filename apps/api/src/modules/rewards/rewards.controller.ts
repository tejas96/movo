import { type RouteInput, type RouteResponse, rewardsContract } from '@movo/contracts';
import { Controller } from '@nestjs/common';
import { Input } from '../../common/route/input.decorator';
import { Route } from '../../common/route/route.decorator';
import { RewardsService } from './rewards.service';

const c = rewardsContract;
type In<K extends keyof typeof c> = RouteInput<(typeof c)[K]>;
type Out<K extends keyof typeof c> = Promise<RouteResponse<(typeof c)[K]>>;

@Controller()
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Route(c.mine) mine(): Out<'mine'> {
    return this.rewards.mine();
  }
  @Route(c.leaderboard) leaderboard(): Out<'leaderboard'> {
    return this.rewards.leaderboard();
  }
  @Route(c.member) member(@Input(c.member) { params }: In<'member'>): Out<'member'> {
    return this.rewards.member(params.membershipId);
  }
  @Route(c.adjust) adjust(@Input(c.adjust) { body }: In<'adjust'>): Out<'adjust'> {
    return this.rewards.adjust(body.membershipId, body.delta, body.note);
  }
}
