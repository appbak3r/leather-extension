import { useQueries, useQuery } from '@tanstack/react-query';
import BigNumber from 'bignumber.js';
import PQueue from 'p-queue';

import type { AddressBalanceResponse } from '@shared/models/account.model';
import { createMoney } from '@shared/models/money.model';

import { getTicker, pullContractIdFromIdentity } from '@app/common/utils';
import { createCryptoAssetBalance } from '@app/query/common/models';
import { useStacksClient } from '@app/store/common/api-clients.hooks';
import { useCurrentNetworkState } from '@app/store/networks/networks.hooks';

import { useHiroApiRateLimiter } from '../../hiro-rate-limiter';
import { createSip10CryptoAssetInfo } from '../../sip10/sip10-tokens.utils';
import type { StacksClient } from '../../stacks-client';
import { FtAssetResponse, isFtAsset } from '../token-metadata.utils';

const staleTime = 12 * 60 * 60 * 1000;

const queryOptions = {
  keepPreviousData: true,
  cacheTime: staleTime,
  staleTime: staleTime,
  refetchOnMount: false,
  refetchInterval: false,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
  retry: 0,
} as const;

function fetchFungibleTokenMetadata(client: StacksClient, limiter: PQueue) {
  return (principal: string) => async () => {
    return limiter.add(() => client.tokensApi.getFtMetadata(principal), {
      throwOnTimeout: true,
    }) as unknown as FtAssetResponse;
  };
}

export function useGetFungibleTokenMetadataQuery(principal: string) {
  const client = useStacksClient();
  const network = useCurrentNetworkState();
  const limiter = useHiroApiRateLimiter();

  return useQuery({
    queryKey: ['get-ft-metadata', principal, network.chain.stacks.url],
    queryFn: fetchFungibleTokenMetadata(client, limiter)(principal),
    ...queryOptions,
  });
}

export function useGetFungibleTokensBalanceMetadataQuery(
  ftBalances: AddressBalanceResponse['fungible_tokens']
) {
  const client = useStacksClient();
  const network = useCurrentNetworkState();
  const limiter = useHiroApiRateLimiter();

  return useQueries({
    queries: Object.entries(ftBalances).map(([key, value]) => {
      const contractId = pullContractIdFromIdentity(key);
      return {
        enabled: !!contractId,
        queryKey: ['get-ft-metadata', contractId, network.chain.stacks.url],
        queryFn: fetchFungibleTokenMetadata(client, limiter)(contractId),
        select: (resp: FtAssetResponse) => {
          if (!(resp && isFtAsset(resp))) return;
          const symbol = resp.symbol ?? getTicker(resp.name ?? '');
          return {
            contractId,
            balance: createCryptoAssetBalance(
              createMoney(new BigNumber(value.balance), symbol, resp.decimals ?? 0)
            ),
          };
        },
        ...queryOptions,
      };
    }),
  });
}

export function useGetFungibleTokensMetadataQuery(keys: string[]) {
  const client = useStacksClient();
  const network = useCurrentNetworkState();
  const limiter = useHiroApiRateLimiter();

  return useQueries({
    queries: keys.map(key => {
      const contractId = pullContractIdFromIdentity(key);
      return {
        enabled: !!contractId,
        queryKey: ['get-ft-metadata', contractId, network.chain.stacks.url],
        queryFn: fetchFungibleTokenMetadata(client, limiter)(contractId),
        select: (resp: FtAssetResponse) => {
          if (!(resp && isFtAsset(resp))) return;
          return createSip10CryptoAssetInfo(contractId, key, resp);
        },
        ...queryOptions,
      };
    }),
  });
}