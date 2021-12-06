import { useUnsignedTransaction } from '@store/transactions/transaction.hooks';

export function useUnsignedTransactionFee() {
  const unsignedTx = useUnsignedTransaction();

  const value = unsignedTx?.fee;
  const isSponsored = unsignedTx?.isSponsored;

  return { value, isSponsored };
}