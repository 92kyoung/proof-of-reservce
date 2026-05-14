/**
 * index.js
 * REST API 서버 — 온체인 준비금 상태를 외부에 노출
 *
 * GET /health               서버 상태
 * GET /api/reserves         전체 자산 준비금 현황
 * GET /api/reserves/:asset  특정 자산 상세
 * GET /api/system           시스템 전체 건강 상태
 * POST /api/submit          수동 준비금 제출 (테스트용)
 */

"use strict";

const express  = require("express");
const cors     = require("cors");
const { ethers } = require("ethers");
require("dotenv").config();

// ─── ABI ──────────────────────────────────────────────────────────────────────
const ABI = [
  "function submitReserve(string asset, uint256 reserveAmount, uint256 issuedAmount, uint256 dataTimestamp, uint80 roundId) external",
  "function getReserveStatus(string asset) external view returns (uint256 reserveAmount, uint256 issuedAmount, uint256 ratioBps, bool verified, bool isStale, uint256 lastUpdate)",
  "function isSystemHealthy() external view returns (bool healthy, string failedAsset)",
  "function getAssetList() external view returns (string[])",
  "function reserves(string) external view returns (string asset, uint256 reserveAmount, uint256 issuedAmount, uint256 timestamp, uint80 roundId, bool verified)",
];

// ─── 초기화 ───────────────────────────────────────────────────────────────────
const app      = express();
const PORT     = process.env.PORT || 3000;

const provider = new ethers.JsonRpcProvider(
  process.env.BESU_RPC_URL || "http://127.0.0.1:8545"
);
const signer   = new ethers.Wallet(process.env.ORACLE_PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, signer);
const readContract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, provider);

app.use(cors());
app.use(express.json());

// ─── 유틸 ─────────────────────────────────────────────────────────────────────
function formatReserve(raw) {
  const reserve = Number(raw.reserveAmount) / 1e8;
  const issued  = Number(raw.issuedAmount)  / 1e8;
  return {
    reserveUsd:  reserve,
    issuedUsd:   issued,
    ratioPct:    issued > 0 ? ((reserve / issued) * 100).toFixed(2) : "0.00",
    ratioBps:    Number(raw.ratioBps),
    verified:    raw.verified,
    isStale:     raw.isStale,
    lastUpdate:  new Date(Number(raw.lastUpdate) * 1000).toISOString(),
  };
}

// ─── 라우트 ───────────────────────────────────────────────────────────────────

// GET /health
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// GET /api/reserves — 전체 자산
app.get("/api/reserves", async (req, res) => {
  try {
    const assets = await readContract.getAssetList();
    const results = {};

    for (const asset of assets) {
      try {
        const raw = await readContract.getReserveStatus(asset);
        results[asset] = formatReserve({
          reserveAmount: raw[0],
          issuedAmount:  raw[1],
          ratioBps:      raw[2],
          verified:      raw[3],
          isStale:       raw[4],
          lastUpdate:    raw[5],
        });
      } catch {
        results[asset] = { error: "데이터 없음" };
      }
    }

    res.json({ assets: results, fetchedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reserves/:asset — 특정 자산
app.get("/api/reserves/:asset", async (req, res) => {
  try {
    const asset = req.params.asset.toUpperCase();
    const raw   = await readContract.getReserveStatus(asset);

    res.json({
      asset,
      ...formatReserve({
        reserveAmount: raw[0],
        issuedAmount:  raw[1],
        ratioBps:      raw[2],
        verified:      raw[3],
        isStale:       raw[4],
        lastUpdate:    raw[5],
      }),
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(404).json({ error: `${req.params.asset} 데이터를 찾을 수 없습니다` });
  }
});

// GET /api/system — 전체 시스템 상태
app.get("/api/system", async (req, res) => {
  try {
    const [healthy, failedAsset] = await readContract.isSystemHealthy();
    const block = await provider.getBlock("latest");

    res.json({
      healthy,
      failedAsset: healthy ? null : failedAsset,
      blockNumber: block.number,
      blockTime:   new Date(Number(block.timestamp) * 1000).toISOString(),
      contractAddress: process.env.CONTRACT_ADDRESS,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/submit — 수동 제출 (테스트 / 관리자용)
app.post("/api/submit", async (req, res) => {
  const { asset, reserveAmount, issuedAmount } = req.body;

  if (!asset || !reserveAmount || !issuedAmount) {
    return res.status(400).json({ error: "asset, reserveAmount, issuedAmount 필수" });
  }

  try {
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const roundId   = timestamp;

    const tx = await contract.submitReserve(
      asset.toUpperCase(),
      BigInt(Math.floor(Number(reserveAmount) * 1e8)),
      BigInt(Math.floor(Number(issuedAmount)  * 1e8)),
      timestamp,
      roundId,
    );
    const receipt = await tx.wait();

    res.json({
      success: true,
      txHash:  receipt.hash,
      block:   receipt.blockNumber,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 시작 ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[API] Proof of Reserve API 서버 시작: http://localhost:${PORT}`);
  console.log(`[API] 컨트랙트: ${process.env.CONTRACT_ADDRESS}`);
  console.log(`[API] Besu RPC: ${process.env.BESU_RPC_URL || "http://127.0.0.1:8545"}`);
});
