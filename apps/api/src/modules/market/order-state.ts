import type { OrderStatus } from '@movo/contracts';

/**
 * The market order state machine, in one place. The services use `allowedFrom` to guard
 * their status updates; the order DTO uses `orderActions` for its can* flags.
 */

export type OrderSide = 'buyer' | 'seller';
export type OrderMove = 'accept' | 'reject' | 'ready' | 'complete' | 'cancel';

/** Orders still in progress. */
export const OPEN_ORDER: readonly OrderStatus[] = ['REQUESTED', 'ACCEPTED', 'READY'];

/** Statuses each move can start from, per side of the order. */
const FROM: Record<OrderMove, Record<OrderSide, readonly OrderStatus[]>> = {
  accept: { seller: ['REQUESTED'], buyer: [] },
  reject: { seller: ['REQUESTED'], buyer: [] },
  ready: { seller: ['ACCEPTED'], buyer: [] },
  complete: { seller: ['ACCEPTED', 'READY'], buyer: ['ACCEPTED', 'READY'] },
  cancel: { seller: ['ACCEPTED', 'READY'], buyer: ['REQUESTED', 'ACCEPTED'] },
};

export function allowedFrom(move: OrderMove, side: OrderSide): OrderStatus[] {
  return [...FROM[move][side]];
}

export function canMove(move: OrderMove, side: OrderSide, status: OrderStatus): boolean {
  return FROM[move][side].includes(status);
}

export function isOpenOrder(status: OrderStatus): boolean {
  return OPEN_ORDER.includes(status);
}

/** Chat stays open while the order runs and after it completes. */
export function canMessageOrder(status: OrderStatus): boolean {
  return isOpenOrder(status) || status === 'COMPLETED';
}

/** Only the buyer reviews, once, after completion. */
export function canReviewOrder(side: OrderSide, status: OrderStatus, reviewed: boolean): boolean {
  return side === 'buyer' && status === 'COMPLETED' && !reviewed;
}

/** "Seller shows flat/phone" once the seller agreed. */
export function isAgreed(status: OrderStatus): boolean {
  return status === 'ACCEPTED' || status === 'READY' || status === 'COMPLETED';
}

export function orderActions(side: OrderSide, status: OrderStatus, reviewed: boolean) {
  return {
    canAccept: canMove('accept', side, status),
    canReject: canMove('reject', side, status),
    canMarkReady: canMove('ready', side, status),
    canComplete: canMove('complete', side, status),
    canCancel: canMove('cancel', side, status),
    canMessage: canMessageOrder(status),
    canReview: canReviewOrder(side, status, reviewed),
  };
}
