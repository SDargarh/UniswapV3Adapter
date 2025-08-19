// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/INonfungiblePositionManager.sol";
import "./interfaces/ISwapRouter.sol";
import "./interfaces/IQuoterV2.sol";
import "./libraries/TransferHelper.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract UniswapV3Adapter is Ownable, ReentrancyGuard {
    ISwapRouter public immutable swapRouter;
    IQuoterV2 public immutable quoter;
    INonfungiblePositionManager public immutable nonfungiblePositionManager;

    event LiquidityAdded(
        uint256 indexed tokenId,
        address tokenA,
        address tokenB,
        uint24 fee,
        uint256 amountA,
        uint256 amountB,
        int24 tickLower,
        int24 tickUpper
    );
    event LiquidityRemoved(
        uint256 indexed tokenId, address tokenA, address tokenB, uint24 fee, uint256 amount0, uint256 amount1
    );
    event TokensSwapped(
        address indexed tokenIn, address indexed tokenOut, uint24 fee, uint256 amountIn, uint256 amountOut
    );

    struct Deposit {
        address owner;
        uint128 liquidity;
        address token0;
        address token1;
    }

    mapping(uint256 => Deposit) public deposits;

    constructor(address owner, INonfungiblePositionManager _positionManager, ISwapRouter _swapRouter, IQuoterV2 _quoter)
        Ownable(owner)
    {
        nonfungiblePositionManager = _positionManager;
        swapRouter = _swapRouter;
        quoter = _quoter;
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint24 fee,
        uint256 amountA,
        uint256 amountB,
        int24 tickLower,
        int24 tickUpper
    ) external nonReentrant returns (uint256 tokenId) {
        // Transfer tokens from the user to this contract
        TransferHelper.safeTransferFrom(tokenA, msg.sender, address(this), amountA);
        TransferHelper.safeTransferFrom(tokenB, msg.sender, address(this), amountB);

        // Approve the position manager
        TransferHelper.safeApprove(tokenA, address(nonfungiblePositionManager), amountA);
        TransferHelper.safeApprove(tokenB, address(nonfungiblePositionManager), amountB);

        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
            token0: tokenA,
            token1: tokenB,
            fee: fee,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: amountA,
            amount1Desired: amountB,
            amount0Min:0,
            amount1Min:0,
            recipient: address(this),
            deadline: block.timestamp
        });

        (uint256 _tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) =
            nonfungiblePositionManager.mint(params);

        // Create a deposit
        _createDeposit(msg.sender, _tokenId);

        // Remove allowance and refund in both assets.
        if (amount0 < amountA) {
            uint256 refund0 = amountA - amount0;
            TransferHelper.safeTransfer(tokenA, msg.sender, refund0);
        }

        if (amount1 < amountB) {
            uint256 refund1 = amountB - amount1;
            TransferHelper.safeTransfer(tokenB, msg.sender, refund1);
        }

        TransferHelper.safeApprove(tokenA, address(nonfungiblePositionManager), 0);
        TransferHelper.safeApprove(tokenB, address(nonfungiblePositionManager), 0);

        emit LiquidityAdded(_tokenId, tokenA, tokenB, fee, amountA, amountB, tickLower, tickUpper);

        return _tokenId;
    }

    /// @notice Increases liquidity in the current range
    /// @dev Pool must be initialized already to add liquidity
    /// @param tokenId The id of the erc721 token
    /// @param amount0 The amount to add of token0
    /// @param amount1 The amount to add of token1
    function increaseLiquidityCurrentRange(uint256 tokenId, uint256 amountAdd0, uint256 amountAdd1)
        external
        nonReentrant
        returns (uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        require(msg.sender == deposits[tokenId].owner, "Not the owner");

        TransferHelper.safeTransferFrom(deposits[tokenId].token0, msg.sender, address(this), amountAdd0);
        TransferHelper.safeTransferFrom(deposits[tokenId].token1, msg.sender, address(this), amountAdd1);

        TransferHelper.safeApprove(deposits[tokenId].token0, address(nonfungiblePositionManager), amountAdd0);
        TransferHelper.safeApprove(deposits[tokenId].token1, address(nonfungiblePositionManager), amountAdd1);


        INonfungiblePositionManager.IncreaseLiquidityParams memory params = INonfungiblePositionManager
            .IncreaseLiquidityParams({
            tokenId: tokenId,
            amount0Desired: amountAdd0,
            amount1Desired: amountAdd1,
            amount0Min: 0,
            amount1Min: 0,
            deadline: block.timestamp
        });

        (liquidity, amount0, amount1) = nonfungiblePositionManager.increaseLiquidity(params);

        if (amount0 < amountAdd0) {
            uint256 refund0 = amountAdd0 - amount0;
            TransferHelper.safeTransfer(deposits[tokenId].token0, msg.sender, refund0);
        }

        if (amount1 < amountAdd1) {
            uint256 refund1 = amountAdd1 - amount1;
            TransferHelper.safeTransfer(deposits[tokenId].token1, msg.sender, refund1);
        }

        // CLEANUP APPROVALS
        TransferHelper.safeApprove(deposits[tokenId].token0, address(nonfungiblePositionManager), 0);
        TransferHelper.safeApprove(deposits[tokenId].token1, address(nonfungiblePositionManager), 0);
        
        // UPDATE STORED LIQUIDITY
        deposits[tokenId].liquidity += liquidity;
    }

    function withdrawLiquidity(uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min)
        external
        nonReentrant
        returns (uint256 amount0, uint256 amount1)
    {
        (,, address tokenA, address tokenB, uint24 fee,,,,,,,) = nonfungiblePositionManager.positions(tokenId);
        // caller must be the owner of the NFT
        require(msg.sender == deposits[tokenId].owner, "Not the owner");
        require(liquidity > 0 && deposits[tokenId].liquidity >= liquidity, "Insufficient or invalid liquidity");

        INonfungiblePositionManager.DecreaseLiquidityParams memory params = INonfungiblePositionManager
            .DecreaseLiquidityParams({
            tokenId: tokenId,
            liquidity: liquidity,
            amount0Min: amount0Min,
            amount1Min: amount1Min,
            deadline: block.timestamp
        });

        nonfungiblePositionManager.decreaseLiquidity(params);

        (amount0, amount1) = nonfungiblePositionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );

        //send liquidity back to owner
        _sendToOwner(tokenId, amount0, amount1);
        deposits[tokenId].liquidity -= liquidity;

        emit LiquidityRemoved(tokenId, tokenA, tokenB, fee, amount0, amount1);
    }

    function _createDeposit(address owner, uint256 tokenId) internal {
        (,, address token0, address token1,,,, uint128 liquidity,,,,) = nonfungiblePositionManager.positions(tokenId);

        // set the owner and data for position
        // operator is msg.sender
        deposits[tokenId] = Deposit({owner: owner, liquidity: liquidity, token0: token0, token1: token1});
    }

    /// @notice Transfers funds to owner of NFT
    /// @param tokenId The id of the erc721
    /// @param amount0 The amount of token0
    /// @param amount1 The amount of token1
    function _sendToOwner(uint256 tokenId, uint256 amount0, uint256 amount1) internal {
        // get owner of contract
        address owner = deposits[tokenId].owner;

        address token0 = deposits[tokenId].token0;
        address token1 = deposits[tokenId].token1;
        // send collected fees to owner
        TransferHelper.safeTransfer(token0, owner, amount0);
        TransferHelper.safeTransfer(token1, owner, amount1);
    }

    function swapExactInput(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint256 minOut)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        require(tokenIn != tokenOut, "Identical tokens");
        require(amountIn > 0, "Invalid amount");

        // Transfer tokens from user
        TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(this), amountIn);

        // Approve swap router
        TransferHelper.safeApprove(tokenIn, address(swapRouter), amountIn);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: msg.sender,
            deadline: block.timestamp + 300,
            amountIn: amountIn,
            amountOutMinimum: minOut,
            sqrtPriceLimitX96: 0
        });

        amountOut = swapRouter.exactInputSingle(params);

        emit TokensSwapped(tokenIn, tokenOut, fee, amountIn, amountOut);
    }

    function getQuote(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn)
        external
        returns (uint256 quotedOut)
    {
        require(tokenIn != tokenOut, "Identical tokens");
        require(amountIn > 0, "Invalid amount");

        IQuoterV2.QuoteExactInputSingleParams memory quoteParam = IQuoterV2.QuoteExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            amountIn: amountIn,
            sqrtPriceLimitX96: 0
        });

        (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate) =
            quoter.quoteExactInputSingle(quoteParam);

        quotedOut = amountOut;
    }

    // Emergency functions
    function emergencyWithdraw(address token) external onlyOwner {
        TransferHelper.safeTransfer(token, owner(), IERC20(token).balanceOf(address(this)));
    }
}
