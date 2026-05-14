import React, { useState } from "react";
import { submitReserve } from "../api.js";
import s from "./SubmitForm.module.css";

const ASSETS = ["BTC", "ETH", "USDC"];

export default function SubmitForm({ onSuccess }) {
  const [asset,   setAsset]   = useState("BTC");
  const [reserve, setReserve] = useState("");
  const [issued,  setIssued]  = useState("");
  const [status,  setStatus]  = useState(null); // null | "loading" | "ok" | "err"
  const [result,  setResult]  = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reserve || !issued) return;
    setStatus("loading");
    setResult(null);
    try {
      const res = await submitReserve({
        asset,
        reserveAmount: parseFloat(reserve),
        issuedAmount:  parseFloat(issued),
      });
      setResult(res);
      setStatus("ok");
      onSuccess?.();
    } catch (err) {
      setResult({ error: err.message });
      setStatus("err");
    }
  }

  return (
    <div className={s.wrap}>
      <div className={s.title}>수동 준비금 제출 <span className={s.tag}>테스트</span></div>
      <form className={s.form} onSubmit={handleSubmit}>
        <div className={s.row}>
          <div className={s.field}>
            <label className={s.label}>자산</label>
            <select className={s.select} value={asset} onChange={e => setAsset(e.target.value)}>
              {ASSETS.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div className={s.field}>
            <label className={s.label}>준비금 (USD)</label>
            <input
              className={s.input}
              type="number"
              placeholder="503000000"
              value={reserve}
              onChange={e => setReserve(e.target.value)}
            />
          </div>
          <div className={s.field}>
            <label className={s.label}>발행량 (USD)</label>
            <input
              className={s.input}
              type="number"
              placeholder="491000000"
              value={issued}
              onChange={e => setIssued(e.target.value)}
            />
          </div>
        </div>

        <button className={s.btn} type="submit" disabled={status === "loading"}>
          {status === "loading" ? "제출 중..." : "온체인 제출 →"}
        </button>
      </form>

      {status === "ok" && result && (
        <div className={s.resultOk}>
          ✓ 트랜잭션 확정 · {result.txHash?.slice(0, 20)}... · 블록 #{result.block}
        </div>
      )}
      {status === "err" && result && (
        <div className={s.resultErr}>✗ {result.error}</div>
      )}
    </div>
  );
}
