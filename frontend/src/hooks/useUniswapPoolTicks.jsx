// frontend/src/hooks/useUniswapPoolTicks.jsx

import { useReadContract } from 'wagmi';
import { FACTORY_ADDRESS } from '../constants/contracts';
import { UNISWAP_V3_POOL_ABI, FACTORY_ABI } from '../constants/abis';
import { getAddress } from 'viem';

// This hook gets the current ticks from the pool
export const useUniswapPoolTicks = (tokenA, tokenB, feeTier) => {
  // Ensure we have a valid address and feeTier before querying
  const queryEnabled = !!tokenA && !!tokenB && feeTier !== undefined;

  // Step 1: Get the pool address from the Uniswap V3 Factory
  const { data: poolAddress, isFetching: isFetchingPoolAddress } = useReadContract({
    abi: FACTORY_ABI,
    address: FACTORY_ADDRESS,
    functionName: 'getPool',
    args: [getAddress(tokenA), getAddress(tokenB), feeTier],
    query: {
      enabled: queryEnabled,
    },
  });

  // Step 2: Get the current tick and tick spacing from the pool
  const { data: slot0, isFetching: isFetchingSlot0 } = useReadContract({
    abi: UNISWAP_V3_POOL_ABI,
    address: poolAddress,
    functionName: 'slot0',
    query: {
      enabled: !!poolAddress,
    },
  });

  const { data: tickSpacing, isFetching: isFetchingTickSpacing } = useReadContract({
    abi: UNISWAP_V3_POOL_ABI,
    address: poolAddress,
    functionName: 'tickSpacing',
    query: {
      enabled: !!poolAddress,
    },
  });

  // Step 3: Perform the tick calculations if data is available
  let tickLower, tickUpper;
  let nearestTick;

  if (slot0 && tickSpacing) {
    const currentTick = Number(slot0[1]);
    const spacing = Number(tickSpacing);

    // Calculate nearest usable tick and create a range around it
    nearestTick = Math.floor(currentTick / spacing) * spacing;
    const widthInSpacings = 20; // Same as your script: 20 on each side
    tickLower = nearestTick - spacing * widthInSpacings;
    tickUpper = nearestTick + spacing * widthInSpacings;
  }

  const isFetching = isFetchingPoolAddress || isFetchingSlot0 || isFetchingTickSpacing;

  return {
    tickLower,
    tickUpper,
    nearestTick,
    isFetching,
    poolAddress,
  };
};