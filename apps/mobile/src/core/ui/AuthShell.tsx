import {
  Backdrop,
  DotTexture,
  Glass,
  IconSquare,
  Rise,
  Strong,
  Text,
  theme,
} from '@movo/design-system';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface AuthShellProps {
  /** Light part of the headline. */
  title: string;
  /** The one bold word at the end of the headline ("Good to see you **again**"). */
  titleBold?: string;
  subtitle?: string;
  /** A small moving drawing at the top of the card (the waving hand on Log in). */
  art?: ReactNode;
  /** Back button, for screens reached from Log in or Welcome. */
  onBack?: () => void;
  /** Any other button in the back button's place (Sign out on Join). */
  leading?: ReactNode;
  /** The form, inside the glass card. */
  children: ReactNode;
  /** The main button, pinned under the card near the bottom. */
  action?: ReactNode;
  /** Links under the main button. */
  footer?: ReactNode;
}

/**
 * The Soft Glow front door, laid out like docs/design/soft-glow/source/Login.dc.html: mist with
 * the pink and lavender glow, back · MOVO header, a dotted glass card with the drawing, the
 * headline and the form, then the main button and links at the bottom. The page scrolls and
 * moves up with the keyboard, so fields never hide behind it.
 */
export function AuthShell({
  title,
  titleBold,
  subtitle,
  art,
  onBack,
  leading,
  children,
  action,
  footer,
}: AuthShellProps) {
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <Backdrop scene="soft" />
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 14, paddingBottom: Math.max(insets.bottom, 16) + 14 },
          ]}
        >
          <Rise>
            <View style={styles.header}>
              {leading ? (
                leading
              ) : onBack ? (
                <IconSquare
                  icon="back"
                  variant="linear"
                  diameter={46}
                  onPress={onBack}
                  accessibilityLabel={t('actions.back')}
                />
              ) : (
                <View style={styles.side} />
              )}
              <Text style={styles.brand}>{BRAND}</Text>
              <View style={styles.side} />
            </View>
          </Rise>

          <Rise delay={80}>
            <Glass radius={32} style={styles.card}>
              <DotTexture center={{ x: 0.5, y: 0.22 }} reach={0.6} />
              {art ? <View style={styles.art}>{art}</View> : null}
              <View style={styles.head}>
                <Text variant="greet" center>
                  {title}
                  {titleBold ? (
                    <>
                      {' '}
                      <Strong>{titleBold}</Strong>
                    </>
                  ) : null}
                </Text>
                {subtitle ? (
                  <Text variant="body" tone="secondary" center style={styles.subtitle}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              {children}
            </Glass>
          </Rise>

          <View style={styles.flex} />

          {action || footer ? (
            <Rise delay={200}>
              <View style={styles.bottom}>
                {action}
                {footer ? <View style={styles.footer}>{footer}</View> : null}
              </View>
            </Rise>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** The name in the header, as the mockup writes it. Not translated. */
const BRAND = 'MOVO';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg.canvas },
  flex: { flexGrow: 1 },
  content: { flexGrow: 1, paddingHorizontal: theme.layout.gutter, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { width: 46, height: 46 },
  brand: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 20,
    lineHeight: 28,
    color: theme.color.text.primary,
  },
  card: { overflow: 'hidden', paddingTop: 28, paddingHorizontal: 18, paddingBottom: 20, gap: 16 },
  art: { alignSelf: 'center' },
  head: { gap: 6 },
  subtitle: { fontSize: 14, lineHeight: 21 },
  bottom: { gap: 14, paddingTop: 16 },
  footer: { alignItems: 'center', gap: 6 },
});
