const { expect } = require("chai");
const { ethers } = require("hardhat");

const toWei = (value) => ethers.parseEther(value.toString());

const sqrt = (value) => {
  const bn = BigInt(value);
  if (bn === 0n) {
    return 0n;
  }
  let z = (bn + 1n) / 2n;
  let y = bn;
  while (z < y) {
    y = z;
    z = (bn / z + z) / 2n;
  }
  return y;
};

describe("AMM", () => {
  let deployer, lp1, lp2, trader;
  let token0, token1, amm, lpToken;

  beforeEach(async () => {
    [deployer, lp1, lp2, trader] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("TestToken");
    token0 = await Token.deploy("Token0", "TK0");
    token1 = await Token.deploy("Token1", "TK1");
    await token0.waitForDeployment();
    await token1.waitForDeployment();

    const mintAmount = toWei(10000);
    for (const user of [lp1, lp2, trader]) {
      await token0.mint(user.address, mintAmount);
      await token1.mint(user.address, mintAmount);
    }

    const AMM = await ethers.getContractFactory("AMM");
    amm = await AMM.deploy(token0.target, token1.target);
    await amm.waitForDeployment();

    lpToken = await ethers.getContractAt("LPToken", await amm.lpToken());

    const max = ethers.MaxUint256;
    for (const user of [lp1, lp2, trader]) {
      await token0.connect(user).approve(amm.target, max);
      await token1.connect(user).approve(amm.target, max);
    }
  });

  describe("Liquidity", () => {
    it("mints LP tokens on initial liquidity", async () => {
      const amount0 = toWei(1000);
      const amount1 = toWei(1000);

      await expect(amm.connect(lp1).addLiquidity(amount0, amount1))
        .to.emit(amm, "LiquidityAdded")
        .withArgs(lp1.address, amount0, amount1, sqrt(amount0 * amount1));

      const reserves = await amm.getReserves();
      expect(reserves[0]).to.equal(amount0);
      expect(reserves[1]).to.equal(amount1);

      const balance = await lpToken.balanceOf(lp1.address);
      expect(balance).to.equal(sqrt(amount0 * amount1));
    });

    it("adds liquidity proportionally for subsequent providers", async () => {
      await amm.connect(lp1).addLiquidity(toWei(1000), toWei(1000));
      await amm.connect(lp2).addLiquidity(toWei(500), toWei(500));

      const supply = await lpToken.totalSupply();
      expect(supply).to.equal(sqrt(toWei(1000) * toWei(1000)) + sqrt(toWei(500) * toWei(500)));

      const reserves = await amm.getReserves();
      expect(reserves[0]).to.equal(toWei(1500));
      expect(reserves[1]).to.equal(toWei(1500));
    });

    it("removes liquidity proportionally", async () => {
      const initial0 = toWei(1000);
      const initial1 = toWei(1000);
      await amm.connect(lp1).addLiquidity(initial0, initial1);

      const lpBalance = await lpToken.balanceOf(lp1.address);
      const half = lpBalance / 2n;

      await expect(amm.connect(lp1).removeLiquidity(half))
        .to.emit(amm, "LiquidityRemoved")
        .withArgs(lp1.address, initial0 / 2n, initial1 / 2n, half);

      const reserves = await amm.getReserves();
      expect(reserves[0]).to.equal(initial0 / 2n);
      expect(reserves[1]).to.equal(initial1 / 2n);
    });
  });

  describe("Swaps", () => {
    beforeEach(async () => {
      await amm.connect(lp1).addLiquidity(toWei(1000), toWei(1000));
    });

    it("swaps token0 for token1 respecting invariant", async () => {
      const reserveBefore = await amm.getReserves();
      const amountIn = toWei(10);
      const expectedOut =
        (amountIn * reserveBefore[1]) / (reserveBefore[0] + amountIn);

      await expect(amm.connect(trader).swap(token0.target, amountIn))
        .to.emit(amm, "Swap")
        .withArgs(trader.address, token0.target, amountIn, token1.target, expectedOut);

      const reserveAfter = await amm.getReserves();
      expect(reserveAfter[0]).to.equal(reserveBefore[0] + amountIn);
      expect(reserveAfter[1]).to.equal(reserveBefore[1] - expectedOut);

      const productBefore = reserveBefore[0] * reserveBefore[1];
      const productAfter = reserveAfter[0] * reserveAfter[1];
      expect(productAfter).to.be.at.least(productBefore);
    });

    it("reacts to price shifts after large swap", async () => {
      const amountIn = toWei(300);
      await amm.connect(trader).swap(token0.target, amountIn);
      const reserveAfter = await amm.getReserves();
      // Expect price of token0 in terms of token1 to go down (more token0 reserve)
      expect(reserveAfter[0]).to.be.gt(reserveAfter[1]);
    });
  });

  describe("Invariant", () => {
    it("never decreases over swap sequence", async () => {
      await amm.connect(lp1).addLiquidity(toWei(2000), toWei(1000));
      const trades = [toWei(10), toWei(20), toWei(5)];
      const initialReserves = await amm.getReserves();
      let lastProduct = initialReserves[0] * initialReserves[1];

      for (const amount of trades) {
        await amm.connect(trader).swap(token0.target, amount);
        const reserves = await amm.getReserves();
        const product = reserves[0] * reserves[1];
        expect(product).to.be.at.least(lastProduct);
        lastProduct = product;
      }
    });
  });

  describe("Negative cases", () => {
    beforeEach(async () => {
      await amm.connect(lp1).addLiquidity(toWei(500), toWei(500));
    });

    it("reverts on zero liquidity removal", async () => {
      await expect(amm.connect(lp1).removeLiquidity(0)).to.be.revertedWith("Zero liquidity");
    });

    it("reverts on invalid token swap", async () => {
      await expect(
        amm.connect(trader).swap(ethers.ZeroAddress, toWei(1))
      ).to.be.revertedWith("Unsupported token");
    });

    it("reverts when swap would drain reserves", async () => {
      const lpBalance = await lpToken.balanceOf(lp1.address);
      await amm.connect(lp1).removeLiquidity(lpBalance);
      await expect(
        amm.connect(trader).swap(token0.target, toWei(1))
      ).to.be.revertedWith("Insufficient liquidity");
    });
  });
});

