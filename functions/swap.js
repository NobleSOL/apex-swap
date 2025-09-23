const { KeetaClient } = require("@keeta/sdk");

exports.handler = async (event) => {
  const { from, to, amount, wallet } = JSON.parse(event.body);
  const apex = new KeetaClient({ network: "mainnet" });

  try {
    const tx = await apex.swap({ from, to, amount, user: wallet });
    return { statusCode: 200, body: JSON.stringify({ tx }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
