const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying contracts with ${deployer.address}`);

  let token0Address = process.env.TOKEN0_ADDRESS;
  let token1Address = process.env.TOKEN1_ADDRESS;

  if (!token0Address || !token1Address) {
    console.log("TOKEN0_ADDRESS/TOKEN1_ADDRESS not provided. Deploying mock tokens...");
    const TestToken = await hre.ethers.getContractFactory("TestToken");
    const token0 = await TestToken.deploy("Mock Token A", "MTA");
    const token1 = await TestToken.deploy("Mock Token B", "MTB");
    await token0.waitForDeployment();
    await token1.waitForDeployment();
    token0Address = token0.target;
    token1Address = token1.target;
    console.log(`Mock Token0 deployed at ${token0Address}`);
    console.log(`Mock Token1 deployed at ${token1Address}`);
  }

  const AMM = await hre.ethers.getContractFactory("AMM");
  const amm = await AMM.deploy(token0Address, token1Address);
  await amm.waitForDeployment();

  console.log(`AMM deployed at ${amm.target}`);
  console.log(`LP Token deployed at ${await amm.lpToken()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

