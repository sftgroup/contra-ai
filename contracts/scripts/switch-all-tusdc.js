const hre = require("hardhat");

async function main() {
  const [owner] = await hre.ethers.getSigners();
  const TUSDC = "0x286D18bc7aFa5DC8Af7FdF93fAb544849E972479";

  const chains = {
    Base:   "0x8bDcA9545E354EE180bB85b24D938Ea08Cf49Be6",
    BSC:    "0x032143f87Fb5C701Bb99cD0cf6e44b8729a79F9b",
    ETH:    "0xF9c53617eda98465DF3C270e1C65b19ef1BfD036",
    Solana: "0x2f1c5d3Bc58180e497D178c0621544a7B4FD5b22",
  };

  for (const [name, addr] of Object.entries(chains)) {
    const nft = await hre.ethers.getContractAt("ContraNFT", addr);
    const current = await nft.paymentToken();
    if (current.toLowerCase() === TUSDC.toLowerCase()) {
      console.log(`${name}: already tUSDC`);
      continue;
    }
    const tx = await nft.setPaymentToken(TUSDC);
    await tx.wait();
    console.log(`${name}: switched to tUSDC (tx ${tx.hash})`);
  }

  console.log("\n✅ All 4 chains now use tUSDC.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
