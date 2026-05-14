const BASE = "/api";

export async function fetchReserves() {
  const res = await fetch(`${BASE}/reserves`);
  if (!res.ok) throw new Error("reserves fetch failed");
  return res.json();
}

export async function fetchAsset(asset) {
  const res = await fetch(`${BASE}/reserves/${asset}`);
  if (!res.ok) throw new Error(`${asset} fetch failed`);
  return res.json();
}

export async function fetchSystem() {
  const res = await fetch(`${BASE}/system`);
  if (!res.ok) throw new Error("system fetch failed");
  return res.json();
}

export async function submitReserve({ asset, reserveAmount, issuedAmount }) {
  const res = await fetch(`${BASE}/submit`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ asset, reserveAmount, issuedAmount }),
  });
  if (!res.ok) throw new Error("submit failed");
  return res.json();
}
