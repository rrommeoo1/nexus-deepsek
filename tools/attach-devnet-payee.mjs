// Gives a seeded creator a devnet address, so an appreciation from the phone has somewhere to settle:
// `payeeAddressFor` reads `users.linked_wallet` / `users.mvx_address` first, and none of the seeded
// accounts had either. The wallet is a devnet key kept in `docs/.test-wallets.local` (never printed).
// This is local demo data, not a product migration.
import fs from "node:fs";
import { Address, UserSecretKey } from "@multiversx/sdk-core";
import { DatabaseSync } from "node:sqlite";

const FILE = "C:/Users/Romeo/projects/nexus-mv/docs/.test-wallets.local";
const DB = "C:/Users/Romeo/projects/nexus-mv/apps/nexus-web/data/nexus.sqlite";
const HANDLE = process.argv[2] || "test";

const store = JSON.parse(fs.readFileSync(FILE, "utf8"));
let entry = store.wallets.find((wallet) => String(wallet.handle).toLowerCase() === HANDLE);
if (!entry) {
  const secret = UserSecretKey.generate();
  const address = new Address(secret.generatePublicKey().toAddress().toString()).toBech32();
  entry = {
    index: store.wallets.length + 1,
    handle: HANDLE,
    email: null,
    display_name: `Devnet payee (${HANDLE})`,
    network: "devnet",
    address,
    secret_key_hex: Buffer.from(secret.valueOf()).toString("hex"),
    created_at: new Date().toISOString(),
  };
  store.wallets.push(entry);
  fs.writeFileSync(FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

const db = new DatabaseSync(DB);
const user = db.prepare("SELECT id, handle, mvx_address FROM users WHERE handle = ?").get(HANDLE);
if (!user) throw new Error(`no user @${HANDLE}`);
db.prepare("UPDATE users SET mvx_address = ? WHERE id = ?").run(entry.address, user.id);
console.log(`@${HANDLE} (user ${user.id}) now settles at ${entry.address}`);
