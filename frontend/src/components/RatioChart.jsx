import React from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend
} from "recharts";
import s from "./RatioChart.module.css";

const COLORS = {
  BTC:  "#00d4ff",
  ETH:  "#00e5a0",
  USDC: "#ffb830",
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={s.tooltip}>
      <div className={s.tooltipTime}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className={s.tooltipRow}>
          <span style={{ color: p.color }}>{p.dataKey}</span>
          <span>{p.value?.toFixed(2)}%</span>
        </div>
      ))}
    </div>
  );
};

export default function RatioChart({ history }) {
  if (!history?.length) {
    return (
      <div className={s.wrap}>
        <div className={s.title}>담보율 추이</div>
        <div className={s.empty}>데이터 수집 중...</div>
      </div>
    );
  }

  const assets = Object.keys(COLORS).filter(k => history[0]?.[k] !== undefined);

  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <span className={s.title}>담보율 추이</span>
        <span className={s.sub}>10초 폴링 · 최근 30개</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#1e2d42" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fill: "#3a5070", fontSize: 10, fontFamily: "IBM Plex Mono" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[95, 110]}
            tick={{ fill: "#3a5070", fontSize: 10, fontFamily: "IBM Plex Mono" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v}%`}
          />
          <ReferenceLine
            y={100}
            stroke="#ff3d5a"
            strokeDasharray="4 4"
            strokeWidth={1}
            label={{ value: "100%", fill: "#ff3d5a", fontSize: 10, position: "right" }}
          />
          <Tooltip content={<CustomTooltip />} />
          {assets.map(a => (
            <Line
              key={a}
              type="monotone"
              dataKey={a}
              stroke={COLORS[a]}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: COLORS[a] }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
