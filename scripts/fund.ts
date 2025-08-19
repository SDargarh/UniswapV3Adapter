import { ethers, network } from "hardhat";
import addresses from "./addresses";

// Tries to set a token balance directly in storage (commonly works with testnet forks)
async function setTokenBalance(tokenAddress: string, userAddress: string, amount: bigint) {
  const slots = [0, 1, 2, 3, 9, 51]; // common balance mapping slots

  for (const slot of slots) {
    const storageSlot = ethers.keccak256(
      ethers.solidityPacked(["uint256", "uint256"], [userAddress, slot])
    );

    await network.provider.send("hardhat_setStorageAt", [
      tokenAddress,
      storageSlot,
      ethers.toBeHex(amount, 32),
    ]);

    const token = await ethers.getContractAt("IERC20", tokenAddress);
    const balance = await token.balanceOf(userAddress);

    if (balance > 0n) {
      console.log(`Balance set using storage slot ${slot}`);
      return true;
    }
  }

  console.log("Could not set balance via storage manipulation");
  return false;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Preparing test wallet: ${deployer.address}`);

  // Token addresses on Arbitrum
  const USDC = addresses.USDC;
  const WETH = addresses.WETH;

  // Set USDC balance (using storage slot hack)
  console.log("Setting USDC balance...");
  await setTokenBalance(USDC, deployer.address, ethers.parseUnits("10000", 6));

  // Mint WETH by depositing ETH
  console.log("Depositing ETH to get WETH...");
  const wethAbi = ["function deposit() external payable"];
  const weth = new ethers.Contract(WETH, wethAbi, deployer);
  await weth.deposit({ value: ethers.parseEther("10") });

  // Verify balances
  const usdc = await ethers.getContractAt("IERC20", USDC);
  const wethContract = await ethers.getContractAt("IERC20", WETH);

  const usdcBalance = await usdc.balanceOf(deployer.address);
  const wethBalance = await wethContract.balanceOf(deployer.address);

  console.log("\nFunding Results:");
  console.log(`USDC Balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
  console.log(`WETH Balance: ${ethers.formatEther(wethBalance)} WETH`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
