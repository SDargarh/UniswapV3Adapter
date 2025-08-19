// frontend/src/hooks/useToken.jsx

import { useReadContract, useWriteContract, useAccount } from 'wagmi';
import { UNISWAP_ADAPTER_ADDRESS } from '../constants/contracts';

// Simplified ERC-20 ABI with only the functions we need
const ERC20_ABI = [
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }, { "name": "_spender", "type": "address" }],
    "name": "allowance",
    "outputs": [{ "name": "", "type": "uint256" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [{ "name": "_spender", "type": "address" }, { "name": "_value", "type": "uint256" }],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
];

export const useToken = (tokenAddress, spenderAddress = UNISWAP_ADAPTER_ADDRESS) => {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  // Get the current allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    abi: ERC20_ABI,
    address: tokenAddress,
    functionName: 'allowance',
    args: [address, spenderAddress],
    query: {
      enabled: !!address && !!tokenAddress,
    },
  });

  // Function to approve the spender
  const approve = async (amount) => {
    try {
      const txHash = await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spenderAddress, amount],
      });
      console.log('Approval transaction sent:', txHash);
      return txHash;
    } catch (error) {
      console.error('Approval failed:', error);
      throw error;
    }
  };

  return { allowance, refetchAllowance, approve };
};