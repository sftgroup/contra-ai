const hre = require("hardhat");

async function main() {
  const [owner] = await hre.ethers.getSigners();
  const tUSDC = "0x286D18bc7aFa5DC8Af7FdF93fAb544849E972479";

  const treasuries = {
    Base:   "0xB19eF14A97F23bBDFAaA16457BC31c78bd41B459",
    BSC:    "0x6763CCdFdD04Bf50B5b138F03474706DC80F438D",
    ETH:    "0x8c49129f455A516588246f962c5ae6EbEC88514D",
    Solana: "0xB0D65d31ccCFE7823a4AdCEd62aED0716b7220bc",
  };

  for (const [name, addr] of Object.entries(treasuries)) {
    // Redeploy Treasury v2 at the same address isn't possible, so deploy new ones
    console.log(`${name}: old=${addr} (needs redeploy for emergencyWithdraw)`);
  }

  // Deploy new treasuries
  console.log("\n=== Redeploying all 4 treasuries with emergencyWithdraw ===");
  
  for (const [name, nftAddr] of Object.entries({
    Base:   "0x8bDcA9545E354EE180bB85b24D938Ea08Cf49Be6",
    BSC:    "0x032143f87Fb5C701Bb99cD0cf6e44b8729a79F9b",
    ETH:    "0xF9c53617eda98465DF3C270e1C65b19ef1BfD036",
    Solana: "0x2f1c5d3Bc58180e497D178c0621544a7B4FD5b22",
  })) {
    const Treasury = await hre.ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(tUSDC, owner.address);
    await treasury.deployed();
    console.log(`${name}: ${treasury.address}`);

    // Update NFT to point to new treasury
    const nft = await hre.ethers.getContractAt("ContraNFT", nftAddr);
    const tx = await nft.setTreasury(treasury.address);
    await tx.wait();
    console.log(`  → NFT updated (tx ${tx.hash})`);
  }

  console.log("\n✅ All 4 treasuries upgraded with emergencyWithdraw.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
