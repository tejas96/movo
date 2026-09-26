import * as Keychain from 'react-native-keychain';

const SERVICE = 'app.movo.refresh';

/** The refresh token lives in the Keychain / Keystore only. Never in MMKV, never in state. */
export async function saveRefreshToken(token: string): Promise<void> {
  await Keychain.setGenericPassword('movo', token, {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
  });
}

export async function loadRefreshToken(): Promise<string | null> {
  try {
    const creds = await Keychain.getGenericPassword({ service: SERVICE });
    return creds ? creds.password : null;
  } catch {
    return null;
  }
}

export async function clearRefreshToken(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({ service: SERVICE });
  } catch {
    // nothing to clear
  }
}
