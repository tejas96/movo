/**
 * Developer-only gallery of the Soft Glow parts and drawings, laid out like the mockup so each
 * piece can be checked against docs/design/soft-glow/ref. Registered only in debug builds and
 * opened from the React Native dev menu ("Soft Glow gallery"); release builds never include it.
 * The words here are fixed sample text for designers, not user-facing copy, so they are not in i18n.
 */
import {
  ArrowCircle,
  ArtCard,
  AvatarStack,
  Building,
  Button,
  Chip,
  Coin,
  DIYA_SPARKS,
  Diya,
  DotTexture,
  DuesRing,
  Glass,
  GlowAvatar,
  MapPin,
  Megaphone,
  MovingIcon,
  Orb,
  Rise,
  Screen,
  SectionLabel,
  Sparks,
  Strong,
  Text,
  useCountUp,
  WaterDrop,
  WavingHand,
} from '@movo/design-system';
import { View } from 'react-native';

const L = {
  title: 'Soft Glow',
  greet: 'Good evening',
  name: 'Priya,',
  greetTail: 'here is your home today',
  chips: ['Today', 'My flat', 'Society'],
  allGood: 'All good',
  home: 'Your home,',
  flat: 'Flat B-102',
  wing: 'Wing B · 1st floor',
  maintenance: 'Maintenance',
  paid: '9 of 12 months paid',
  dueBy: 'Due by 31 Oct',
  pay: 'Pay ₹2,400',
  notices: 'Notices',
  noticesSub: '3 new · water cut tomorrow',
  bills: 'Bills',
  billsSub: 'Receipts & history',
  findWay: 'Find way',
  ar: 'AR guide',
  members: 'Members',
  membersSub: '68 flats · 142 people',
  pinned: 'Water cut tomorrow',
  pinnedWhen: 'Fri 24 Oct · 10 AM to 2 PM',
  diwali: 'Diwali night',
  diwaliWhen: 'Sun 2 Nov | 7 PM · Society garden',
  icons: 'MOVING ICONS',
  people: 'PEOPLE',
  orb: 'ORB',
  hello: 'Good to see you',
  again: 'again',
  pin: '102',
} as const;

export function GalleryScreen() {
  const amount = useCountUp(2400);
  return (
    <Screen glow="home">
      <View style={{ gap: 14 }}>
        <Rise>
          <Text variant="h1">{L.title}</Text>
        </Rise>

        <Rise delay={60}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {L.chips.map((c, i) => (
              <Chip key={c} label={c} selected={i === 0} />
            ))}
          </View>
        </Rise>

        <Rise delay={120}>
          <Glass
            radius={32}
            style={{ overflow: 'hidden', paddingHorizontal: 22, paddingVertical: 30, gap: 18 }}
          >
            <DotTexture />
            <Text variant="greet" center>
              {L.greet} <Strong>{L.name}</Strong> {L.greetTail}
            </Text>
          </Glass>
        </Rise>

        <Rise delay={180}>
          <ArtCard art="home" height={214}>
            <View style={{ width: 160, gap: 8 }}>
              <Pill dot="#4E9A55" label={L.allGood} />
              <Text variant="h2" className="font-normal">
                {L.home} <Strong>{L.flat}</Strong>
              </Text>
              <Text variant="label" tone="soft">
                {L.wing}
              </Text>
            </View>
            <View style={{ position: 'absolute', right: -2, bottom: 0 }}>
              <Building width={180} pin={L.pin} />
            </View>
          </ArtCard>
        </Rise>

        <Rise delay={240}>
          <Glass style={{ padding: 18, alignItems: 'center' }}>
            <View
              style={{
                alignSelf: 'stretch',
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <Text variant="h3">{L.maintenance}</Text>
              <Text variant="label" tone="secondary">
                {L.paid}
              </Text>
            </View>
            <DuesRing filled={9}>
              <Text variant="label" tone="secondary">
                {L.dueBy}
              </Text>
              <Text
                style={{ fontSize: 38, lineHeight: 42, letterSpacing: -1 }}
                className="font-medium"
              >
                {`₹${amount.toLocaleString('en-IN')}`}
              </Text>
            </DuesRing>
            <Button label={L.pay} arrow className="mt-3" />
          </Glass>
        </Rise>

        <Rise delay={300}>
          <ArtCard art="rose" height={150} contentStyle={{ justifyContent: 'flex-end' }}>
            <View style={{ position: 'absolute', top: 16, right: 16 }}>
              <View
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 18,
                  backgroundColor: 'rgba(255,255,255,0.75)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Megaphone />
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Text variant="h2">{L.notices}</Text>
                <Text variant="label" tone="soft">
                  {L.noticesSub}
                </Text>
              </View>
              <ArrowCircle />
            </View>
          </ArtCard>
        </Rise>

        <Rise delay={360}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <ArtCard
              art="meadow"
              height={150}
              radius={30}
              style={{ flex: 1.6 }}
              contentStyle={{ padding: 14, justifyContent: 'flex-end' }}
            >
              <View style={{ position: 'absolute', top: 14, right: 14 }}>
                <Coin />
              </View>
              <Text variant="h3" style={{ fontSize: 18 }}>
                {L.bills}
              </Text>
              <Text variant="label" tone="soft">
                {L.billsSub}
              </Text>
            </ArtCard>
            <ArtCard
              art="dusk"
              height={150}
              radius={30}
              style={{ flex: 1 }}
              contentStyle={{ padding: 14, justifyContent: 'flex-end' }}
            >
              <View style={{ position: 'absolute', top: 16, left: 16 }}>
                <MapPin />
              </View>
              <Text variant="h3" style={{ fontSize: 18 }}>
                {L.findWay}
              </Text>
              <Text variant="label" tone="soft">
                {L.ar}
              </Text>
            </ArtCard>
          </View>
        </Rise>

        <Rise delay={420}>
          <ArtCard art="sand" height={120} contentStyle={{ justifyContent: 'flex-end' }}>
            <View style={{ position: 'absolute', top: 16, right: 16 }}>
              <AvatarStack
                bob
                more="+139"
                people={[
                  { initials: 'AJ', tone: 'pink' },
                  { initials: 'NK', tone: 'blue' },
                  { initials: 'VR', tone: 'sage' },
                ]}
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Text variant="h2">{L.members}</Text>
                <Text variant="label" tone="soft">
                  {L.membersSub}
                </Text>
              </View>
              <ArrowCircle />
            </View>
          </ArtCard>
        </Rise>

        <ArtCard art="water" fade={0}>
          <Pill label={L.pinned} dot="#D63B3B" />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Text variant="h2" style={{ fontSize: 22 }}>
                {L.pinned}
              </Text>
              <Text variant="caption" tone="soft">
                {L.pinnedWhen}
              </Text>
            </View>
            <WaterDrop />
          </View>
        </ArtCard>

        <ArtCard art="flame" height={330} radius={40} fade={0.55} fadeFrom={0.5}>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 66, alignItems: 'center' }}>
            <Diya />
          </View>
          <Sparks sparks={DIYA_SPARKS} />
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Text variant="h1" className="font-medium" style={{ fontSize: 30 }}>
              {L.diwali}
            </Text>
            <Text variant="caption" tone="soft">
              {L.diwaliWhen}
            </Text>
          </View>
        </ArtCard>

        <Glass style={{ padding: 18, gap: 14 }}>
          <SectionLabel className="px-0 pt-0">{L.icons}</SectionLabel>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <MovingIcon name="lift" motion="bob" />
            <MovingIcon name="events" motion="flick" />
            <MovingIcon name="parking" motion="drive" />
            <MovingIcon name="notices" motion="wobble" />
            <MovingIcon name="water" motion="wiggle" />
          </View>
          <SectionLabel className="px-0 pt-0">{L.people}</SectionLabel>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <GlowAvatar initials="RS" size={58} tone="pink" pulse />
            <GlowAvatar initials="MK" size={58} tone="blue" pulse delay={600} />
            <GlowAvatar initials="AP" size={58} tone="flame" pulse delay={1200} />
            <GlowAvatar initials="SD" size={58} tone="sage" pulse delay={1800} />
          </View>
          <SectionLabel className="px-0 pt-0">{L.orb}</SectionLabel>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}
          >
            <Orb size={64} ripple />
            <Orb size={92}>
              <Text variant="h2" tone="inverse" className="font-semibold">
                {'PN'}
              </Text>
            </Orb>
            <Orb size={80} tone="alert" />
          </View>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <WavingHand size={48} />
            <Text variant="greet">
              {L.hello} <Strong>{L.again}</Strong>
            </Text>
          </View>
        </Glass>
      </View>
    </Screen>
  );
}

function Pill({ label, dot }: { label: string; dot: string }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 11,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.85)',
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
      <Text variant="label" className="font-medium">
        {label}
      </Text>
    </View>
  );
}
