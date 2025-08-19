import { ethers } from "hardhat";
import addresses from "./addresses";

async function deploy() {
  const [deployer] = await ethers.getSigners();

  const UniswapV3Adapter = await ethers.getContractFactory("UniswapV3Adapter");
  
  const uniswapV3Adapter = await UniswapV3Adapter.deploy(
    deployer.address,
    addresses.NonfungiblePositionManager,
    addresses.SwapRouter02,
    addresses.QuoterV2
  );
  
  await uniswapV3Adapter.waitForDeployment();

  const adapterAddress = await uniswapV3Adapter.getAddress();
  console.log("UniswapV3Adapter deployed at:", adapterAddress);
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
