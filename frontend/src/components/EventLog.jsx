import React from "react";
import s from "./EventLog.module.css";

const TYPE_CONFIG = {
  ReserveSubmitted:    { color: "var(--green)",  icon: "✓", label: "SUBMITTED" },
  UnderCollateralized: { color: "var(--red)",    icon: "!", label: "ALERT" },
  StaleData:           { color: "var(--amber)",  icon: "⏰", label: "STALE" },
  OracleAuthChanged:   { color: "var(--accent)", icon: "◆", label: "AUTH" },
};

export default function EventLog({ events }) {
  if (!events?.length) {
    return (
      <div className={s.wrap}>
        <div className={s.title}>온체인 이벤트 로그</div>
        <div className={s.empty}>이벤트 대기 중...</div>
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <span className={s.title}>온체인 이벤트 로그</span>
        <span className={s.count}>{events.length}</span>
      </div>
      <div className={s.list}>
        {events.map((ev, i) => {
          const cfg = TYPE_CONFIG[ev.type] || { color: "var(--text2)", icon: "·", label: ev.type };
          return (
            <div key={i} className={s.item} style={{ "--ev-color": cfg.color }}>
              <span className={s.icon}>{cfg.icon}</span>
              <div className={s.body}>
                <div className={s.meta}>
                  <span className={s.badge}>{cfg.label}</span>
                  {ev.asset && <span className={s.asset}>{ev.asset}</span>}
                  {ev.ratio && (
                    <span className={s.ratio}>
                      {(Number(ev.ratio) / 100).toFixed(2)}%
                    </span>
                  )}
                </div>
                {ev.txHash && (
                  <div className={s.hash}>{ev.txHash.slice(0, 18)}...#{ev.block}</div>
                )}
                <div className={s.time}>{ev.time}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
