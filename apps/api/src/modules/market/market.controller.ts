import { marketContract, type RouteInput, type RouteResponse } from '@movo/contracts';
import { Controller } from '@nestjs/common';
import { Input } from '../../common/route/input.decorator';
import { Route } from '../../common/route/route.decorator';
import { MarketService } from './market.service';

const c = marketContract;
type In<K extends keyof typeof c> = RouteInput<(typeof c)[K]>;
type Out<K extends keyof typeof c> = Promise<RouteResponse<(typeof c)[K]>>;

@Controller()
export class MarketController {
  constructor(private readonly market: MarketService) {}

  @Route(c.listListings) listListings(
    @Input(c.listListings) { query }: In<'listListings'>,
  ): Out<'listListings'> {
    return this.market.list(query);
  }
  @Route(c.myListings) myListings(): Out<'myListings'> {
    return this.market.mine();
  }
  @Route(c.getListing) getListing(
    @Input(c.getListing) { params }: In<'getListing'>,
  ): Out<'getListing'> {
    return this.market.get(params.listingId);
  }
  @Route(c.createListing) createListing(
    @Input(c.createListing) { body }: In<'createListing'>,
  ): Out<'createListing'> {
    return this.market.create(body);
  }
  @Route(c.updateListing) updateListing(
    @Input(c.updateListing) { params, body }: In<'updateListing'>,
  ): Out<'updateListing'> {
    return this.market.update(params.listingId, body);
  }
  @Route(c.setListingStatus) setListingStatus(
    @Input(c.setListingStatus) { params, body }: In<'setListingStatus'>,
  ): Out<'setListingStatus'> {
    return this.market.setStatus(params.listingId, body.status);
  }
  @Route(c.reportListing) async reportListing(
    @Input(c.reportListing) { params, body }: In<'reportListing'>,
  ): Out<'reportListing'> {
    await this.market.report(params.listingId, body.reason);
    return { ok: true };
  }

  @Route(c.listReports) listReports(): Out<'listReports'> {
    return this.market.reports();
  }
  @Route(c.hideListing) hideListing(
    @Input(c.hideListing) { params, body }: In<'hideListing'>,
  ): Out<'hideListing'> {
    return this.market.hide(params.listingId, body.reason);
  }
  @Route(c.unhideListing) unhideListing(
    @Input(c.unhideListing) { params }: In<'unhideListing'>,
  ): Out<'unhideListing'> {
    return this.market.unhide(params.listingId);
  }
  @Route(c.dismissReport) async dismissReport(
    @Input(c.dismissReport) { params }: In<'dismissReport'>,
  ): Out<'dismissReport'> {
    await this.market.dismiss(params.reportId);
    return { ok: true };
  }

  @Route(c.createOrder) createOrder(
    @Input(c.createOrder) { params, body }: In<'createOrder'>,
  ): Out<'createOrder'> {
    return this.market.order(params.listingId, body);
  }
  @Route(c.listOrders) listOrders(
    @Input(c.listOrders) { query }: In<'listOrders'>,
  ): Out<'listOrders'> {
    return this.market.orders(query.role);
  }
  @Route(c.getOrder) getOrder(@Input(c.getOrder) { params }: In<'getOrder'>): Out<'getOrder'> {
    return this.market.getOrder(params.orderId);
  }
  @Route(c.acceptOrder) acceptOrder(
    @Input(c.acceptOrder) { params }: In<'acceptOrder'>,
  ): Out<'acceptOrder'> {
    return this.market.accept(params.orderId);
  }
  @Route(c.rejectOrder) rejectOrder(
    @Input(c.rejectOrder) { params, body }: In<'rejectOrder'>,
  ): Out<'rejectOrder'> {
    return this.market.reject(params.orderId, body.reason);
  }
  @Route(c.markOrderReady) markOrderReady(
    @Input(c.markOrderReady) { params }: In<'markOrderReady'>,
  ): Out<'markOrderReady'> {
    return this.market.ready(params.orderId);
  }
  @Route(c.completeOrder) completeOrder(
    @Input(c.completeOrder) { params }: In<'completeOrder'>,
  ): Out<'completeOrder'> {
    return this.market.complete(params.orderId);
  }
  @Route(c.cancelOrder) cancelOrder(
    @Input(c.cancelOrder) { params, body }: In<'cancelOrder'>,
  ): Out<'cancelOrder'> {
    return this.market.cancel(params.orderId, body.reason);
  }
  @Route(c.sendMessage) sendMessage(
    @Input(c.sendMessage) { params, body }: In<'sendMessage'>,
  ): Out<'sendMessage'> {
    return this.market.message(params.orderId, body.body);
  }
  @Route(c.reviewOrder) reviewOrder(
    @Input(c.reviewOrder) { params, body }: In<'reviewOrder'>,
  ): Out<'reviewOrder'> {
    return this.market.review(params.orderId, body.rating, body.text);
  }
}
