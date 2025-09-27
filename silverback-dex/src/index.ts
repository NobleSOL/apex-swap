import express from 'express';
import { z } from 'zod';
import { brandSilverback } from './branding.js';
import { createPool } from './pools.js';
import { balanceOf, dexAccount, getBaseTokenId, send } from './keeta.js';
import { getAmountOut, getLpToMint } from './amm.js';

const app = express();
app.use(express.json());

app.post('/bootstrap/brand', async (_req, res, next) => {
  try {
    const staple = await brandSilverback();
    res.json({ dex: dexAccount.publicKeyString, staple });
  } catch (error) {
    next(error);
  }
});

app.post('/pool/create', async (req, res, next) => {
  try {
    const bodySchema = z.object({ quoteTokenId: z.string().min(1) });
    const { quoteTokenId } = bodySchema.parse(req.body);
    const out = await createPool(quoteTokenId);
    res.json(out);
  } catch (error) {
    next(error);
  }
});

app.get('/quote/swap', async (req, res, next) => {
  try {
    const querySchema = z.object({
      tokenIn: z.string().min(1),
      tokenOut: z.string().min(1),
      amountIn: z.string().min(1),
    });
    const { tokenIn, tokenOut, amountIn } = querySchema.parse(req.query);
    const reserveIn = await balanceOf(tokenIn);
    const reserveOut = await balanceOf(tokenOut);
    const amountOut = getAmountOut(BigInt(amountIn), reserveIn, reserveOut);
    res.json({
      amountOut: amountOut.toString(),
      reserveIn: reserveIn.toString(),
      reserveOut: reserveOut.toString(),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/quote/addLiquidity', async (req, res, next) => {
  try {
    const querySchema = z.object({
      tokenX: z.string().min(1),
      addKTA: z.string().min(1),
      addX: z.string().min(1),
    });
    const { tokenX, addKTA, addX } = querySchema.parse(req.query);
    const base = await getBaseTokenId();
    const reserveBase = await balanceOf(base);
    const reserveQuote = await balanceOf(tokenX);
    const totalLp = 0n;
    const lp = getLpToMint(BigInt(addKTA), BigInt(addX), reserveBase, reserveQuote, totalLp);
    res.json({
      lp: lp.toString(),
      reserveBase: reserveBase.toString(),
      reserveQuote: reserveQuote.toString(),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/settle/swap', async (req, res, next) => {
  try {
    const bodySchema = z.object({
      user: z.string().min(1),
      tokenOut: z.string().min(1),
      amountOut: z.string().min(1),
      external: z.string().optional(),
    });
    const { user, tokenOut, amountOut, external } = bodySchema.parse(req.body);
    const staple = await send(user, BigInt(amountOut), tokenOut, external);
    res.json({ staple });
  } catch (error) {
    next(error);
  }
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log('Silverback DEX service on', port);
  console.log('DEX account:', dexAccount.publicKeyString);
});
