import { marketContract, type RouteInput, type RouteResponse } from '@movo/contracts';
import { Controller } from '@nestjs/common';
import { Input } from '../../common/route/input.decorator';
import { Route } from '../../common/route/route.decorator';
import { ListingsService } from './listings.service';
import { ModerationService } from './moderation.service';
import { OrdersService } from './orders.service';

const c = marketContract;
type In<K extends keyof typeof c> = RouteInput<(typeof c)[K]>;
type Out<K extends keyof typeof c> = Promise<RouteResponse<(typeof c)[K]>>;

@Controller()
export class MarketController {
  constructor(
    private readonly listings: ListingsService,
    private readonly moderation: ModerationService,
    private readonly orders: OrdersService,
  ) {}

  @Route(c.listListings) listListings(
    @Input(c.listListings) { query }: In<'listListings'>,
  ): Out<'listListings'> {
    return this.listings.list(query);
  }
  @Route(c.myListings) myListings(): Out<'myListings'> {
    return this.listings.mine();
  }
  @Route(c.getListing) getListing(
    @Input(c.getListing) { params }: In<'getListing'>,
  ): Out<'getListing'> {
    return this.listings.get(params.listingId);
  }
  @Route(c.createListing) createListing(
    @Input(c.createListing) { body }: In<'createListing'>,
  ): Out<'createListing'> {
    return this.listings.create(body);
  }
  @Route(c.updateListing) updateListing(
    @Input(c.updateListing) { params, body }: In<'updateListing'>,
  ): Out<'updateListing'> {
    return this.listings.update(params.listingId, body);
  }
  @Route(c.setListingStatus) setListingStatus(
    @Input(c.setListingStatus) { params, body }: In<'setListingStatus'>,
  ): Out<'setListingStatus'> {
    return this.listings.setStatus(params.listingId, body.status);
  }
  @Route(c.reportListing) async reportListing(
    @Input(c.reportListing) { params, body }: In<'reportListing'>,
  ): Out<'reportListing'> {
    await this.listings.report(params.listingId, body.reason);
    return { ok: true };
  }

  @Route(c.listReports) listReports(): Out<'listReports'> {
    return this.moderation.reports();
  }
  @Route(c.hideListing) hideListing(
    @Input(c.hideListing) { params, body }: In<'hideListing'>,
  ): Out<'hideListing'> {
    return this.moderation.hide(params.listingId, body.reason);
  }
  @Route(c.unhideListing) unhideListing(
    @Input(c.unhideListing) { params }: In<'unhideListing'>,
  ): Out<'unhideListing'> {
    return this.moderation.unhide(params.listingId);
  }
  @Route(c.dismissReport) async dismissReport(
    @Input(c.dismissReport) { params }: In<'dismissReport'>,
  ): Out<'dismissReport'> {
    await this.moderation.dismiss(params.reportId);
    return { ok: true };
  }

  @Route(c.createOrder) createOrder(
    @Input(c.createOrder) { params, body }: In<'createOrder'>,
  ): Out<'createOrder'> {
    return this.orders.order(params.listingId, body);
  }
  @Route(c.listOrders) listOrders(
    @Input(c.listOrders) { query }: In<'listOrders'>,
  ): Out<'listOrders'> {
    return this.orders.orders(query.role);
  }
  @Route(c.getOrder) getOrder(@Input(c.getOrder) { params }: In<'getOrder'>): Out<'getOrder'> {
    return this.orders.getOrder(params.orderId);
  }
  @Route(c.acceptOrder) acceptOrder(
    @Input(c.acceptOrder) { params }: In<'acceptOrder'>,
  ): Out<'acceptOrder'> {
    return this.orders.accept(params.orderId);
  }
  @Route(c.rejectOrder) rejectOrder(
    @Input(c.rejectOrder) { params, body }: In<'rejectOrder'>,
  ): Out<'rejectOrder'> {
    return this.orders.reject(params.orderId, body.reason);
  }
  @Route(c.markOrderReady) markOrderReady(
    @Input(c.markOrderReady) { params }: In<'markOrderReady'>,
  ): Out<'markOrderReady'> {
    return this.orders.ready(params.orderId);
  }
  @Route(c.completeOrder) completeOrder(
    @Input(c.completeOrder) { params }: In<'completeOrder'>,
  ): Out<'completeOrder'> {
    return this.orders.complete(params.orderId);
  }
  @Route(c.cancelOrder) cancelOrder(
    @Input(c.cancelOrder) { params, body }: In<'cancelOrder'>,
  ): Out<'cancelOrder'> {
    return this.orders.cancel(params.orderId, body.reason);
  }
  @Route(c.sendMessage) sendMessage(
    @Input(c.sendMessage) { params, body }: In<'sendMessage'>,
  ): Out<'sendMessage'> {
    return this.orders.message(params.orderId, body.body);
  }
  @Route(c.reviewOrder) reviewOrder(
    @Input(c.reviewOrder) { params, body }: In<'reviewOrder'>,
  ): Out<'reviewOrder'> {
    return this.orders.review(params.orderId, body.rating, body.text);
  }
}
