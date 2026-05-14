/**
 * oracle.js
 * 오프체인 준비금 데이터를 수집하고 온체인에 제출하는 오라클 백엔드
 *
 * 실제 환경에서는 은행 API / 수탁기관 API를 호출하지만
 * 여기서는 시뮬레이션 데이터를 사용합니다.
 */

"use strict";

const { ethers } = require("ethers");
require("dotenv").config();

// ─── ABI (필요한 함수만) ───────────────────────────────────────────────────────
const ABI = [
  "function submitReserve(string asset, uint256 reserveAmount, uint256 issuedAmount, uint256 dataTimestamp, uint80 roundId) external",
  "function getReserveStatus(string asset) external view returns (uint256, uint256, uint256, bool, bool, uint256)",
  "function isSystemHealthy() external view returns (bool, string)",
  "event ReserveSubmitted(string indexed asset, uint256 reserveAmount, uint256 issuedAmount, uint256 ratio, bool verified, uint80 roundId)",
  "event UnderCollateralized(string indexed asset, uint256 reserveAmount, uint256 issuedAmount, uint256 ratio)",
  "event StaleData(string indexed asset, uint256 dataTimestamp, uint256 currentTime)",
];

// ─── 설정 ─────────────────────────────────────────────────────────────────────
const CONFIG = {
  rpcUrl:          process.env.BESU_RPC_URL      || "http://127.0.0.1:8545",
  contractAddress: process.env.CONTRACT_ADDRESS,
  privateKey:      process.env.ORACLE_PRIVATE_KEY,
  submitInterval:  parseInt(process.env.SUBMIT_INTERVAL_MS || "30000"), // 30초
};

// ─── 오프체인 데이터 소스 시뮬레이션 ─────────────────────────────────────────
// 실제 구현: 은행 API / Fireblocks / BitGo 등의 수탁기관 API 호출
async function fetchOffChainReserves() {
  console.log("[Oracle] 오프체인 준비금 데이터 수집 중...");

  // 실제 환경 예시:
  // const btcReserve = await custodianApi.getBtcBalance();
  // const ethReserve = await custodianApi.getEthBalance();

  // 시뮬레이션: 약간의 변동성 추가
  const jitter = () => 1 + (Math.random() - 0.5) * 0.02; // ±1%

  return [
    {
      asset:         "BTC",
      // 8 decimals 고정소수점 (Chainlink 표준)
      reserveAmount: BigInt(Math.floor(503_000_000 * jitter())) * BigInt(1e8),
      issuedAmount:  BigInt(491_000_000) * BigInt(1e8),
    },
    {
      asset:         "ETH",
      reserveAmount: BigInt(Math.floor(421_000_000 * jitter())) * BigInt(1e8),
      issuedAmount:  BigInt(412_000_000) * BigInt(1e8),
    },
    {
      asset:         "USDC",
      reserveAmount: BigInt(Math.floor(318_000_000 * jitter())) * BigInt(1e8),
      issuedAmount:  BigInt(311_000_000) * BigInt(1e8),
    },
  ];
}

// ─── 준비금 제출 ──────────────────────────────────────────────────────────────
async function submitReserves(contract, reserves) {
  const provider = contract.runner.provider;
  const block = await provider.getBlock("latest");
  const blockTimestamp = BigInt(block.timestamp);

  let roundId = blockTimestamp; // 블록 타임스탬프 기반 roundId

  for (const r of reserves) {
    const timestamp = blockTimestamp;

    console.log(`\n[Oracle] ${r.asset} 제출 중...`);
    console.log(`  준비금: $${Number(r.reserveAmount / BigInt(1e8)).toLocaleString()}`);
    console.log(`  발행량: $${Number(r.issuedAmount  / BigInt(1e8)).toLocaleString()}`);

    try {
      const tx = await contract.submitReserve(
        r.asset,
        r.reserveAmount,
        r.issuedAmount,
        timestamp,
        roundId,
      );
      const receipt = await tx.wait();
      console.log(`  ✅ 트랜잭션 확정: ${receipt.hash} (블록 ${receipt.blockNumber})`);
      roundId++;
    } catch (err) {
      console.error(`  ❌ ${r.asset} 제출 실패:`, err.message);
    }
  }
}

// ─── 이벤트 리스너 (queryFilter 폴링 방식) ────────────────────────────────────
// contract.on()은 eth_getFilterChanges를 사용하며 로컬 노드에서 필터 만료 오류 발생.
// queryFilter로 블록 범위를 직접 조회하는 방식으로 대체.
async function setupEventListeners(contract, provider, pollInterval = 5000) {
  let lastBlock = await provider.getBlockNumber();

  async function pollEvents() {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock <= lastBlock) return;

      const fromBlock = lastBlock + 1;
      const [submitted, underCol, stale] = await Promise.all([
        contract.queryFilter(contract.filters.ReserveSubmitted(), fromBlock, currentBlock),
        contract.queryFilter(contract.filters.UnderCollateralized(), fromBlock, currentBlock),
        contract.queryFilter(contract.filters.StaleData(), fromBlock, currentBlock),
      ]);

      for (const e of submitted) {
        const [asset, , , ratio, verified] = e.args;
        const pct = (Number(ratio) / 100).toFixed(2);
        const status = verified ? "✅ 검증됨" : "⚠️ 미검증";
        console.log(`\n[Event] ReserveSubmitted | ${asset} | 담보율 ${pct}% | ${status}`);
      }
      for (const e of underCol) {
        const [asset, , , ratio] = e.args;
        const pct = (Number(ratio) / 100).toFixed(2);
        console.error(`\n🚨 [Alert] 과소담보 감지! ${asset} 담보율 ${pct}%`);
      }
      for (const e of stale) {
        const [asset, dataTs, currentTs] = e.args;
        const ageHours = ((Number(currentTs) - Number(dataTs)) / 3600).toFixed(1);
        console.warn(`\n⏰ [Alert] 스테일 데이터! ${asset} (${ageHours}시간 경과)`);
      }

      lastBlock = currentBlock;
    } catch (_) {
      // 일시적 오류는 다음 폴링에서 재시도
    }
  }

  setInterval(pollEvents, pollInterval);
  console.log(`[Oracle] 이벤트 리스너 활성화 (폴링 ${pollInterval / 1000}초)`);
}

// ─── 상태 조회 ────────────────────────────────────────────────────────────────
async function printStatus(contract) {
  const [healthy, failedAsset] = await contract.isSystemHealthy();
  console.log("\n─── 시스템 상태 ─────────────────────────────────");
  console.log(`전체: ${healthy ? "✅ 정상" : `❌ 이상 (${failedAsset})`}`);

  for (const asset of ["BTC", "ETH", "USDC"]) {
    try {
      const [reserve, issued, ratio, verified, isStale] =
        await contract.getReserveStatus(asset);
      const pct = issued > 0n ? (Number(ratio) / 100).toFixed(2) : "N/A";
      console.log(
        `${asset}: 담보율 ${pct}% | ${verified ? "✅" : "❌"} | ${isStale ? "⏰ 스테일" : "🟢 최신"}`
      );
    } catch {
      console.log(`${asset}: 데이터 없음`);
    }
  }
  console.log("─────────────────────────────────────────────────\n");
}

// ─── 메인 루프 ────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Chainlink Proof of Reserve Oracle 시작 ===");
  console.log(`RPC: ${CONFIG.rpcUrl}`);
  console.log(`컨트랙트: ${CONFIG.contractAddress}`);
  console.log(`제출 주기: ${CONFIG.submitInterval / 1000}초\n`);

  // Provider / Signer 초기화
  const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
  const signer   = new ethers.Wallet(CONFIG.privateKey, provider);
  const contract = new ethers.Contract(CONFIG.contractAddress, ABI, signer);

  console.log("[Oracle] 오라클 주소:", signer.address);

  // 이벤트 리스너 등록
  const readContract = new ethers.Contract(CONFIG.contractAddress, ABI, provider);
  await setupEventListeners(readContract, provider);

  // 최초 실행
  const reserves = await fetchOffChainReserves();
  await submitReserves(contract, reserves);
  await printStatus(contract);

  // 주기적 실행
  setInterval(async () => {
    console.log(`\n[Oracle] 정기 업데이트 (${new Date().toLocaleTimeString()})`);
    const data = await fetchOffChainReserves();
    await submitReserves(contract, data);
    await printStatus(contract);
  }, CONFIG.submitInterval);
}

main().catch(console.error);
