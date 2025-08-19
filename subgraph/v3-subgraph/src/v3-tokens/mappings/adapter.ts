import { BigInt, log, Bytes } from '@graphprotocol/graph-ts'

import {
    LiquidityAdded,
    LiquidityRemoved,
    TokensSwapped
} from '../../../generated/Adapter/UniswapV3Adapter'
import {
    LiquidityAddedEvent,
    LiquidityRemovedEvent,
    TokensSwappedEvent,
    Pair
} from '../../../generated/schema'

function getCanonicalPairId(tokenA: Bytes, tokenB: Bytes): string {
    if (tokenA.toHexString() < tokenB.toHexString()) {
        return tokenA.toHexString() + '-' + tokenB.toHexString()
    } else {
        return tokenB.toHexString() + '-' + tokenA.toHexString()
    }
}

export function handleLiquidityAdded(event: LiquidityAdded): void {
    log.warning('🟢 LiquidityAdded handler called - TokenId: {}', [event.params.tokenId.toString()])

    let id = event.transaction.hash.toHex() + '-' + event.logIndex.toString()
    let entity = new LiquidityAddedEvent(id)

    entity.tokenId = event.params.tokenId
    entity.tokenA = event.params.tokenA
    entity.tokenB = event.params.tokenB
    entity.fee = event.params.fee
    entity.amountA = event.params.amountA
    entity.amountB = event.params.amountB
    entity.tickLower = event.params.tickLower
    entity.tickUpper = event.params.tickUpper
    entity.blockNumber = event.block.number
    entity.timestamp = event.block.timestamp
    entity.transactionHash = event.transaction.hash

    entity.save()

    let pairId = getCanonicalPairId(event.params.tokenA, event.params.tokenB)
    let pair = Pair.load(pairId)

    if (pair == null) {
        pair = new Pair(pairId)
        
        if (event.params.tokenA.toHexString() < event.params.tokenB.toHexString()) {
            pair.tokenA = event.params.tokenA
            pair.tokenB = event.params.tokenB
        } else {
            pair.tokenA = event.params.tokenB
            pair.tokenB = event.params.tokenA
        }

        pair.totalLiquidityAdded = BigInt.fromI32(0)
        pair.totalLiquidityRemoved = BigInt.fromI32(0)
        pair.totalSwappedUSDC = BigInt.fromI32(0)
    }

    // Per the schema, sum the amounts into a single BigInt.
    pair.totalLiquidityAdded = pair.totalLiquidityAdded.plus(event.params.amountA.plus(event.params.amountB))

    pair.save()
}

export function handleLiquidityRemoved(event: LiquidityRemoved): void {
    log.warning('🔴 LiquidityRemoved handler called - TokenId: {}', [event.params.tokenId.toString()])

    let id = event.transaction.hash.toHex() + '-' + event.logIndex.toString()
    let entity = new LiquidityRemovedEvent(id)

    entity.tokenId = event.params.tokenId
    entity.tokenA = event.params.tokenA
    entity.tokenB = event.params.tokenB
    entity.fee = event.params.fee
    entity.amount0 = event.params.amount0
    entity.amount1 = event.params.amount1
    entity.blockNumber = event.block.number
    entity.timestamp = event.block.timestamp
    entity.transactionHash = event.transaction.hash

    entity.save()

    let pairId = getCanonicalPairId(event.params.tokenA, event.params.tokenB)
    let pair = Pair.load(pairId)

    if (pair != null) {
        // Per the schema, subtract the amounts from a single BigInt.
        pair.totalLiquidityRemoved = pair.totalLiquidityRemoved.plus(event.params.amount0.plus(event.params.amount1))
        pair.save()
    }
}

export function handleTokensSwapped(event: TokensSwapped): void {
    log.warning('🔄 TokensSwapped handler called - TokenIn: {}, TokenOut: {}', [
        event.params.tokenIn.toHexString(),
        event.params.tokenOut.toHexString()
    ])

    let id = event.transaction.hash.toHex() + '-' + event.logIndex.toString()
    let entity = new TokensSwappedEvent(id)

    entity.tokenIn = event.params.tokenIn
    entity.tokenOut = event.params.tokenOut
    entity.fee = event.params.fee
    entity.amountIn = event.params.amountIn
    entity.amountOut = event.params.amountOut
    entity.blockNumber = event.block.number
    entity.timestamp = event.block.timestamp
    entity.transactionHash = event.transaction.hash

    entity.save()

    let pairId = getCanonicalPairId(event.params.tokenIn, event.params.tokenOut)
    let pair = Pair.load(pairId)

    if (pair == null) {
        pair = new Pair(pairId)
        if (event.params.tokenIn.toHexString() < event.params.tokenOut.toHexString()) {
            pair.tokenA = event.params.tokenIn
            pair.tokenB = event.params.tokenOut
        } else {
            pair.tokenA = event.params.tokenOut
            pair.tokenB = event.params.tokenIn
        }
        pair.totalLiquidityAdded = BigInt.fromI32(0)
        pair.totalLiquidityRemoved = BigInt.fromI32(0)
        pair.totalSwappedUSDC = BigInt.fromI32(0)
    }

    let USDC_ADDRESS = "0xaf88d065e77c8cc2239327c5edb3a432268e5831"
    if (event.params.tokenOut.toHex().toLowerCase() == USDC_ADDRESS.toLowerCase()) {
        pair.totalSwappedUSDC = pair.totalSwappedUSDC.plus(event.params.amountOut)
    }

    pair.save()
}
