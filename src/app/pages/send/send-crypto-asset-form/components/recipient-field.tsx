import { useEffect } from 'react';

import { SendCryptoAssetSelectors } from '@tests/selectors/send.selectors';
import { useField, useFormikContext } from 'formik';
import { Box } from 'leather-styles/jsx';

import { BitcoinSendFormValues, StacksSendFormValues } from '@shared/models/form.model';

import { Input } from '@app/ui/components/input/input';

interface RecipientFieldProps {
  isDisabled?: boolean;
  label?: string;
  name: string;
  onBlur?(): void;
  placeholder: string;
  topInputOverlay?: React.JSX.Element;
  rightLabel?: React.JSX.Element;
}
export function RecipientField({
  name,
  topInputOverlay,
  rightLabel,
  isDisabled,
  onBlur,
}: RecipientFieldProps) {
  const [field] = useField(name);
  const { setFieldValue } = useFormikContext<BitcoinSendFormValues | StacksSendFormValues>();

  useEffect(() => {
    void setFieldValue(name, field.value.trim());
  }, [name, field.value, setFieldValue]);

  return (
    <Box width="100%" position="relative" mb="space.02">
      <Input.Root shrink>
        <Box pos="absolute" right="space.03" zIndex={15} top="9px">
          {rightLabel}
        </Box>
        <Input.Label>{topInputOverlay}</Input.Label>
        <Input.Field
          data-testid={SendCryptoAssetSelectors.RecipientFieldInput}
          placeholder="Recipient"
          disabled={isDisabled}
          {...field}
          onBlur={e => {
            field.onBlur(e);
            onBlur?.();
          }}
        />
      </Input.Root>
    </Box>
  );
}
