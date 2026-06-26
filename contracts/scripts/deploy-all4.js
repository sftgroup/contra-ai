const hre = require("hardhat");

const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const mintPrice = 10_000n * 1_000_000n; // 10000 USDC

async function deploy(label, maxSupply) {
  const [deployer] = await hre.ethers.getSigners();
  const owner = deployer.address;

  console.log(`\n=== Deploying ${label} on ${hre.network.name} ===`);
  console.log(`Deployer: ${owner}`);
  console.log(`Max Supply: ${maxSupply}`);

  const Treasury = await hre.ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(USDC_ADDRESS, owner);
  await treasury.deployed();
  console.log(`Treasury: ${treasury.address}`);

  const ContraNFT = await hre.ethers.getContractFactory("ContraNFT");
  const nft = await ContraNFT.deploy(
    "Contra AI", "CONTRA",
    USDC_ADDRESS, mintPrice, maxSupply,
    treasury.address, owner,
    { gasLimit: 3000000 }
  );
  await nft.deployed();
  console.log(`NFT: ${nft.address}`);

  return { nft: nft.address, treasury: treasury.address };
}

async function main() {
  console.log("Previous:");
  console.log("[Base]  NFT: 0x8bDcA9545E354EE180bB85b24D938Ea08Cf49Be6  Treasury: 0xB19eF14A97F23bBDFAaA16457BC31c78bd41B459");
  console.log("[BSC]   NFT: 0x032143f87Fb5C701Bb99cD0cf6e44b8729a79F9b  Treasury: 0x6763CCdFdD04Bf50B5b138F03474706DC80F438D");

  const eth = await deploy("Contra-ETH", 100);
  const sol = await deploy("Contra-Solana", 100);

  console.log(`\n========== All 4 Chains ==========`);
  console.log(`[Base]   NFT: 0x8bDcA9545E354EE180bB85b24D938Ea08Cf49Be6  Treasury: 0xB19eF14A97F23bBDFAaA16457BC31c78bd41B459`);
  console.log(`[BSC]    NFT: 0x032143f87Fb5C701Bb99cD0cf6e44b8729a79F9b  Treasury: 0x6763CCdFdD04Bf50B5b138F03474706DC80F438D`);
  console.log(`[ETH]    NFT: ${eth.nft}  Treasury: ${eth.treasury}`);
  console.log(`[Solana] NFT: ${sol.nft}  Treasury: ${sol.treasury}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
