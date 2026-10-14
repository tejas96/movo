import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import type { FieldValues, Resolver, UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

/**
 * Checks a form with the route's own body schema: the form values are turned into the request
 * body with `toBody` and parsed by `body`. Errors land on the body's field names. The submit
 * handler gets the form values as they are, so the screen builds the payload with the same
 * `toBody` and sends exactly that.
 */
export function bodyResolver<TForm extends FieldValues>(
  body: z.ZodType,
  toBody: (values: TForm) => unknown,
): Resolver<TForm> {
  return zodResolver(z.custom<TForm>().transform(toBody).pipe(body), undefined, {
    raw: true,
  }) as Resolver<TForm>;
}

/**
 * Fills the form from the loaded item once, the first time it arrives. Later refetches leave
 * what the user typed alone.
 */
export function usePrefill<TForm extends FieldValues, TItem>(
  form: UseFormReturn<TForm>,
  item: TItem | undefined,
  toForm: (item: TItem) => TForm,
): void {
  const filled = useRef(false);
  const toFormRef = useRef(toForm);
  toFormRef.current = toForm;
  useEffect(() => {
    if (filled.current || item === undefined) return;
    filled.current = true;
    form.reset(toFormRef.current(item));
  }, [form, item]);
}

/** The message to show under the form: the server's, else `invalid` when any field failed. */
export function formMessage<TForm extends FieldValues>(
  form: UseFormReturn<TForm>,
  invalid: string,
): string | null {
  const { errors } = form.formState;
  if (errors.root?.server?.message) return errors.root.server.message;
  return Object.keys(errors).some((k) => k !== 'root') ? invalid : null;
}
