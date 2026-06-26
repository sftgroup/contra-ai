const hre = require("hardhat");

// Sepolia testnet config
const USDC_ADDRESS = process.env.USDC_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

async function deploy(name, maxSupply) {
  const [deployer] = await hre.ethers.getSigners();
  const owner = deployer.address;

  console.log(`\n=== Deploying ${name} on ${hre.network.name} ===`);
  console.log(`Deployer: ${owner}`);
  console.log(`Max Supply: ${maxSupply}`);
  console.log(`Payment Token: ${USDC_ADDRESS}`);

  const mintPrice = 10_000n * 1_000_000n; // 10000 USDC (6 decimals)

  // 1. Deploy Treasury
  const Treasury = await hre.ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(USDC_ADDRESS, owner);
  await treasury.deployed();
  console.log(`Treasury deployed: ${treasury.address}`);

  // 2. Deploy ContraNFT
  const ContraNFT = await hre.ethers.getContractFactory("ContraNFT");
  const nft = await ContraNFT.deploy(
    "Contra AI",
    "CONTRA",
    USDC_ADDRESS,
    mintPrice,
    maxSupply,
    treasury.address,
    owner
  );
  await nft.deployed();
  console.log(`ContraNFT deployed: ${nft.address}`);

  return { treasury: treasury.address, nft: nft.address };
}

async function main() {
  const base = await deploy("Contra-Base", 200);
  const bsc  = await deploy("Contra-BSC", 100);

  console.log(`\n========== Summary ==========`);
  console.log(`[Base]  NFT: ${base.nft}  Treasury: ${base.treasury}`);
  console.log(`[BSC]   NFT: ${bsc.nft}   Treasury: ${bsc.treasury}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
