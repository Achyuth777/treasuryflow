import fs from "node:fs";
import solc from "solc";
import ganache from "ganache";
import {
  BrowserProvider,
  ContractFactory,
  Contract,
  id,
  parseUnits,
  formatUnits,
} from "ethers";
export const users = ["creator", "manager1", "manager2", "auditor"];
export async function boot({ persistent = false, port } = {}) {
  const input = {
    language: "Solidity",
    sources: {
      "TreasuryFlow.sol": {
        content: fs.readFileSync(
          new URL("../contracts/TreasuryFlow.sol", import.meta.url),
          "utf8",
        ),
      },
    },
    settings: {
      evmVersion: "shanghai",
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((e) => e.severity === "error");
  if (errors.length)
    throw Error(errors.map((e) => e.formattedMessage).join("\n"));
  const data = process.env.CHAIN_DATA || "/tmp/treasuryflow-chain";
  if (persistent) fs.mkdirSync(data, { recursive: true });
  const chain = ganache.server({
    logging: { quiet: true },
    chain: { chainId: 31337, hardfork: "shanghai" },
    wallet: {
      mnemonic: "test test test test test test test test test test test junk",
      totalAccounts: 8,
    },
    ...(persistent ? { database: { dbPath: data + "/db" } } : {}),
  });
  if (port) await chain.listen(port, "0.0.0.0");
  const provider = new BrowserProvider(chain.provider, undefined, {
    cacheTimeout: -1,
  });
  provider.pollingInterval = 50;
  const signers = await Promise.all(
    Array.from({ length: 8 }, (_, i) => provider.getSigner(i)),
  );
  const addresses = await Promise.all(signers.map((s) => s.getAddress()));
  const artifact = output.contracts["TreasuryFlow.sol"];
  let deployment;
  if (persistent && fs.existsSync(data + "/deployment.json"))
    deployment = JSON.parse(fs.readFileSync(data + "/deployment.json", "utf8"));
  else {
    const token = await new ContractFactory(
      artifact.MockUSD.abi,
      artifact.MockUSD.evm.bytecode.object,
      signers[0],
    ).deploy(parseUnits("1000000", 6));
    await token.waitForDeployment();
    const treasury = await new ContractFactory(
      artifact.TreasuryFlow.abi,
      artifact.TreasuryFlow.evm.bytecode.object,
      signers[0],
    ).deploy(
      await token.getAddress(),
      addresses[0],
      [addresses[1], addresses[2]],
      [addresses[4], addresses[5]],
      parseUnits("25000", 6),
      parseUnits("5000", 6),
    );
    await treasury.waitForDeployment();
    await (
      await token.transfer(await treasury.getAddress(), parseUnits("500000", 6))
    ).wait();
    deployment = {
      token: await token.getAddress(),
      treasury: await treasury.getAddress(),
    };
    if (persistent)
      fs.writeFileSync(
        data + "/deployment.json",
        JSON.stringify(deployment, null, 2),
      );
  }
  const treasury = new Contract(
    deployment.treasury,
    artifact.TreasuryFlow.abi,
    signers[0],
  );
  const token = new Contract(
    deployment.token,
    artifact.MockUSD.abi,
    signers[0],
  );
  const suppliers = [
    { id: addresses[4], name: "Northstar Cloud", category: "Infrastructure" },
    {
      id: addresses[5],
      name: "Atlas Design Co.",
      category: "Professional services",
    },
  ];
  const actorFor = (a) =>
    users[addresses.findIndex((x) => x.toLowerCase() === a.toLowerCase())] || a;
  const key = (uuid) => id(uuid);
  async function snapshot(uuid) {
    const p = await treasury.payments(key(uuid));
    const logs = await treasury.queryFilter(
      treasury.filters.Executed(key(uuid)),
      0,
      "latest",
    );
    const log = logs.at(-1);
    const block = await provider.getBlockNumber();
    return {
      key: key(uuid),
      exists: p.creator !== "0x0000000000000000000000000000000000000000",
      recipient: p.recipient,
      amount: formatUnits(p.amount, 6),
      dueAt: Number(p.dueAt),
      approvals: await Promise.all(
        [1, 2]
          .filter(() => true)
          .map(async (i) =>
            (await treasury.approvedBy(key(uuid), addresses[i]))
              ? users[i]
              : null,
          ),
      ).then((x) => x.filter(Boolean)),
      rejected: p.rejected,
      executed: p.executed,
      txHash: log?.transactionHash || null,
      confirmations: log ? block - log.blockNumber + 1 : 0,
      blockNumber: log?.blockNumber || null,
    };
  }
  async function action(kind, uuid, actor, payload = {}) {
    const index = users.indexOf(actor);
    if (index < 0) throw Error("Unknown actor");
    const c = treasury.connect(signers[index]);
    const k = key(uuid);
    const p = await snapshot(uuid);
    if (kind === "request") {
      if (p.exists) {
        if (
          p.recipient.toLowerCase() !== payload.recipient.toLowerCase() ||
          parseUnits(p.amount, 6) !== parseUnits(payload.amount, 6) ||
          p.dueAt !== payload.dueAt
        )
          throw Error("Payment payload conflict");
        return p;
      }
      await (
        await c.request(
          k,
          payload.recipient,
          parseUnits(payload.amount, 6),
          payload.dueAt,
        )
      ).wait();
    } else if (kind === "approve") {
      if (!p.approvals.includes(actor)) await (await c.approve(k)).wait();
    } else if (kind === "reject") {
      if (!p.rejected) await (await c.reject(k)).wait();
    } else if (kind === "execute") {
      if (!p.executed) await (await c.execute(k)).wait();
    } else throw Error("Unknown action");
    return snapshot(uuid);
  }
  async function events() {
    const logs = await treasury.queryFilter("*", 0, "latest");
    return logs.map((log) => ({
      key: `${log.transactionHash}:${log.index}`,
      paymentKey: log.args[0],
      actor: actorFor(log.args[1]),
      action: log.fragment.name.toUpperCase(),
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      ...(log.fragment.name === "Executed"
        ? { recipient: log.args[2], amount: formatUnits(log.args[3], 6) }
        : {}),
    }));
  }
  return {
    artifact,
    chain,
    provider,
    signers,
    addresses,
    treasury,
    token,
    suppliers,
    key,
    snapshot,
    action,
    events,
    metrics: async () => {
      const block = await provider.getBlock("latest");
      return {
        balance: formatUnits(await token.balanceOf(deployment.treasury), 6),
        dailySpent: formatUnits(
          await treasury.dailySpent(Math.floor(block.timestamp / 86400)),
          6,
        ),
      };
    },
    config: {
      ...deployment,
      suppliers,
      dailyLimit: "25000",
      threshold: "5000",
      chainId: 31337,
    },
    close: () => chain.close(),
  };
}
