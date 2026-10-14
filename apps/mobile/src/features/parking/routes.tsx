import type { Vehicle } from '@movo/contracts';
import { editorOptions, type FeatureRoutes } from '../../core/navigation/routes';
import { ParkingScreen } from './ParkingScreen';
import { ParkingSlotsScreen } from './ParkingSlotsScreen';
import { VehicleEditorScreen } from './VehicleEditorScreen';

export type ParkingParams = {
  Parking: undefined;
  VehicleEditor: { vehicle?: Vehicle; flatId?: string } | undefined;
  ParkingSlots: undefined;
};

export const parkingRoutes: FeatureRoutes<ParkingParams> = {
  screens: [
    { name: 'Parking', component: ParkingScreen, group: 'app' },
    { name: 'VehicleEditor', component: VehicleEditorScreen, group: 'app', options: editorOptions },
    { name: 'ParkingSlots', component: ParkingSlotsScreen, group: 'app' },
  ],
};
