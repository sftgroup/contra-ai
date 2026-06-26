const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("=== Deploying TestUSDC ===");
  console.log("Deployer:", deployer.address);

  const TestUSDC = await hre.ethers.getContractFactory("TestUSDC");
  const token = await TestUSDC.deploy();
  await token.deployed();
  console.log("TestUSDC deployed:", token.address);

  // Mint 1,000,000 tUSDC to deployer for testing
  const amount = hre.ethers.utils.parseUnits("1000000", 6);
  const tx = await token.mint(deployer.address, amount);
  await tx.wait();
  console.log("Minted 1,000,000 tUSDC to", deployer.address);

  // Verify
  const balance = await token.balanceOf(deployer.address);
  const total = await token.totalSupply();
  console.log("Balance:", hre.ethers.utils.formatUnits(balance, 6), "tUSDC");
  console.log("Total Supply:", hre.ethers.utils.formatUnits(total, 6), "tUSDC");
  console.log("Decimals:", await token.decimals());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
