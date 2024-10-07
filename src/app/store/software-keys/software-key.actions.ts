import { AddressVersion } from '@stacks/transactions';

import {
  type BitcoinClient,
  type StacksClient,
  StacksQueryPrefixes,
  fetchNamesForAddress,
} from '@leather.io/query';

import { decryptMnemonic, encryptMnemonic } from '@shared/crypto/mnemonic-encryption';
import { logger } from '@shared/logger';
import { defaultWalletKeyId } from '@shared/utils';
import { identifyUser } from '@shared/utils/analytics';

import { recurseAccountsForActivity } from '@app/common/account-restoration/account-restore';
import { checkForLegacyGaiaConfigWithKnownGeneratedAccountIndex } from '@app/common/account-restoration/legacy-gaia-config-lookup';
import { mnemonicToRootNode } from '@app/common/keychain/keychain';
import { queryClient } from '@app/common/persistence';
import { AppThunk } from '@app/store';
import { initalizeWalletSession } from '@app/store/session-restore';

import { getNativeSegwitMainnetAddressFromMnemonic } from '../accounts/blockchain/bitcoin/native-segwit-account.hooks';
import { getStacksAddressByIndex } from '../accounts/blockchain/stacks/stacks-keychain';
import { stxChainSlice } from '../chains/stx-chain.slice';
import { selectDefaultWalletKey } from '../in-memory-key/in-memory-key.selectors';
import { inMemoryKeySlice } from '../in-memory-key/in-memory-key.slice';
import { selectDefaultSoftwareKey } from './software-key.selectors';
import { keySlice } from './software-key.slice';

function setWalletEncryptionPassword(args: {
  password: string;
  stxClient: StacksClient;
  btcClient: BitcoinClient;
}): AppThunk {
  const { password, stxClient, btcClient } = args;

  return async (dispatch, getState) => {
    const secretKey = selectDefaultWalletKey(getState());
    if (!secretKey) throw new Error('Cannot generate wallet without first having generated a key');

    const { encryptedSecretKey, salt, encryptionKey } = await encryptMnemonic({
      secretKey,
      password,
    });

    await initalizeWalletSession(encryptionKey);

    const legacyAccountActivityLookup =
      await checkForLegacyGaiaConfigWithKnownGeneratedAccountIndex(secretKey);

    async function doesStacksAddressHaveBalance(address: string) {
      const controller = new AbortController();
      const resp = await stxClient.getAccountBalance(address, controller.signal);
      return Number(resp.stx.balance) > 0;
    }

    async function doesStacksAddressHaveBnsName(address: string) {
      const controller = new AbortController();
      const resp = await fetchNamesForAddress({
        client: stxClient,
        address,
        isTestnet: false,
        signal: controller.signal,
      });
      queryClient.setQueryData([StacksQueryPrefixes.GetBnsNamesByAddress, address], resp);
      return resp.names.length > 0;
    }

    async function doesBitcoinAddressHaveBalance(address: string) {
      const resp = await btcClient.addressApi.getUtxosByAddress(address);
      return resp.length > 0;
    }

    // Performs a recursive check for account activity. When activity is found
    // at a higher index than what is found on Gaia (long-term wallet users), we
    // update the highest known account index that the wallet generates. This
    // action is performed outside this Promise's execution, as it may be slow,
    // and the user shouldn't have to wait before being directed to homepage.
    logger.info('Initiating recursive account activity lookup');
    try {
      void recurseAccountsForActivity({
        async doesAddressHaveActivityFn(index) {
          const stxAddress = getStacksAddressByIndex(
            secretKey,
            AddressVersion.MainnetSingleSig
          )(index);
          const hasStxBalance = await doesStacksAddressHaveBalance(stxAddress);
          const hasNames = await doesStacksAddressHaveBnsName(stxAddress);

          const btcAddress = getNativeSegwitMainnetAddressFromMnemonic(secretKey)(index);
          const hasBtcBalance = await doesBitcoinAddressHaveBalance(btcAddress.address!);
          // TODO: add inscription check here also?
          return hasStxBalance || hasNames || hasBtcBalance;
        },
      }).then(recursiveActivityIndex => {
        if (recursiveActivityIndex <= legacyAccountActivityLookup) return;
        logger.info('Found account activity at higher index', { recursiveActivityIndex });
        dispatch(stxChainSlice.actions.restoreAccountIndex(recursiveActivityIndex));
      });
    } catch (e) {
      // Errors during account restore are non-critical and can fail silently
    }

    dispatch(
      keySlice.actions.createSoftwareWalletComplete({
        type: 'software',
        id: defaultWalletKeyId,
        salt,
        encryptedSecretKey,
      })
    );
    if (legacyAccountActivityLookup !== 0)
      dispatch(stxChainSlice.actions.restoreAccountIndex(legacyAccountActivityLookup));
  };
}

function unlockWalletAction(password: string): AppThunk {
  return async (dispatch, getState) => {
    const currentKey = selectDefaultSoftwareKey(getState());
    if (!currentKey) return;
    if (currentKey.type !== 'software') return;
    const { secretKey, encryptionKey } = await decryptMnemonic({ password, ...currentKey });
    await initalizeWalletSession(encryptionKey);

    const rootKey = mnemonicToRootNode(secretKey);
    if (!rootKey.publicKey) throw new Error('Could not derive root key from mnemonic');
    void identifyUser(rootKey.publicKey);

    dispatch(inMemoryKeySlice.actions.setDefaultKey(secretKey));
  };
}

export const keyActions = { ...keySlice.actions, setWalletEncryptionPassword, unlockWalletAction };
