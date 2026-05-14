import React from "react";
import s from "./AssetCard.module.css";

const ICONS = { BTC: "₿", ETH: "Ξ", USDC: "$" };

export default function AssetCard({ asset, data }) {
  if (!data || data.error) {
    return (
      <div className={s.card}>
        <div className={s.assetName}>{asset}</div>
        <div className={s.noData}>데이터 없음</div>
      </div>
    );
  }

  const ratio   = parseFloat(data.ratioPct);
  const isOk    = data.verified && !data.isStale;
  const isStale = data.isStale;
  const isUnder = ratio < 100;

  const statusLabel = isStale ? "STALE" : isUnder ? "UNDER" : isOk ? "VERIFIED" : "PENDING";
  const statusCls   = isStale ? s.stale : isUnder ? s.under : isOk ? s.ok : s.pending;

  // 비율 바 색상
  const barColor = isUnder ? "var(--red)" : ratio < 105 ? "var(--amber)" : "var(--green)";

  return (
    <div className={`${s.card} ${isUnder ? s.cardAlert : ""}`}>
      <div className={s.top}>
        <div className={s.icon}>{ICONS[asset] ?? asset[0]}</div>
        <div>
          <div className={s.assetName}>{asset}</div>
          <div className={`${s.badge} ${statusCls}`}>{statusLabel}</div>
        </div>
        <div className={s.ratio}>{ratio.toFixed(2)}%</div>
      </div>

      <div className={s.bar}>
        <div
          className={s.barFill}
          style={{ width: `${Math.min(ratio, 100)}%`, background: barColor }}
        />
      </div>
      <div className={s.barLabels}>
        <span>0%</span><span>준비율</span><span>100%</span>
      </div>

      <div className={s.grid}>
        <div className={s.gridItem}>
          <span className={s.gridLabel}>준비금</span>
          <span className={s.gridVal}>${(data.reserveUsd / 1e6).toFixed(1)}M</span>
        </div>
        <div className={s.gridItem}>
          <span className={s.gridLabel}>발행량</span>
          <span className={s.gridVal}>${(data.issuedUsd / 1e6).toFixed(1)}M</span>
        </div>
        <div className={s.gridItem}>
          <span className={s.gridLabel}>초과분</span>
          <span className={s.gridVal} style={{ color: isUnder ? "var(--red)" : "var(--green)" }}>
            {isUnder ? "-" : "+"}${(Math.abs(data.reserveUsd - data.issuedUsd) / 1e6).toFixed(1)}M
          </span>
        </div>
      </div>

      <div className={s.footer}>
        <span className={s.ts}>
          업데이트: {data.lastUpdate ? new Date(data.lastUpdate).toLocaleTimeString("ko-KR") : "—"}
        </span>
        {isStale && <span className={s.staleWarn}>⚠ STALE DATA</span>}
      </div>
    </div>
  );
}
