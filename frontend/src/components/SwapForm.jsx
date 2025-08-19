// frontend/src/components/SwapForm.jsx

import React, { useState } from 'react';
import { useUniswapAdapter } from '../hooks/useUniswapAdapter.jsx';
import { useToken } from '../hooks/useToken.jsx';
import { useAccount, usePublicClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';

const WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

export const SwapForm = () => {
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [amountIn, setAmountIn] = useState('');
  const [feeTier, setFeeTier] = useState(3000);
  const [isApproving, setIsApproving] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [status, setStatus] = useState(''); // New status state

  const { allowance, refetchAllowance, approve } = useToken(WETH_ADDRESS);

  const quoteArgs = amountIn && parseFloat(amountIn) > 0 ?
    [WETH_ADDRESS, USDC_ADDRESS, feeTier, parseUnits(amountIn, 18)]
    : [];

  const { quote, isFetchingQuote, quoteError, swapTokens } = useUniswapAdapter(quoteArgs);

  const SLIPPAGE_TOLERANCE = 500;
  const minOut = quote ? quote - (quote * BigInt(SLIPPAGE_TOLERANCE)) / 100000n : 0n;

  const handleSwap = async () => {
    if (amountIn <= 0) return;
    setStatus(''); // Clear previous status
    
    try {
      const parsedAmountIn = parseUnits(amountIn, 18);
      
      if (!allowance || parsedAmountIn > allowance) {
        console.log("Allowance insufficient, requesting approval...");
        setIsApproving(true);
        setStatus('Requesting token approval...');
        const approveTxHash = await approve(parsedAmountIn);
        
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
          console.log("Approval confirmed. Proceeding with swap.");
          setIsApproving(false);
          await refetchAllowance();
        } else {
          throw new Error("Public client not available.");
        }
      }

      console.log("Allowance sufficient, requesting swap...");
      setIsSwapping(true);
      setStatus('Swapping tokens...');
      await swapTokens(WETH_ADDRESS, USDC_ADDRESS, feeTier, parsedAmountIn, minOut);
      setIsSwapping(false);
      setStatus('Swap transaction sent successfully!');

    } catch (error) {
      setIsApproving(false);
      setIsSwapping(false);
      console.error('Swap process failed:', error);
      setStatus(`Swap failed: ${error.message}`);
    }
  };

  const formattedQuote = quote ? formatUnits(quote, 6) : null;
  const getFeePercentage = (fee) => (fee / 10000).toFixed(2) + '%';
  if (quoteError) {
    console.error("Error fetching quote:", quoteError);
  }

  const buttonText = isApproving ? 'Approving...' : isSwapping ? 'Swapping...' : 'Swap';
  const isButtonDisabled = !isConnected || isFetchingQuote || formattedQuote === null || amountIn <= 0 || isApproving || isSwapping;

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Swap Tokens</h2>
      <div>
        <label>Amount In (WETH):</label>
        <input
          type="number"
          value={amountIn}
          onChange={(e) => setAmountIn(e.target.value)}
          placeholder="0.0"
        />
      </div>
      <div>
        <label>Token Out (USDC):</label>
        <input type="text" readOnly placeholder="USDC" />
      </div>
      <div>
        <label htmlFor="fee-tier">Fee Tier:</label>
        <select
          id="fee-tier"
          value={feeTier}
          onChange={(e) => setFeeTier(Number(e.target.value))}
        >
          <option value={500}>{getFeePercentage(500)}</option>
          <option value={3000}>{getFeePercentage(3000)}</option>
          <option value={10000}>{getFeePercentage(10000)}</option>
        </select>
      </div>
      <div>
        <p>
          Estimated Output:
          {isFetchingQuote ? (
            'Fetching...'
          ) : (
            formattedQuote !== null ? `${formattedQuote} USDC` : '0'
          )}
        </p>
      </div>
      <button
        onClick={handleSwap}
        disabled={isButtonDisabled}
      >
        {buttonText}
      </button>
      {status && <p style={{ color: status.includes('failed') ? 'red' : 'green' }}>{status}</p>} {/* Display the status */}
    </div>
  );
};