// frontend/src/components/AddLiquidityForm.jsx

import React, { useState } from 'react';
import { useUniswapAdapter } from '../hooks/useUniswapAdapter.jsx';
import { useToken } from '../hooks/useToken.jsx';
import { useUniswapPoolTicks } from '../hooks/useUniswapPoolTicks.jsx';
import { useAccount, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';

const WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

export const AddLiquidityForm = () => {
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  
  const [amountWETH, setAmountWETH] = useState('');
  const [amountUSDC, setAmountUSDC] = useState('');
  const [feeTier, setFeeTier] = useState(3000);
  const [isApproving, setIsApproving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [status, setStatus] = useState(''); // New status state

  const { tickLower, tickUpper, isFetching: isFetchingTicks } = useUniswapPoolTicks(
    WETH_ADDRESS,
    USDC_ADDRESS,
    feeTier
  );

  const { addLiquidity } = useUniswapAdapter([]);
  
  const { allowance: allowanceWETH, refetchAllowance: refetchAllowanceWETH, approve: approveWETH } = useToken(WETH_ADDRESS);
  const { allowance: allowanceUSDC, refetchAllowance: refetchAllowanceUSDC, approve: approveUSDC } = useToken(USDC_ADDRESS);

  const handleAddLiquidity = async () => {
    if (!tickLower || !tickUpper) {
        setStatus("Ticks are not available. Please wait for them to load.");
        return;
    }
    if (amountWETH <= 0 || amountUSDC <= 0) return;
    setStatus(''); // Clear previous status

    try {
      const parsedAmountWETH = parseUnits(amountWETH, 18);
      const parsedAmountUSDC = parseUnits(amountUSDC, 6);

      if (!allowanceWETH || parsedAmountWETH > allowanceWETH) {
        console.log("WETH allowance insufficient, requesting approval...");
        setIsApproving(true);
        setStatus('Requesting WETH approval...');
        const approveTxHash = await approveWETH(parsedAmountWETH);
        await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
        await refetchAllowanceWETH();
      }

      if (!allowanceUSDC || parsedAmountUSDC > allowanceUSDC) {
        console.log("USDC allowance insufficient, requesting approval...");
        setIsApproving(true);
        setStatus('Requesting USDC approval...');
        const approveTxHash = await approveUSDC(parsedAmountUSDC);
        await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
        await refetchAllowanceUSDC();
      }

      setIsApproving(false);
      console.log("Approvals confirmed. Requesting add liquidity...");
      setIsAdding(true);
      setStatus('Adding liquidity...');
      await addLiquidity(
        WETH_ADDRESS, 
        USDC_ADDRESS, 
        feeTier, 
        parsedAmountWETH, 
        parsedAmountUSDC, 
        BigInt(tickLower), 
        BigInt(tickUpper)
      );
      setIsAdding(false);
      setStatus('Add Liquidity transaction sent successfully!');

    } catch (error) {
      setIsApproving(false);
      setIsAdding(false);
      console.error('Add Liquidity process failed:', error);
      setStatus(`Add Liquidity failed: ${error.message}`);
    }
  };

  const getFeePercentage = (fee) => (fee / 10000).toFixed(2) + '%';
  let buttonText = isApproving ? 'Approving...' : isAdding ? 'Adding Liquidity...' : 'Add Liquidity';
  if (isFetchingTicks) {
    buttonText = "Loading ticks...";
  }

  const isButtonDisabled = !isConnected || amountWETH <= 0 || amountUSDC <= 0 || isApproving || isAdding || isFetchingTicks || !tickLower || !tickUpper;

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', marginTop: '20px' }}>
      <h2>Add Liquidity</h2>
      <div>
        <label>Amount A (WETH):</label>
        <input
          type="number"
          value={amountWETH}
          onChange={(e) => setAmountWETH(e.target.value)}
          placeholder="0.0"
        />
      </div>
      <div>
        <label>Amount B (USDC):</label>
        <input
          type="number"
          value={amountUSDC}
          onChange={(e) => setAmountUSDC(e.target.value)}
          placeholder="0.0"
        />
      </div>
      <div>
        <label htmlFor="fee-tier-liq">Fee Tier:</label>
        <select
          id="fee-tier-liq"
          value={feeTier}
          onChange={(e) => setFeeTier(Number(e.target.value))}
        >
          <option value={500}>{getFeePercentage(500)}</option>
          <option value={3000}>{getFeePercentage(3000)}</option>
          <option value={10000}>{getFeePercentage(10000)}</option>
        </select>
      </div>
      <div>
        <p>Calculated Tick Lower: {isFetchingTicks ? 'Fetching...' : tickLower !== undefined ? tickLower.toString() : 'N/A'}</p>
        <p>Calculated Tick Upper: {isFetchingTicks ? 'Fetching...' : tickUpper !== undefined ? tickUpper.toString() : 'N/A'}</p>
      </div>
      <button
        onClick={handleAddLiquidity}
        disabled={isButtonDisabled}
      >
        {buttonText}
      </button>
      {status && <p style={{ color: status.includes('failed') ? 'red' : 'green' }}>{status}</p>} {/* Display the status */}
    </div>
  );
};