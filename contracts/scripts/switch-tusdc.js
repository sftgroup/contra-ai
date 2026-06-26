const hre = require("hardhat");

async function main() {
  const [owner] = await hre.ethers.getSigners();
  console.log("Owner:", owner.address);

  const TUSDC = "0x286D18bc7aFa5DC8Af7FdF93fAb544849E972479";

  // Switch BSC NFT to tUSDC
  const bscNFT = await hre.ethers.getContractAt("ContraNFT", "0x032143f87Fb5C701Bb99cD0cf6e44b8729a79F9b");
  console.log("BSC NFT current paymentToken:", await bscNFT.paymentToken());
  
  const tx = await bscNFT.setPaymentToken(TUSDC);
  await tx.wait();
  console.log("BSC NFT paymentToken → tUSDC:", await bscNFT.paymentToken());
  console.log("Tx:", tx.hash);

  // Verify other chains still use real USDC
  const baseNFT = await hre.ethers.getContractAt("ContraNFT", "0x8bDcA9545E354EE180bB85b24D938Ea08Cf49Be6");
  console.log("\nBase NFT paymentToken:", await baseNFT.paymentToken());
  const ethNFT = await hre.ethers.getContractAt("ContraNFT", "0xF9c53617eda98465DF3C270e1C65b19ef1BfD036");
  console.log("ETH NFT paymentToken:", await ethNFT.paymentToken());
  const solNFT = await hre.ethers.getContractAt("ContraNFT", "0x2f1c5d3Bc58180e497D178c0621544a7B4FD5b22");
  console.log("Solana NFT paymentToken:", await solNFT.paymentToken());

  console.log("\n✅ BSC chain now uses tUSDC for mint.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
