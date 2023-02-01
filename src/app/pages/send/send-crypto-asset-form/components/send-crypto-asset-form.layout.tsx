import { Flex } from '@stacks/ui';

import { CENTERED_FULL_PAGE_MAX_WIDTH } from '@app/components/global-styles/full-page-styles';

interface SendCryptoAssetFormLayoutProps {
  children: JSX.Element;
}
export function SendCryptoAssetFormLayout({ children }: SendCryptoAssetFormLayoutProps) {
  return (
    <Flex
      alignItems="center"
      flexDirection="column"
      justifyContent="center"
      mt={['unset', '48px']}
      maxWidth={['100%', CENTERED_FULL_PAGE_MAX_WIDTH]}
      minWidth={['100%', CENTERED_FULL_PAGE_MAX_WIDTH]}
      px={['loose', 'unset']}
    >
      {children}
    </Flex>
  );
}