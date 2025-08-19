// frontend/src/hooks/useUniswapAdapter.jsx
import { useReadContract, useWriteContract } from 'wagmi';
import { UNISWAP_ADAPTER_ADDRESS } from '../constants/contracts';
import { UNISWAP_ADAPTER_ABI } from '../constants/abis';

export const useUniswapAdapter = (getQuoteArgs) => {
  const { data: quote, isFetching: isFetchingQuote, error: quoteError } = useReadContract({
    abi: UNISWAP_ADAPTER_ABI,
    address: UNISWAP_ADAPTER_ADDRESS,
    functionName: 'getQuote',
    args: getQuoteArgs,
    query: {
      enabled: getQuoteArgs.length === 4,
    },
  });

  const { writeContractAsync } = useWriteContract();

  const swapTokens = async (tokenIn, tokenOut, fee, amountIn, minOut) => {
    try {
      const txHash = await writeContractAsync({
        address: UNISWAP_ADAPTER_ADDRESS,
        abi: UNISWAP_ADAPTER_ABI,
        functionName: 'swapExactInput',
        args: [tokenIn, tokenOut, fee, amountIn, minOut],
      });
      console.log('Swap transaction sent:', txHash);
      return txHash;
    } catch (error) {
      console.error('Swap failed:', error);
      throw error;
    }
  };

  // NEW: Implement the addLiquidity function
  const addLiquidity = async (tokenA, tokenB, fee, amountA, amountB, tickLower, tickUpper) => {
    try {
      const txHash = await writeContractAsync({
        address: UNISWAP_ADAPTER_ADDRESS,
        abi: UNISWAP_ADAPTER_ABI,
        functionName: 'addLiquidity',
        args: [tokenA, tokenB, fee, amountA, amountB, tickLower, tickUpper],
      });
      console.log('Add liquidity transaction sent:', txHash);
      return txHash;
    } catch (error) {
      console.error('Add liquidity failed:', error);
      throw error;
    }
  };

  return {
    quote,
    isFetchingQuote,
    quoteError,
    swapTokens,
    addLiquidity,
  };
};