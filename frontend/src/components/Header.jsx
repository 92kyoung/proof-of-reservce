import React from "react";
import s from "./Header.module.css";

export default function Header({ system, lastPoll, onRefetch }) {
  const healthy = system?.healthy;
  const block   = system?.blockNumber;

  return (
    <header className={s.header}>
      <div className={s.left}>
        <div className={s.logo}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 6v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V6L12 2z"
              fill="#00d4ff" fillOpacity=".15" stroke="#00d4ff" strokeWidth="1.2"/>
            <path d="M9 12l2 2 4-4" stroke="#00d4ff" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <div className={s.title}>PROOF OF RESERVE</div>
          <div className={s.sub}>Chainlink · Hyperledger Besu</div>
        </div>
      </div>

      <div className={s.right}>
        {block && (
          <div className={s.chip}>
            <span className={s.chipLabel}>BLOCK</span>
            <span className={s.chipVal}>#{block?.toLocaleString()}</span>
          </div>
        )}

        <div className={`${s.status} ${healthy == null ? s.unknown : healthy ? s.ok : s.fail}`}>
          <span className={s.dot} />
          {healthy == null ? "연결 중..." : healthy ? "VERIFIED" : "ALERT"}
        </div>

        <button className={s.refreshBtn} onClick={onRefetch} title="새로고침">
          ↻
        </button>

        {lastPoll && (
          <div className={s.lastPoll}>
            {lastPoll.toLocaleTimeString("ko-KR")} 업데이트
          </div>
        )}
      </div>
    </header>
  );
}
