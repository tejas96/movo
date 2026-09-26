/// <reference path="./images.d.ts" />
import auth from '../../assets/photos/auth.jpg';
import directory from '../../assets/photos/directory.jpg';
import duties from '../../assets/photos/duties.jpg';
import emergency from '../../assets/photos/emergency.jpg';
import empty from '../../assets/photos/empty.jpg';
import events from '../../assets/photos/events.jpg';
import expenses from '../../assets/photos/expenses.jpg';
import food from '../../assets/photos/food.jpg';
import manage from '../../assets/photos/manage.jpg';
import market from '../../assets/photos/market.jpg';
import meetings from '../../assets/photos/meetings.jpg';
import money from '../../assets/photos/money.jpg';
import notices from '../../assets/photos/notices.jpg';
import parking from '../../assets/photos/parking.jpg';
import product from '../../assets/photos/product.jpg';
import resale from '../../assets/photos/resale.jpg';
import rewards from '../../assets/photos/rewards.jpg';
import services from '../../assets/photos/services.jpg';
import society from '../../assets/photos/society.jpg';
import society2 from '../../assets/photos/society-2.jpg';
import tasks from '../../assets/photos/tasks.jpg';

/**
 * Bundled stock photos (free licences, see assets/photos/CREDITS.md). They bring the colour:
 * the UI itself stays white, gray and black. A society's own photos replace them once uploads exist.
 */
export const photos = {
  auth,
  directory,
  duties,
  emergency,
  empty,
  events,
  expenses,
  food,
  manage,
  market,
  meetings,
  money,
  notices,
  parking,
  product,
  resale,
  rewards,
  services,
  society,
  society2,
  tasks,
} as const;

export type PhotoName = keyof typeof photos;
