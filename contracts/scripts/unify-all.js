const hre = require("hardhat");

async function main() {
  const [owner] = await hre.ethers.getSigners();
  const tUSDC = "0x286D18bc7aFa5DC8Af7FdF93fAb544849E972479";
  const mintPrice = 10_000n * 1_000_000n; // 10000 tUSDC (6 decimals)

  const chains = {
    Base:   "0x8bDcA9545E354EE180bB85b24D938Ea08Cf49Be6",
    BSC:    "0x032143f87Fb5C701Bb99cD0cf6e44b8729a79F9b",
    ETH:    "0xF9c53617eda98465DF3C270e1C65b19ef1BfD036",
    Solana: "0x2f1c5d3Bc58180e497D178c0621544a7B4FD5b22",
  };

  for (const [name, addr] of Object.entries(chains)) {
    const nft = await hre.ethers.getContractAt("ContraNFT", addr);
    
    // Set payment token
    const currentToken = await nft.paymentToken();
    if (currentToken.toLowerCase() !== tUSDC.toLowerCase()) {
      const tx1 = await nft.setPaymentToken(tUSDC);
      await tx1.wait();
    }

    // Set mint price
    const currentPrice = await nft.mintPrice();
    if (currentPrice.toString() !== mintPrice.toString()) {
      const tx2 = await nft.setMintPrice(mintPrice);
      await tx2.wait();
    }

    const token = await nft.paymentToken();
    const price = await nft.mintPrice();
    console.log(`${name}: token=${token}  price=${hre.ethers.utils.formatUnits(price, 6)} tUSDC`);
  }

  console.log("\n✅ All 4 chains: tUSDC, 10,000 price.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
