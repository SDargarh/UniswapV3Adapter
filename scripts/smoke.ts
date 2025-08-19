import { ethers } from "hardhat";
import addresses from "./addresses";
import { expect } from "chai";

const ADAPTER_ADDRESS = addresses.ADAPTER_ADDRESS;

async function main() {
    const [deployer] = await ethers.getSigners();

    const adapter = await ethers.getContractAt("UniswapV3Adapter", ADAPTER_ADDRESS);
    const usdc = await ethers.getContractAt("IERC20", addresses.USDC);
    const weth = await ethers.getContractAt("IERC20", addresses.WETH);

    console.log("Running smoke tests...");

    const initialUSDC = await usdc.balanceOf(deployer.address);
    const initialWETH = await weth.balanceOf(deployer.address);
    console.log(`Initial: ${ethers.formatUnits(initialUSDC, 6)} USDC, ${ethers.formatEther(initialWETH)} WETH`);

    const tokenId = await testLiquidity(adapter, usdc, weth, deployer.address);
    await testSwap(adapter, usdc, weth, deployer.address);

    console.log("All tests passed");
}

// Swap test
async function testSwap(adapter: any, usdc: any, weth: any, userAddress: string) {
    console.log("\nTesting swap...");

    const swapAmount = ethers.parseUnits("100", 6);
    await usdc.approve(ADAPTER_ADDRESS, swapAmount);

    const wethBefore = await weth.balanceOf(userAddress);

    const tx = await adapter.swapExactInput(
        addresses.USDC,
        addresses.WETH,
        3000,
        swapAmount,
        0
    );
    const receipt = await tx.wait();

    const wethAfter = await weth.balanceOf(userAddress);
    const received = wethAfter - wethBefore;

    console.log(`Swapped ${ethers.formatUnits(swapAmount, 6)} USDC for ${ethers.formatEther(received)} WETH`);
    expect(received).to.be.gt(0);

    // Verify event
    const swapEvent = receipt.logs.find((log: any) => {
        try {
            const parsed = adapter.interface.parseLog({ topics: log.topics, data: log.data });
            return parsed?.name === "TokensSwapped";
        } catch {
            return false;
        }
    });
    
    if (swapEvent) {
        const parsed = adapter.interface.parseLog({ topics: swapEvent.topics, data: swapEvent.data });
        console.log(`   Event: ${ethers.formatEther(parsed.args.amountOut)} WETH received`);
    }
}

// Liquidity test
async function testLiquidity(adapter: any, usdc: any, weth: any, userAddress: string): Promise<number> {
    console.log("\nTesting liquidity...");

    // Fetch pool info
    const poolFactory = await ethers.getContractAt(
        ["function getPool(address,address,uint24) view returns (address)"],
        addresses.POOL_FACTORY
    );

    const poolAddress = await poolFactory.getPool(addresses.USDC, addresses.WETH, 3000);
    const pool = await ethers.getContractAt(
        ["function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)", "function tickSpacing() view returns (int24)"],
        poolAddress
    );

    const [_, tick] = await pool.slot0();
    const tickSpacing = await pool.tickSpacing();

    const currentTick = Number(tick);
    const spacing = Number(tickSpacing);
    const nearestTick = Math.floor(currentTick / spacing) * spacing;

    // Define liquidity range
    const widthInSpacings = 20;
    const tickLower = nearestTick - spacing * widthInSpacings;
    const tickUpper = nearestTick + spacing * widthInSpacings;

    console.log(`Using tick range: ${tickLower} to ${tickUpper}`);

    // Provide liquidity
    const usdcAmount = ethers.parseUnits("1000", 6);
    const wethAmount = ethers.parseEther("1");

    const token0 = addresses.USDC < addresses.WETH ? addresses.USDC : addresses.WETH;
    const token1 = addresses.USDC > addresses.WETH ? addresses.USDC : addresses.WETH;
    const amount0 = token0 === addresses.USDC ? usdcAmount : wethAmount;
    const amount1 = token1 === addresses.USDC ? usdcAmount : wethAmount;

    await usdc.approve(ADAPTER_ADDRESS, usdcAmount);
    await weth.approve(ADAPTER_ADDRESS, wethAmount);

    const addTx = await adapter.addLiquidity(
        token0,
        token1,
        3000,
        amount0,
        amount1,
        tickLower,
        tickUpper
    );
    const receipt = await addTx.wait();

    // Get tokenId
    let tokenId = 0;
    for (const log of receipt.logs) {
        try {
            const parsed = adapter.interface.parseLog({ topics: log.topics, data: log.data });
            if (parsed?.name === "LiquidityAdded") {
                tokenId = parsed.args.tokenId;
                break;
            }
        } catch {}
    }

    expect(tokenId).to.be.gt(0);
    console.log(`Added liquidity, NFT ID: ${tokenId}`);

    // Withdraw part of liquidity
    const deposit = await adapter.deposits(tokenId);
    const liquidityToRemove = deposit.liquidity / 2n;

    const balancesBefore = {
        usdc: await usdc.balanceOf(userAddress),
        weth: await weth.balanceOf(userAddress)
    };

    const withdrawTx = await adapter.withdrawLiquidity(tokenId, liquidityToRemove, 0, 0);
    const receiptWithdraw = await withdrawTx.wait();

    // Verify event
    const liquidityRemovedEvent = receiptWithdraw.logs.find((log: any) => {
        try {
            const parsed = adapter.interface.parseLog({ topics: log.topics, data: log.data });
            return parsed?.name === "LiquidityRemoved";
        } catch {
            return false;
        }
    });

    if (liquidityRemovedEvent) {
        const parsed = adapter.interface.parseLog({ topics: liquidityRemovedEvent.topics, data: liquidityRemovedEvent.data });
        console.log(`   Event: ${ethers.formatEther(parsed.args.amount0)} WETH, ${ethers.formatUnits(parsed.args.amount1, 6)} USDC withdrawn`);
    }
    
    const balancesAfter = {
        usdc: await usdc.balanceOf(userAddress),
        weth: await weth.balanceOf(userAddress)
    };

    const withdrawn = {
        usdc: balancesAfter.usdc - balancesBefore.usdc,
        weth: balancesAfter.weth - balancesBefore.weth
    };

    console.log(`Withdrawn: ${ethers.formatUnits(withdrawn.usdc, 6)} USDC, ${ethers.formatEther(withdrawn.weth)} WETH`);
    expect(withdrawn.usdc + withdrawn.weth).to.be.gt(0);

    return Number(tokenId);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Test failed:", error);
        process.exit(1);
    });
