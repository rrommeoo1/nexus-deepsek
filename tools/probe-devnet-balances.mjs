import fs from "node:fs";

const store = JSON.parse(fs.readFileSync("docs/.test-wallets.local", "utf8"));
const api = "https://devnet-api.multiversx.com";
const rows = [];
for (const wallet of store.wallets) {
  const address = wallet.address;
  let egld = null;
  let tokens = null;
  try {
    const account = await (await fetch(`${api}/accounts/${address}`)).json();
    egld = account?.balance ?? null;
  } catch { egld = "error"; }
  try {
    const list = await (await fetch(`${api}/accounts/${address}/tokens?size=50`)).json();
    tokens = Array.isArray(list) ? list.map((t) => `${t.identifier}:${t.balance}`) : list;
  } catch { tokens = "error"; }
  rows.push({ index: wallet.index, handle: wallet.handle, address_tail: String(address).slice(-6), egld, tokens });
}
fs.writeFileSync(process.env.TEMP + "\\devnet-balances.json", JSON.stringify(rows, null, 2));
console.log("written");
