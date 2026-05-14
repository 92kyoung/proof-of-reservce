const { expect } = require("chai");
const { ethers }  = require("hardhat");

describe("ProofOfReserve", () => {
  let por, owner, oracle, stranger;
  const BTC_RESERVE = ethers.parseUnits("503000000", 8); // $503M
  const BTC_ISSUED  = ethers.parseUnits("491000000", 8); // $491M

  beforeEach(async () => {
    [owner, oracle, stranger] = await ethers.getSigners();

    const PoR = await ethers.getContractFactory("ProofOfReserve");
    por = await PoR.deploy();

    // 자산 등록
    await por.registerAsset("BTC");
    await por.registerAsset("ETH");

    // 오라클 계정 승인
    await por.setOracle(oracle.address, true);
  });

  it("자산이 정상 등록되어야 한다", async () => {
    const list = await por.getAssetList();
    expect(list).to.include("BTC");
    expect(list).to.include("ETH");
  });

  it("승인된 오라클만 준비금을 제출할 수 있다", async () => {
    const ts = BigInt(Math.floor(Date.now() / 1000));
    await expect(
      por.connect(stranger).submitReserve("BTC", BTC_RESERVE, BTC_ISSUED, ts, 1n)
    ).to.be.revertedWith("PoR: not authorized oracle");
  });

  it("정상 제출 시 verified = true", async () => {
    const ts = BigInt(Math.floor(Date.now() / 1000));
    await por.connect(oracle).submitReserve("BTC", BTC_RESERVE, BTC_ISSUED, ts, 1n);

    const [, , ratio, verified, isStale] = await por.getReserveStatus("BTC");
    expect(verified).to.be.true;
    expect(isStale).to.be.false;
    expect(ratio).to.be.gte(10_000n); // 100% 이상
  });

  it("과소담보 시 UnderCollateralized 이벤트 발생", async () => {
    const ts = BigInt(Math.floor(Date.now() / 1000));
    const lowReserve = ethers.parseUnits("400000000", 8); // $400M (< $491M)
    await expect(
      por.connect(oracle).submitReserve("BTC", lowReserve, BTC_ISSUED, ts, 2n)
    ).to.emit(por, "UnderCollateralized");
  });

  it("isSystemHealthy는 모든 자산 검증 시 true 반환", async () => {
    const ts = BigInt(Math.floor(Date.now() / 1000));
    await por.connect(oracle).submitReserve("BTC", BTC_RESERVE, BTC_ISSUED, ts, 1n);
    await por.connect(oracle).submitReserve("ETH",
      ethers.parseUnits("421000000", 8),
      ethers.parseUnits("412000000", 8),
      ts, 2n
    );
    const [healthy] = await por.isSystemHealthy();
    expect(healthy).to.be.true;
  });
});
