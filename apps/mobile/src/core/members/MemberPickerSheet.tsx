import type { MemberCard } from '@movo/contracts';
import { Button, EmptyState, SearchBar, Sheet, Skeleton, Text } from '@movo/design-system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { formatFlat } from '../tenant/hooks';
import { loadFailed, QueryError } from '../ui/QueryError';
import { useMembers } from './api';

interface BaseProps {
  visible: boolean;
  onClose: () => void;
  societyId: string;
  title?: string;
}

/** Pick one member. Closes on pick. `none` adds a first row such as "Anyone". */
interface SingleProps extends BaseProps {
  multiple?: false;
  value?: string | undefined;
  onSelect: (member: MemberCard) => void;
  none?: { label: string; onSelect: () => void };
}

/** Pick several members in order. Tapping toggles; the number shows the order. */
interface MultipleProps extends BaseProps {
  multiple: true;
  value: string[];
  onToggle: (member: MemberCard) => void;
}

export type MemberPickerSheetProps = SingleProps | MultipleProps;

const ROW_ON = 'flex-row items-center justify-between rounded-md bg-ink px-4 py-3.5';
const ROW_OFF =
  'flex-row items-center justify-between rounded-md bg-card-nested px-4 py-3.5 active:bg-card';

/**
 * Pick any member of the society. Searches the directory on the server, so it works for
 * societies with more members than one page.
 */
export function MemberPickerSheet(props: MemberPickerSheetProps) {
  const { visible, onClose, societyId, title } = props;
  const { t } = useTranslation(['society', 'common']);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(id);
  }, [text]);
  const list = useMembers(societyId, q);
  const people = list.data?.pages.flatMap((p) => p.items) ?? [];
  const none = props.multiple ? undefined : props.none;

  const order = (id: string) => (props.multiple ? props.value.indexOf(id) : -1);
  const isOn = (id: string) => (props.multiple ? order(id) >= 0 : props.value === id);
  const press = (m: MemberCard) => {
    if (props.multiple) props.onToggle(m);
    else {
      props.onSelect(m);
      onClose();
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      {...(title ? { title } : {})}
      {...(props.multiple
        ? { footer: <Button label={t('common:actions.done')} onPress={onClose} /> }
        : {})}
    >
      <SearchBar
        placeholder={t('society:directory.search')}
        value={text}
        onChangeText={setText}
        className="mb-3"
      />
      {none && !q ? (
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: props.value === undefined }}
          onPress={() => {
            none.onSelect();
            onClose();
          }}
          className={`mb-2 ${props.value === undefined ? ROW_ON : ROW_OFF}`}
        >
          <Text variant="bodyMedium" tone={props.value === undefined ? 'inverse' : 'primary'}>
            {none.label}
          </Text>
        </Pressable>
      ) : null}
      {list.isLoading ? (
        <View className="gap-2">
          <Skeleton className="h-[52px] rounded-md" />
          <Skeleton className="h-[52px] rounded-md" />
          <Skeleton className="h-[52px] rounded-md" />
        </View>
      ) : loadFailed(list) ? (
        <QueryError query={list} />
      ) : people.length === 0 ? (
        <EmptyState icon="people" title={t('society:directory.empty')} />
      ) : (
        <View className="gap-2">
          {people.map((p) => {
            const on = isOn(p.membershipId);
            const n = order(p.membershipId);
            return (
              <Pressable
                key={p.membershipId}
                accessibilityRole={props.multiple ? 'checkbox' : 'radio'}
                accessibilityState={{ checked: on }}
                onPress={() => press(p)}
                className={on ? ROW_ON : ROW_OFF}
              >
                <View className="min-w-0 flex-1">
                  <Text variant="bodyMedium" tone={on ? 'inverse' : 'primary'} numberOfLines={1}>
                    {p.displayName}
                  </Text>
                  {p.flats[0] ? (
                    <Text variant="label" tone={on ? 'inverse' : 'secondary'} numberOfLines={1}>
                      {formatFlat(p.flats[0])}
                    </Text>
                  ) : null}
                </View>
                {props.multiple && on ? (
                  <View className="h-7 w-7 items-center justify-center rounded-full bg-white/20">
                    <Text variant="label" tone="inverse">
                      {n + 1}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
          {list.hasNextPage ? (
            <Button
              label={t('common:actions.showMore')}
              variant="ghost"
              size="sm"
              loading={list.isFetchingNextPage}
              onPress={() => void list.fetchNextPage()}
            />
          ) : null}
        </View>
      )}
    </Sheet>
  );
}
