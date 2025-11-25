import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with account: ${deployer.address}`);
  console.log(`Account balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  let token0Address = process.env.TOKEN0_ADDRESS;
  let token1Address = process.env.TOKEN1_ADDRESS;

  let token0: any;
  let token1: any;

  // Deploy test tokens if addresses not provided
  if (!token0Address || !token1Address) {
    console.log("TOKEN0_ADDRESS/TOKEN1_ADDRESS not provided. Deploying mock tokens...\n");
    
    const TestToken = await ethers.getContractFactory("TestToken");
    
    token0 = await TestToken.deploy("Mock Token A", "MTA");
    await token0.waitForDeployment();
    token0Address = await token0.getAddress();
    console.log(`✓ Token0 (Mock Token A) deployed at: ${token0Address}`);

    token1 = await TestToken.deploy("Mock Token B", "MTB");
    await token1.waitForDeployment();
    token1Address = await token1.getAddress();
    console.log(`✓ Token1 (Mock Token B) deployed at: ${token1Address}\n`);
  } else {
    console.log(`Using existing tokens:`);
    console.log(`  Token0: ${token0Address}`);
    console.log(`  Token1: ${token1Address}\n`);
  }

  // Ensure token0 < token1 for AMM constructor
  if (token0Address > token1Address) {
    [token0Address, token1Address] = [token1Address, token0Address];
    console.log("Swapped token addresses to ensure token0 < token1\n");
  }

  // Deploy AMM
  console.log("Deploying AMM contract...");
  const AMM = await ethers.getContractFactory("AMM");
  const amm = await AMM.deploy(token0Address, token1Address);
  await amm.waitForDeployment();
  const ammAddress = await amm.getAddress();
  console.log(`✓ AMM deployed at: ${ammAddress}`);

  // Get LP token address
  const lpTokenAddress = await amm.lpToken();
  console.log(`✓ LP Token deployed at: ${lpTokenAddress}\n`);

  // Print summary
  console.log("=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(`Token0:     ${token0Address}`);
  console.log(`Token1:     ${token1Address}`);
  console.log(`AMM:        ${ammAddress}`);
  console.log(`LP Token:   ${lpTokenAddress}`);
  console.log("=".repeat(60));
  console.log("\nTo interact with the AMM:");
  console.log(`  npx hardhat console`);
  console.log(`  const amm = await ethers.getContractAt("AMM", "${ammAddress}");`);
  console.log(`  await amm.getReserves();`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

