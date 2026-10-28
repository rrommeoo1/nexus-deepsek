// Attaches a devnet signing wallet to the account the phone logged in with (xPortal), so a paid
// action from that account has a key the server may sign with — the same arrangement the five
// `devnet_test_0x` wallets use. The secret never leaves `docs/.test-wallets.local`; only the address
// is printed. Run once; re-running is a no-op.
import fs from "node:fs";
import { Address, UserSecretKey } from "@multiversx/sdk-core";

const FILE = "C:/Users/Romeo/projects/nexus-mv/docs/.test-wallets.local";
const HANDLE = process.argv[2] || "rrommeoo1112";

const store = JSON.parse(fs.readFileSync(FILE, "utf8"));
const existing = store.wallets.find((entry) => String(entry.handle).toLowerCase() === HANDLE);
if (existing) {
  console.log(`already attached: @${HANDLE} -> ${existing.address}`);
  process.exit(0);
}
const secret = UserSecretKey.generate();
const address = new Address(secret.generatePublicKey().toAddress().toString()).toBech32();
store.wallets.push({
  index: store.wallets.length + 1,
  handle: HANDLE,
  email: null,
  display_name: `Devnet demo (${HANDLE})`,
  network: "devnet",
  address,
  secret_key_hex: Buffer.from(secret.valueOf()).toString("hex"),
  created_at: new Date().toISOString(),
});
fs.writeFileSync(FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8");
console.log(`attached: @${HANDLE} -> ${address}`);
