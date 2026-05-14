import React, { useState, useEffect } from "react";
import { ethers }    from "ethers";
import { usePoR }    from "./hooks/usePoR.js";
import Header        from "./components/Header.jsx";
import AssetCard     from "./components/AssetCard.jsx";
import RatioChart    from "./components/RatioChart.jsx";
import SubmitForm    from "./components/SubmitForm.jsx";
import EventLog      from "./components/EventLog.jsx";
import s             from "./App.module.css";

// ─── 이벤트 리스너 (ethers.js — Besu RPC 직접 연결) ─────────────────────────
const ABI = [
  "event ReserveSubmitted(string indexed asset, uint256 reserveAmount, uint256 issuedAmount, uint256 ratio, bool verified, uint80 roundId)",
  "event UnderCollateralized(string indexed asset, uint256 reserveAmount, uint256 issuedAmount, uint256 ratio)",
  "event StaleData(string indexed asset, uint256 dataTimestamp, uint256 currentTime)",
];

const RPC      = import.meta.env.VITE_BESU_RPC_URL      || "http://localhost:8545";
const CONTRACT = import.meta.env.VITE_CONTRACT_ADDRESS  || "";

export default function App() {
  const { reserves, system, history, loading, error, lastPoll, refetch } = usePoR();
  const [events, setEvents] = useState([]);

  // 온체인 이벤트 구독
  useEffect(() => {
    if (!CONTRACT) return;
    let contract;
    try {
      const provider = new ethers.JsonRpcProvider(RPC);
      contract = new ethers.Contract(CONTRACT, ABI, provider);

      const addEvent = (type, extra) => {
        setEvents(prev => [{
          type,
          time: new Date().toLocaleTimeString("ko-KR"),
          ...extra,
        }, ...prev].slice(0, 50));
      };

      contract.on("ReserveSubmitted", (asset, reserve, issued, ratio, verified, roundId, ev) => {
        addEvent("ReserveSubmitted", {
          asset, ratio,
          txHash: ev.log?.transactionHash,
          block:  ev.log?.blockNumber,
        });
      });

      contract.on("UnderCollateralized", (asset, reserve, issued, ratio, ev) => {
        addEvent("UnderCollateralized", {
          asset, ratio,
          txHash: ev.log?.transactionHash,
          block:  ev.log?.blockNumber,
        });
      });

      contract.on("StaleData", (asset, _dataTs, _curTs, ev) => {
        addEvent("StaleData", {
          asset,
          txHash: ev.log?.transactionHash,
          block:  ev.log?.blockNumber,
        });
      });
    } catch {}

    return () => { contract?.removeAllListeners(); };
  }, []);

  const assetKeys = reserves ? Object.keys(reserves) : ["BTC", "ETH", "USDC"];

  return (
    <div className={s.root}>
      <Header system={system} lastPoll={lastPoll} onRefetch={refetch} />

      <main className={s.main}>
        {/* 에러 배너 */}
        {error && (
          <div className={s.errorBanner}>
            ⚠ API 연결 실패 — 백엔드 서버가 실행 중인지 확인하세요 ({error})
          </div>
        )}

        {/* 로딩 */}
        {loading && !reserves && (
          <div className={s.loading}>
            <span className={s.spinner} /> 온체인 데이터 로딩 중...
          </div>
        )}

        {/* 자산 카드 */}
        {reserves && (
          <section className={s.section}>
            <div className={s.sectionLabel}>준비금 현황</div>
            <div className={s.cardGrid}>
              {assetKeys.map(asset => (
                <AssetCard key={asset} asset={asset} data={reserves[asset]} />
              ))}
            </div>
          </section>
        )}

        {/* 차트 + 이벤트 */}
        <section className={s.section}>
          <div className={s.twoCol}>
            <RatioChart history={history} />
            <EventLog events={events} />
          </div>
        </section>

        {/* 수동 제출 폼 */}
        <section className={s.section}>
          <div className={s.sectionLabel}>관리</div>
          <SubmitForm onSuccess={refetch} />
        </section>

        {/* 컨트랙트 정보 */}
        {system && (
          <section className={s.section}>
            <div className={s.infoGrid}>
              <div className={s.infoItem}>
                <span className={s.infoLabel}>CONTRACT</span>
                <span className={s.infoVal}>{system.contractAddress || "—"}</span>
              </div>
              <div className={s.infoItem}>
                <span className={s.infoLabel}>NETWORK</span>
                <span className={s.infoVal}>Hyperledger Besu</span>
              </div>
              <div className={s.infoItem}>
                <span className={s.infoLabel}>BLOCK TIME</span>
                <span className={s.infoVal}>{system.blockTime ? new Date(system.blockTime).toLocaleString("ko-KR") : "—"}</span>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
