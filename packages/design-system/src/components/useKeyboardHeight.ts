import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, type KeyboardEvent, Platform } from 'react-native';

/**
 * How much of the screen the keyboard covers, 0 when it is closed. The app draws edge to edge,
 * so Android no longer shrinks the window for the keyboard; views outside a KeyboardAvoidingView
 * (the BottomBar) use this to lift themselves.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const onShow = (e: KeyboardEvent) =>
      setHeight(Math.max(0, Dimensions.get('screen').height - e.endCoordinates.screenY));
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', onShow);
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}
