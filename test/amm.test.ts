import { expect } from "chai";
import { ethers } from "hardhat";
import { AMM, LPToken, TestToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const toWei = (value: string | number) => ethers.parseEther(value.toString());

const sqrt = (value: bigint): bigint => {
  if (value === 0n) {
    return 0n;
  }
  let z = (value + 1n) / 2n;
  let y = value;
  while (z < y) {
    y = z;
    z = (value / z + z) / 2n;
  }
  return y;
};

describe("AMM", () => {
  let deployer: HardhatEthersSigner;
  let lp1: HardhatEthersSigner;
  let lp2: HardhatEthersSigner;
  let trader: HardhatEthersSigner;
  let token0: TestToken;
  let token1: TestToken;
  let amm: AMM;
  let lpToken: LPToken;

  beforeEach(async () => {
    [deployer, lp1, lp2, trader] = await ethers.getSigners();

    const TestTokenFactory = await ethers.getContractFactory("TestToken");
    token0 = await TestTokenFactory.deploy("Token0", "TK0");
    token1 = await TestTokenFactory.deploy("Token1", "TK1");
    await token0.waitForDeployment();
    await token1.waitForDeployment();

    // Ensure token0 < token1 for AMM constructor
    const token0Address = await token0.getAddress();
    const token1Address = await token1.getAddress();
    
    // Sort tokens to ensure token0 < token1
    let sortedToken0, sortedToken1;
    if (token0Address < token1Address) {
      sortedToken0 = token0;
      sortedToken1 = token1;
    } else {
      sortedToken0 = token1;
      sortedToken1 = token0;
    }
    
    // Verify addresses are different and in correct order
    const sortedToken0Address = await sortedToken0.getAddress();
    const sortedToken1Address = await sortedToken1.getAddress();
    if (sortedToken0Address >= sortedToken1Address) {
      throw new Error("Token addresses must be in ascending order");
    }

    const mintAmount = toWei(10000);
    for (const user of [lp1, lp2, trader]) {
      await sortedToken0.mint(user.address, mintAmount);
      await sortedToken1.mint(user.address, mintAmount);
    }

    const AMMFactory = await ethers.getContractFactory("AMM");
    const sortedToken0Addr = await sortedToken0.getAddress();
    const sortedToken1Addr = await sortedToken1.getAddress();
    
    // Double-check order before deployment
    if (sortedToken0Addr >= sortedToken1Addr) {
      throw new Error(`Token order invalid: ${sortedToken0Addr} >= ${sortedToken1Addr}`);
    }
    
    amm = await AMMFactory.deploy(sortedToken0Addr, sortedToken1Addr);
    await amm.waitForDeployment();

    const lpTokenAddress = await amm.lpToken();
    lpToken = await ethers.getContractAt("LPToken", lpTokenAddress);

    const max = ethers.MaxUint256;
    for (const user of [lp1, lp2, trader]) {
      await sortedToken0.connect(user).approve(await amm.getAddress(), max);
      await sortedToken1.connect(user).approve(await amm.getAddress(), max);
    }

    // Update references to match AMM's token0/token1
    const ammToken0 = await amm.token0();
    token0 = await ethers.getContractAt("TestToken", ammToken0);
    token1 = await ethers.getContractAt(
      "TestToken",
      await amm.token1()
    );
  });

  describe("Deployment", () => {
    it("should deploy with correct token addresses", async () => {
      const ammToken0 = await amm.token0();
      const ammToken1 = await amm.token1();
      expect(ammToken0).to.not.equal(ammToken1);
      expect(ammToken0).to.not.equal(ethers.ZeroAddress);
      expect(ammToken1).to.not.equal(ethers.ZeroAddress);
      expect(ammToken0 < ammToken1).to.be.true;
    });

    it("should initialize with zero reserves", async () => {
      const [reserve0, reserve1] = await amm.getReserves();
      expect(reserve0).to.equal(0);
      expect(reserve1).to.equal(0);
    });

    it("should deploy LP token with correct name and symbol", async () => {
      expect(await lpToken.name()).to.equal("Minimal AMM LP");
      expect(await lpToken.symbol()).to.equal("MALP");
      expect(await lpToken.totalSupply()).to.equal(0);
    });

    it("should revert if tokens are identical", async () => {
      const AMMFactory = await ethers.getContractFactory("AMM");
      const tokenAddress = await token0.getAddress();
      await expect(
        AMMFactory.deploy(tokenAddress, tokenAddress)
      ).to.be.revertedWith("AMM: identical tokens");
    });

    it("should revert if token address is zero", async () => {
      const AMMFactory = await ethers.getContractFactory("AMM");
      await expect(
        AMMFactory.deploy(ethers.ZeroAddress, await token1.getAddress())
      ).to.be.revertedWith("AMM: zero address");
    });
  });

  describe("Add Liquidity", () => {
    it("should mint LP tokens on initial liquidity", async () => {
      const amount0 = toWei(1000);
      const amount1 = toWei(1000);

      const expectedLiquidity = sqrt(amount0 * amount1);

      await expect(amm.connect(lp1).addLiquidity(amount0, amount1))
        .to.emit(amm, "LiquidityAdded")
        .withArgs(lp1.address, amount0, amount1, expectedLiquidity);

      const reserves = await amm.getReserves();
      expect(reserves[0]).to.equal(amount0);
      expect(reserves[1]).to.equal(amount1);

      const balance = await lpToken.balanceOf(lp1.address);
      expect(balance).to.equal(expectedLiquidity);
    });

    it("should add liquidity proportionally for subsequent providers", async () => {
      const initial0 = toWei(1000);
      const initial1 = toWei(1000);
      await amm.connect(lp1).addLiquidity(initial0, initial1);

      const additional0 = toWei(500);
      const additional1 = toWei(500);
      await amm.connect(lp2).addLiquidity(additional0, additional1);

      const reserves = await amm.getReserves();
      expect(reserves[0]).to.equal(initial0 + additional0);
      expect(reserves[1]).to.equal(initial1 + additional1);

      const totalSupply = await lpToken.totalSupply();
      const lp1Balance = await lpToken.balanceOf(lp1.address);
      const lp2Balance = await lpToken.balanceOf(lp2.address);
      expect(lp1Balance + lp2Balance).to.equal(totalSupply);
    });

    it("should calculate liquidity correctly for non-equal amounts", async () => {
      const amount0 = toWei(2000);
      const amount1 = toWei(1000);
      await amm.connect(lp1).addLiquidity(amount0, amount1);

      const reserves = await amm.getReserves();
      expect(reserves[0]).to.equal(amount0);
      expect(reserves[1]).to.equal(amount1);

      const liquidity = await lpToken.balanceOf(lp1.address);
      expect(liquidity).to.equal(sqrt(amount0 * amount1));
    });

    it("should revert when adding zero amounts", async () => {
      await expect(
        amm.connect(lp1).addLiquidity(0, toWei(1000))
      ).to.be.revertedWith("AMM: invalid amounts");

      await expect(
        amm.connect(lp1).addLiquidity(toWei(1000), 0)
      ).to.be.revertedWith("AMM: invalid amounts");

      await expect(
        amm.connect(lp1).addLiquidity(0, 0)
      ).to.be.revertedWith("AMM: invalid amounts");
    });

    it("should revert when insufficient balance", async () => {
      const amount0 = toWei(100000);
      const amount1 = toWei(1000);
      await expect(
        amm.connect(lp1).addLiquidity(amount0, amount1)
      ).to.be.reverted;
    });
  });

  describe("Remove Liquidity", () => {
    beforeEach(async () => {
      await amm.connect(lp1).addLiquidity(toWei(1000), toWei(1000));
    });

    it("should remove liquidity proportionally", async () => {
      const lpBalance = await lpToken.balanceOf(lp1.address);
      const half = lpBalance / 2n;

      const reservesBefore = await amm.getReserves();
      const expectedAmount0 = (half * reservesBefore[0]) / lpBalance;
      const expectedAmount1 = (half * reservesBefore[1]) / lpBalance;

      await expect(amm.connect(lp1).removeLiquidity(half))
        .to.emit(amm, "LiquidityRemoved")
        .withArgs(lp1.address, expectedAmount0, expectedAmount1, half);

      const reservesAfter = await amm.getReserves();
      expect(reservesAfter[0]).to.equal(reservesBefore[0] - expectedAmount0);
      expect(reservesAfter[1]).to.equal(reservesBefore[1] - expectedAmount1);

      const newBalance = await lpToken.balanceOf(lp1.address);
      expect(newBalance).to.equal(lpBalance - half);
    });

    it("should remove all liquidity", async () => {
      const lpBalance = await lpToken.balanceOf(lp1.address);
      await amm.connect(lp1).removeLiquidity(lpBalance);

      const reserves = await amm.getReserves();
      expect(reserves[0]).to.equal(0);
      expect(reserves[1]).to.equal(0);

      const balance = await lpToken.balanceOf(lp1.address);
      expect(balance).to.equal(0);
    });

    it("should revert when removing zero liquidity", async () => {
      await expect(amm.connect(lp1).removeLiquidity(0)).to.be.revertedWith(
        "AMM: zero liquidity"
      );
    });

    it("should revert when removing more than balance", async () => {
      const lpBalance = await lpToken.balanceOf(lp1.address);
      await expect(
        amm.connect(lp2).removeLiquidity(lpBalance)
      ).to.be.revertedWith("LPToken: burn amount exceeds balance");
    });
  });

  describe("Swap", () => {
    beforeEach(async () => {
      await amm.connect(lp1).addLiquidity(toWei(1000), toWei(1000));
    });

    it("should swap token0 for token1 with correct fee", async () => {
      const reservesBefore = await amm.getReserves();
      const amountIn = toWei(10);

      // Calculate expected output with 0.3% fee
      // amountOut = (amountIn * 997 / 1000 * reserveOut) / (reserveIn + amountIn * 997 / 1000)
      const amountInWithFee = (amountIn * 997n) / 1000n;
      const expectedOut =
        (amountInWithFee * reservesBefore[1]) /
        (reservesBefore[0] + amountInWithFee);

      const token0BalanceBefore = await token1.balanceOf(trader.address);

      await expect(amm.connect(trader).swap(await token0.getAddress(), amountIn))
        .to.emit(amm, "SwapExecuted")
        .withArgs(
          trader.address,
          await token0.getAddress(),
          amountIn,
          await token1.getAddress(),
          expectedOut
        );

      const reservesAfter = await amm.getReserves();
      expect(reservesAfter[0]).to.equal(reservesBefore[0] + amountIn);
      expect(reservesAfter[1]).to.equal(reservesBefore[1] - expectedOut);

      const token1BalanceAfter = await token1.balanceOf(trader.address);
      expect(token1BalanceAfter - token0BalanceBefore).to.equal(expectedOut);
    });

    it("should swap token1 for token0 with correct fee", async () => {
      const reservesBefore = await amm.getReserves();
      const amountIn = toWei(10);

      const amountInWithFee = (amountIn * 997n) / 1000n;
      const expectedOut =
        (amountInWithFee * reservesBefore[0]) /
        (reservesBefore[1] + amountInWithFee);

      await expect(amm.connect(trader).swap(await token1.getAddress(), amountIn))
        .to.emit(amm, "SwapExecuted")
        .withArgs(
          trader.address,
          await token1.getAddress(),
          amountIn,
          await token0.getAddress(),
          expectedOut
        );

      const reservesAfter = await amm.getReserves();
      expect(reservesAfter[1]).to.equal(reservesBefore[1] + amountIn);
      expect(reservesAfter[0]).to.equal(reservesBefore[0] - expectedOut);
    });

    it("should maintain constant-product invariant after swap", async () => {
      const reservesBefore = await amm.getReserves();
      const kBefore = reservesBefore[0] * reservesBefore[1];

      const amountIn = toWei(100);
      await amm.connect(trader).swap(await token0.getAddress(), amountIn);

      const reservesAfter = await amm.getReserves();
      const kAfter = reservesAfter[0] * reservesAfter[1];

      // k should increase due to fee
      expect(kAfter).to.be.at.least(kBefore);
    });

    it("should revert when swapping with zero input", async () => {
      await expect(
        amm.connect(trader).swap(await token0.getAddress(), 0)
      ).to.be.revertedWith("AMM: invalid amount");
    });

    it("should revert when swapping unsupported token", async () => {
      const TestTokenFactory = await ethers.getContractFactory("TestToken");
      const otherToken = await TestTokenFactory.deploy("Other", "OTH");
      await otherToken.waitForDeployment();

      await expect(
        amm.connect(trader).swap(await otherToken.getAddress(), toWei(10))
      ).to.be.revertedWith("AMM: unsupported token");
    });

    it("should revert when insufficient liquidity", async () => {
      const lpBalance = await lpToken.balanceOf(lp1.address);
      await amm.connect(lp1).removeLiquidity(lpBalance);

      await expect(
        amm.connect(trader).swap(await token0.getAddress(), toWei(1))
      ).to.be.revertedWith("AMM: insufficient liquidity");
    });

    it("should handle multiple swaps correctly", async () => {
      const trades = [toWei(10), toWei(20), toWei(5)];
      let lastK = 0n;

      for (const amount of trades) {
        const reservesBefore = await amm.getReserves();
        const kBefore = reservesBefore[0] * reservesBefore[1];

        await amm.connect(trader).swap(await token0.getAddress(), amount);

        const reservesAfter = await amm.getReserves();
        const kAfter = reservesAfter[0] * reservesAfter[1];

        expect(kAfter).to.be.at.least(kBefore);
        if (lastK > 0n) {
          expect(kAfter).to.be.at.least(lastK);
        }
        lastK = kAfter;
      }
    });
  });

  describe("Constant-Product Invariant", () => {
    it("should maintain invariant through add/remove/swap sequence", async () => {
      // Initial liquidity
      await amm.connect(lp1).addLiquidity(toWei(2000), toWei(1000));
      let reserves = await amm.getReserves();
      let lastK = reserves[0] * reserves[1];

      // Add more liquidity
      await amm.connect(lp2).addLiquidity(toWei(1000), toWei(500));
      reserves = await amm.getReserves();
      let k = reserves[0] * reserves[1];
      expect(k).to.be.at.least(lastK);
      lastK = k;

      // Swap
      await amm.connect(trader).swap(await token0.getAddress(), toWei(100));
      reserves = await amm.getReserves();
      k = reserves[0] * reserves[1];
      expect(k).to.be.at.least(lastK);
      lastK = k;

      // Remove liquidity
      const lpBalance = await lpToken.balanceOf(lp1.address);
      const half = lpBalance / 2n;
      await amm.connect(lp1).removeLiquidity(half);
      reserves = await amm.getReserves();
      k = reserves[0] * reserves[1];
      // Removing liquidity decreases k, but should still be positive
      expect(k).to.be.greaterThan(0);
    });

    it("should never decrease k during swaps", async () => {
      await amm.connect(lp1).addLiquidity(toWei(2000), toWei(1000));
      const initialReserves = await amm.getReserves();
      let lastK = initialReserves[0] * initialReserves[1];

      const trades = [toWei(10), toWei(20), toWei(5), toWei(50)];

      for (const amount of trades) {
        await amm.connect(trader).swap(await token0.getAddress(), amount);
        const reserves = await amm.getReserves();
        const k = reserves[0] * reserves[1];
        expect(k).to.be.at.least(lastK);
        lastK = k;
      }
    });
  });

  describe("Slippage Protection", () => {
    beforeEach(async () => {
      await amm.connect(lp1).addLiquidity(toWei(1000), toWei(1000));
    });

    it("should calculate output correctly for small swaps", async () => {
      const amountIn = toWei(1);
      const reservesBefore = await amm.getReserves();
      const amountInWithFee = (amountIn * 997n) / 1000n;
      const expectedOut =
        (amountInWithFee * reservesBefore[1]) /
        (reservesBefore[0] + amountInWithFee);

      await amm.connect(trader).swap(await token0.getAddress(), amountIn);
      const reservesAfter = await amm.getReserves();

      // Verify output matches calculation
      expect(reservesBefore[1] - reservesAfter[1]).to.equal(expectedOut);
    });

    it("should show price impact for large swaps", async () => {
      const amountIn = toWei(300);
      const reservesBefore = await amm.getReserves();
      const amountInWithFee = (amountIn * 997n) / 1000n;
      const expectedOut =
        (amountInWithFee * reservesBefore[1]) /
        (reservesBefore[0] + amountInWithFee);

      await amm.connect(trader).swap(await token0.getAddress(), amountIn);

      // Large swap should have significant price impact
      const reservesAfter = await amm.getReserves();
      expect(reservesAfter[0]).to.be.gt(reservesAfter[1]);
      expect(reservesBefore[1] - reservesAfter[1]).to.equal(expectedOut);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very small liquidity amounts", async () => {
      const amount0 = 1n;
      const amount1 = 1n;
      await amm.connect(lp1).addLiquidity(amount0, amount1);

      const reserves = await amm.getReserves();
      expect(reserves[0]).to.equal(amount0);
      expect(reserves[1]).to.equal(amount1);
    });

    it("should prevent complete reserve draining", async () => {
      await amm.connect(lp1).addLiquidity(toWei(100), toWei(100));
      const reservesBefore = await amm.getReserves();
      
      // Try to swap a huge amount - constant product formula prevents complete draining
      const hugeAmount = toWei(10000);
      
      // The swap will succeed (if balance allows) but can never drain reserves completely
      // The formula ensures amountOut < reserveOut always
      await amm.connect(trader).swap(await token0.getAddress(), hugeAmount);
      
      const reservesAfter = await amm.getReserves();
      // Output should be less than original reserve (mathematically impossible to drain completely)
      expect(reservesAfter[1]).to.be.greaterThan(0);
      expect(reservesAfter[1]).to.be.lessThan(reservesBefore[1]);
      
      // Mint more tokens and try another huge swap - still can't drain completely
      await token0.mint(trader.address, hugeAmount);
      const reservesBefore2 = await amm.getReserves();
      await amm.connect(trader).swap(await token0.getAddress(), hugeAmount);
      const reservesAfter2 = await amm.getReserves();
      // Even after two huge swaps, reserve is never fully drained
      expect(reservesAfter2[1]).to.be.greaterThan(0);
      expect(reservesAfter2[1]).to.be.lessThan(reservesBefore2[1]);
    });
  });
});

