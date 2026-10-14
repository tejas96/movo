import { describe, expect, it } from 'vitest';
import { allowedFrom, canMove, orderActions } from './order-state';

describe('order state', () => {
  it('lets only the seller accept, reject and mark ready', () => {
    expect(allowedFrom('accept', 'buyer')).toEqual([]);
    expect(allowedFrom('accept', 'seller')).toEqual(['REQUESTED']);
    expect(canMove('ready', 'seller', 'ACCEPTED')).toBe(true);
    expect(canMove('ready', 'seller', 'REQUESTED')).toBe(false);
  });

  it('cancels from different steps per side', () => {
    expect(allowedFrom('cancel', 'buyer')).toEqual(['REQUESTED', 'ACCEPTED']);
    expect(allowedFrom('cancel', 'seller')).toEqual(['ACCEPTED', 'READY']);
  });

  it('derives the can* flags from the same table', () => {
    expect(orderActions('seller', 'REQUESTED', false)).toEqual({
      canAccept: true,
      canReject: true,
      canMarkReady: false,
      canComplete: false,
      canCancel: false,
      canMessage: true,
      canReview: false,
    });
    expect(orderActions('buyer', 'COMPLETED', false)).toMatchObject({
      canComplete: false,
      canCancel: false,
      canMessage: true,
      canReview: true,
    });
    expect(orderActions('buyer', 'COMPLETED', true).canReview).toBe(false);
    expect(orderActions('buyer', 'CANCELLED', false).canMessage).toBe(false);
  });
});
