import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { parseUnits } from "ethers";
import { boot } from "./runtime.mjs";
let r;
before(async () => {
  r = await boot();
});
after(async () => {
  await r.close();
});
const u = (x) => parseUnits(String(x), 6);
let n = 0;
async function request(amount = 100, due = 0, recipient) {
  const id = "test-" + ++n;
  await r.action("request", id, "creator", {
    recipient: recipient || r.suppliers[0].id,
    amount: String(amount),
    dueAt: due,
  });
  return id;
}
test("unauthorized creator and supplier eligibility are enforced on chain", async () => {
  await assert.rejects(
    r.action("request", "bad", "auditor", {
      recipient: r.suppliers[0].id,
      amount: "1",
      dueAt: 0,
    }),
  );
  await assert.rejects(request(1, 0, r.addresses[7]));
});
test("unauthorized and duplicate approvals fail on chain", async () => {
  const id = await request();
  await assert.rejects(r.treasury.connect(r.signers[3]).approve(r.key(id)));
  await r.action("approve", id, "manager1");
  await assert.rejects(
    r.treasury
      .connect(r.signers[1])
      .approve(r.key(id))
      .then((tx) => tx.wait()),
  );
});
test("two distinct approvals above threshold, one transfer despite retry", async () => {
  const id = await request(6000);
  await r.action("approve", id, "manager1");
  await assert.rejects(r.treasury.execute(r.key(id)));
  await r.action("approve", id, "manager2");
  const before = await r.token.balanceOf(r.suppliers[0].id);
  const receipt = await (
    await r.treasury.execute(r.key(id), { gasLimit: 500000 })
  ).wait();
  console.log("MEASUREMENT execute gas:", receipt.gasUsed.toString());
  assert.equal((await r.token.balanceOf(r.suppliers[0].id)) - before, u(6000));
  await assert.rejects(r.treasury.execute(r.key(id)));
  const snapshot = await r.action("execute", id, "creator");
  assert.equal(snapshot.executed, true);
  assert.equal((await r.token.balanceOf(r.suppliers[0].id)) - before, u(6000));
});
test("due date and rejected payments prevent settlement", async () => {
  const id = await request(100, Math.floor(Date.now() / 1000) + 86400);
  await r.action("approve", id, "manager1");
  await assert.rejects(r.treasury.execute(r.key(id)));
  await r.action("reject", id, "manager2");
  await assert.rejects(
    r.treasury
      .connect(r.signers[1])
      .approve(r.key(id))
      .then((tx) => tx.wait()),
  );
});
test("exact threshold requires one approval", async () => {
  const id = await request(5000);
  await r.action("approve", id, "manager1");
  assert.equal((await r.action("execute", id, "creator")).executed, true);
});
test("daily aggregate limit is enforced and next UTC day resets it", async () => {
  const id = await request(15000);
  await r.action("approve", id, "manager1");
  await r.action("approve", id, "manager2");
  await assert.rejects(r.treasury.execute(r.key(id)));
  await r.provider.send("evm_increaseTime", [86400]);
  await r.provider.send("evm_mine", []);
  await (await r.treasury.execute(r.key(id), { gasLimit: 500000 })).wait();
  assert.equal((await r.snapshot(id)).executed, true);
});
test("duplicate request cannot overwrite recipient or amount", async () => {
  const id = await request();
  await assert.rejects(
    r.treasury.request(r.key(id), r.suppliers[1].id, u(1), 0),
  );
  await assert.rejects(
    r.action("request", id, "creator", {
      recipient: r.suppliers[0].id,
      amount: "2",
      dueAt: 0,
    }),
  );
});
test("failed token transfer rolls back execution state and daily spend", async () => {
  const { ContractFactory } = await import("ethers");
  const c = await new ContractFactory(
    r.artifact.TreasuryFlow.abi,
    r.artifact.TreasuryFlow.evm.bytecode.object,
    r.signers[0],
  ).deploy(
    await r.token.getAddress(),
    r.addresses[0],
    [r.addresses[1], r.addresses[2]],
    [r.suppliers[0].id],
    u(25000),
    u(5000),
  );
  await c.waitForDeployment();
  const key = r.key("unfunded");
  await (await c.request(key, r.suppliers[0].id, u(10), 0)).wait();
  await (await c.connect(r.signers[1]).approve(key)).wait();
  await assert.rejects(
    c.execute(key, { gasLimit: 500000 }).then((tx) => tx.wait()),
  );
  assert.equal((await c.payments(key)).executed, false);
  const block = await r.provider.getBlock("latest");
  assert.equal(await c.dailySpent(Math.floor(block.timestamp / 86400)), 0n);
});
test("overview metrics read treasury balance and spending directly from the chain", async () => {
  const { formatUnits } = await import("ethers");
  const m = await r.metrics();
  assert.equal(
    m.balance,
    formatUnits(await r.token.balanceOf(await r.treasury.getAddress()), 6),
  );
  const b = await r.provider.getBlock("latest");
  assert.equal(
    m.dailySpent,
    formatUnits(
      await r.treasury.dailySpent(Math.floor(b.timestamp / 86400)),
      6,
    ),
  );
});
