import { memo } from 'react';

import { useSwitchAccount } from '@app/common/hooks/account/use-switch-account';
import { useLoading } from '@app/common/hooks/use-loading';
import { AccountBalanceCaption } from '@app/components/account/account-balance-caption';
import { AccountName } from './account-name';
import { useAddressBalances } from '@app/query/stacks/balance/balance.hooks';
import { AccountListItemLayout } from '../../../components/account/account-list-item-layout';
import { AccountAvatarItem } from './account-avatar';
import { AccountWithAddress } from '@app/store/accounts/account.models';
import { usePressable } from '@app/components/item-hover';
import { useAccountDisplayName } from '@app/common/hooks/account/use-account-names';
import { useStxMarketData } from '@app/query/common/market-data/market-data.hooks';

interface AccountBalanceLabelProps {
  address: string;
}
const AccountBalanceLabel = memo(({ address }: AccountBalanceLabelProps) => {
  const { data: balances } = useAddressBalances(address);
  const stxMarketData = useStxMarketData();

  if (!balances) return null;

  return (
    <AccountBalanceCaption availableBalance={balances.availableStx} marketData={stxMarketData} />
  );
});

interface SwitchAccountListItemProps {
  account: AccountWithAddress;
  handleClose(): void;
}
export const SwitchAccountListItem = memo(
  ({ account, handleClose }: SwitchAccountListItemProps) => {
    const { isLoading, setIsLoading, setIsIdle } = useLoading('SWITCH_ACCOUNTS' + account.address);
    const { handleSwitchAccount, getIsActive } = useSwitchAccount(handleClose);
    const [component, bind] = usePressable(true);
    const name = useAccountDisplayName(account);

    const handleClick = async () => {
      setIsLoading();
      setTimeout(async () => {
        await handleSwitchAccount(account.index);
        setIsIdle();
      }, 80);
    };

    return (
      <AccountListItemLayout
        account={account}
        isLoading={isLoading}
        isActive={getIsActive(account.index)}
        avatar={
          <AccountAvatarItem index={account.index} publicKey={account.stxPublicKey} name={name} />
        }
        onSelectAccount={handleClick}
        accountName={<AccountName account={account} />}
        balanceLabel={<AccountBalanceLabel address={account.address} />}
        mt="loose"
        {...bind}
      >
        {component}
      </AccountListItemLayout>
    );
  }
);
