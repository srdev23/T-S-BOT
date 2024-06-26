import assert from 'assert';

import {
  BigNumberish,
  jsonInfo2PoolKeys,
  Liquidity,
  LiquidityPoolKeys,
  Percent,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk';
import { Keypair } from '@solana/web3.js';

import {
  BotConfig,
  connection,
  DEFAULT_TOKEN,
  makeTxVersion,
  wallet
} from './config';
import { formatAmmKeysById } from './formatAmmKeysById';
import {
  buildAndSendTx,
  getWalletTokenAccount,
} from './util';

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>
type TestTxInputInfo = {
  outputToken: Token
  targetPool: string
  inputTokenAmount: TokenAmount
  slippage: Percent
  walletTokenAccounts: WalletTokenAccounts
  wallet: Keypair
}

async function swapOnlyAmm(input: TestTxInputInfo) {
  // -------- pre-action: get pool info --------
  const targetPoolInfo = await formatAmmKeysById(input.targetPool)
  assert(targetPoolInfo, 'cannot find the target pool')
  const poolKeys = jsonInfo2PoolKeys(targetPoolInfo) as LiquidityPoolKeys

  // -------- step 1: coumpute amount out --------
  const { amountOut, minAmountOut } = Liquidity.computeAmountOut({
    poolKeys: poolKeys,
    poolInfo: await Liquidity.fetchInfo({ connection, poolKeys }),
    amountIn: input.inputTokenAmount,
    currencyOut: input.outputToken,
    slippage: input.slippage,
  })

  // -------- step 2: create instructions by SDK function --------
  const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
    connection,
    poolKeys,
    userKeys: {
      tokenAccounts: input.walletTokenAccounts,
      owner: input.wallet.publicKey,
    },
    amountIn: input.inputTokenAmount,
    amountOut: minAmountOut,
    fixedSide: 'in',
    config: {
      bypassAssociatedCheck: false,
    },
    computeBudgetConfig: {
      microLamports: BotConfig.maxLamports,
    },
    makeTxVersion,
  })

  console.log('amountOut:', amountOut.toFixed(), '  minAmountOut: ', minAmountOut.toFixed())

  return { txids: await buildAndSendTx(innerTransactions) }
}

export async function swap(inputToken: Token, outputToken: Token, targetPool: string, amount: number) {
  // const inputToken = DEFAULT_TOKEN.WSOL // USDC
  // const outputToken = DEFAULT_TOKEN.USDT // RAY
  // const targetPool = '7XawhbbxtsRcQA8KTkHT9f9nc6d69UwqCDh6U5EEbEmX' // USDC-RAY pool
  const inputTokenAmount = new TokenAmount(inputToken, amount)
  const slippage = new Percent(100, 100)
  const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)
  const res = await swapOnlyAmm({
    outputToken,
    targetPool,
    inputTokenAmount,
    slippage,
    walletTokenAccounts,
    wallet,
  });

  return res.txids[0];

  // swapOnlyAmm({
  //     outputToken,
  //     targetPool,
  //     inputTokenAmount,
  //     slippage,
  //     walletTokenAccounts,
  //     wallet: wallet,
  //   })
  //   .then(({ txids }) => {

  //     /** continue with txids */
  //     console.log(`* Swap is done: https://solscan.io/tx/${txids}`)
  //   })
}



// const amount: BigNumberish = new BN(15601927538 * (10 ** 8))
// swap(DEFAULT_TOKEN.TEST, DEFAULT_TOKEN.WSOL, '21LEKaKsu7r2VK6GvjzcAnQ3r4D4JYs1osY1XHopEipM', 131394881717)