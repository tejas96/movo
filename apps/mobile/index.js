import './global.css';
import { setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { pushMessaging } from './src/core/push/push';

// Pushes carry a notification payload, so Android shows them itself while the app is in the
// background. Registering a handler (before the app) keeps Firebase from warning about it.
const messaging = pushMessaging();
if (messaging) setBackgroundMessageHandler(messaging, async () => {});

AppRegistry.registerComponent(appName, () => App);
