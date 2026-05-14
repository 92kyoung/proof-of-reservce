const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("배포 계정:", deployer.address);

  // 1. 컨트랙트 배포
  const PoR = await hre.ethers.getContractFactory("ProofOfReserve");
  const por = await PoR.deploy();
  await por.waitForDeployment();

  const address = await por.getAddress();
  console.log("ProofOfReserve 배포 완료:", address);

  // 2. 기본 자산 등록
  const assets = ["BTC", "ETH", "USDC"];
  for (const asset of assets) {
    const tx = await por.registerAsset(asset);
    await tx.wait();
    console.log(`자산 등록: ${asset}`);
  }

  // 3. .env에 저장할 값 출력
  console.log("\n─── .env에 추가하세요 ───────────────────────────");
  console.log(`CONTRACT_ADDRESS=${address}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
