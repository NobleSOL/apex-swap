// functions/swap.js

// Mock KeetaClient if SDK is not available
class KeetaClient {
  constructor(opts) {
    this.opts = opts;
  }
  async swap({ from, to, amount, user }) {
    return {
      hash: "0xMOCKHASH" + Math.floor(Math.random() * 1e16).toString(16),
      from,
      to,
      amount,
      user,
    };
  }
}

exports.handler = async (event) => {
  try {
    const { from, to, amount, wallet } = JSON.parse(event.body || "{}");

    const apex = new KeetaClient({ network: "mainnet" });
    const tx = await apex.swap({ from, to, amount, user: wallet });

    return {
      statusCode: 200,
      body: JSON.stringify({ tx }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
