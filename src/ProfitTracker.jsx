import { useState, useEffect, useMemo } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronRight, TrendingUp, TrendingDown,
  Coins, Pickaxe, X, Download, Upload, ShoppingCart, AlertCircle, CheckCircle2,
} from "lucide-react";

/* ---------- formatting ---------- */
const fmtIDR = (n) => "Rp" + Math.round(n || 0).toLocaleString("id-ID");
const fmtPct = (n) =>
  (n * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "%";

const CUR = { IDR: "IDR", USD: "USD" };

const newCycle = (n, rate) => ({
  id: crypto.randomUUID(),
  name: `Cycle ${n}`,
  rate,
  expenses: [],
  goldQty: "",
  goldPrice: "",
});

const STORAGE_KEY = "cycle_ledger_v1";
const RATE_KEY = "cycle_ledger_rate_v1";

/* localStorage helpers */
const load = (k, fallback) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

function seedData() {
  const c = newCycle(1, 17800);
  c.expenses = [
    { id: crypto.randomUUID(), label: "Modal Rupiah", amount: 440000, currency: CUR.IDR },
    { id: crypto.randomUUID(), label: "Modal Dollar", amount: 32, currency: CUR.USD },
  ];
  c.goldQty = 40;
  c.goldPrice = 3.5;
  return [c];
}

/* ---------- Kintara parser ---------- */
function parseKintara(text) {
  const pattern = /You bought (\d+) (.+?) for \$([\d.]+) USD/g;
  const results = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const qty = parseInt(match[1], 10);
    const item = match[2].trim();
    const price = parseFloat(match[3]);
    const label = qty > 1 ? `${qty}x ${item}` : item;
    results.push({ id: crypto.randomUUID(), label, amount: price, currency: CUR.USD });
  }
  return results;
}

export default function ProfitTracker() {
  const [defaultRate, setDefaultRate] = useState(() => load(RATE_KEY, 17800));
  const [cycles, setCycles] = useState(() => load(STORAGE_KEY, null) || seedData());
  const [open, setOpen] = useState(() => {
    const c = load(STORAGE_KEY, null) || seedData();
    return Object.fromEntries(c.map((x, i) => [x.id, i === c.length - 1]));
  });

  /* import kintara modal state */
  const [kintaraModal, setKintaraModal] = useState(null); // { cycleId }
  const [kintaraPaste, setKintaraPaste] = useState("");
  const [kintaraPreview, setKintaraPreview] = useState([]);
  const [kintaraStatus, setKintaraStatus] = useState(null); // "ok" | "empty"

  useEffect(() => save(STORAGE_KEY, cycles), [cycles]);
  useEffect(() => save(RATE_KEY, defaultRate), [defaultRate]);

  const calc = (cy) => {
    const rate = Number(cy.rate) || 0;
    const modalIDR = cy.expenses.reduce(
      (s, e) => s + (e.currency === CUR.USD ? Number(e.amount || 0) * rate : Number(e.amount || 0)),
      0
    );
    const revenueIDR = Number(cy.goldQty || 0) * Number(cy.goldPrice || 0) * rate;
    const profitIDR = revenueIDR - modalIDR;
    const roi = modalIDR > 0 ? profitIDR / modalIDR : 0;
    return { modalIDR, revenueIDR, profitIDR, roi };
  };

  const totals = useMemo(() => {
    let modal = 0, rev = 0, profit = 0;
    cycles.forEach((cy) => {
      const c = calc(cy);
      modal += c.modalIDR; rev += c.revenueIDR; profit += c.profitIDR;
    });
    return { modal, rev, profit, roi: modal > 0 ? profit / modal : 0 };
  }, [cycles]);

  const bestWorst = useMemo(() => {
    if (!cycles.length) return null;
    let best = null, worst = null;
    cycles.forEach((cy) => {
      const p = calc(cy).profitIDR;
      if (best === null || p > best.p) best = { name: cy.name, p };
      if (worst === null || p < worst.p) worst = { name: cy.name, p };
    });
    return { best, worst };
  }, [cycles]);

  /* mutations */
  const addCycle = () => {
    const c = newCycle(cycles.length + 1, defaultRate);
    setCycles((p) => [...p, c]);
    setOpen((p) => ({ ...p, [c.id]: true }));
  };
  const removeCycle = (id) => setCycles((p) => p.filter((c) => c.id !== id));
  const patchCycle = (id, patch) =>
    setCycles((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const addExpense = (id) =>
    setCycles((p) =>
      p.map((c) =>
        c.id === id
          ? { ...c, expenses: [...c.expenses, { id: crypto.randomUUID(), label: "", amount: "", currency: CUR.IDR }] }
          : c
      )
    );
  const patchExpense = (cid, eid, patch) =>
    setCycles((p) =>
      p.map((c) =>
        c.id === cid ? { ...c, expenses: c.expenses.map((e) => (e.id === eid ? { ...e, ...patch } : e)) } : c
      )
    );
  const removeExpense = (cid, eid) =>
    setCycles((p) =>
      p.map((c) => (c.id === cid ? { ...c, expenses: c.expenses.filter((e) => e.id !== eid) } : c))
    );

  /* export / import */
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ defaultRate, cycles }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cycle-ledger-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (Array.isArray(data.cycles)) {
          setCycles(data.cycles);
          if (data.defaultRate) setDefaultRate(data.defaultRate);
          setOpen(Object.fromEntries(data.cycles.map((x) => [x.id, false])));
        }
      } catch {
        alert("File backup tidak valid.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  /* kintara modal handlers */
  const openKintara = (cycleId) => {
    setKintaraModal({ cycleId });
    setKintaraPaste("");
    setKintaraPreview([]);
    setKintaraStatus(null);
  };
  const closeKintara = () => {
    setKintaraModal(null);
    setKintaraPaste("");
    setKintaraPreview([]);
    setKintaraStatus(null);
  };
  const handleKintaraPaste = (text) => {
    setKintaraPaste(text);
    const parsed = parseKintara(text);
    setKintaraPreview(parsed);
    setKintaraStatus(parsed.length > 0 ? "ok" : text.trim() ? "empty" : null);
  };
  const confirmKintara = () => {
    if (!kintaraPreview.length || !kintaraModal) return;
    const { cycleId } = kintaraModal;
    setCycles((p) =>
      p.map((c) =>
        c.id === cycleId
          ? { ...c, expenses: [...c.expenses, ...kintaraPreview] }
          : c
      )
    );
    closeKintara();
  };

  const kintaraTotalUSD = kintaraPreview.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div style={S.page}>
      <div style={S.glow} />
      <div style={S.wrap}>
        <header style={S.header}>
          <div style={S.brand}>
            <div style={S.logo}><Pickaxe size={20} strokeWidth={2.2} /></div>
            <div>
              <div style={S.kicker}>PROFIT TRACKER</div>
              <h1 style={S.h1}>Cycle Ledger</h1>
            </div>
          </div>
          <div style={S.toolbar}>
            <button style={S.ghostBtn} onClick={exportData} title="Unduh backup data">
              <Download size={15} /> Backup
            </button>
            <label style={S.ghostBtn} title="Muat dari backup">
              <Upload size={15} /> Muat
              <input type="file" accept="application/json" onChange={importData} style={{ display: "none" }} />
            </label>
            <div style={S.rateBox}>
              <span style={S.rateLabel}>USD→IDR</span>
              <div style={S.rateInputWrap}>
                <span style={S.rsign}>Rp</span>
                <input
                  style={S.rateInput}
                  type="number"
                  value={defaultRate}
                  onChange={(e) => setDefaultRate(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </header>

        {/* summary */}
        <section className="summary-grid" style={S.summary}>
          <SummaryCell label="Total Modal" value={fmtIDR(totals.modal)} />
          <SummaryCell label="Total Revenue" value={fmtIDR(totals.rev)} />
          <SummaryCell label="Net Profit" value={fmtIDR(totals.profit)} big tone={totals.profit >= 0 ? "good" : "bad"} />
          <SummaryCell label="ROI Total" value={fmtPct(totals.roi)} tone={totals.roi >= 0 ? "good" : "bad"} />
        </section>

        {bestWorst && cycles.length > 1 && (
          <div style={S.insights}>
            <span style={S.insight}>
              <TrendingUp size={13} style={{ color: "#4ec27e" }} /> Terbaik:{" "}
              <b style={{ color: "#cfd6df" }}>{bestWorst.best.name}</b> ({fmtIDR(bestWorst.best.p)})
            </span>
            <span style={S.insightDivider} />
            <span style={S.insight}>
              <TrendingDown size={13} style={{ color: "#e0686b" }} /> Terendah:{" "}
              <b style={{ color: "#cfd6df" }}>{bestWorst.worst.name}</b> ({fmtIDR(bestWorst.worst.p)})
            </span>
          </div>
        )}

        {/* cycles */}
        <div style={S.cycleList}>
          {cycles.map((cy) => {
            const c = calc(cy);
            const isOpen = open[cy.id];
            const pos = c.profitIDR >= 0;
            return (
              <article key={cy.id} style={{ ...S.card, borderLeft: `3px solid ${pos ? "#3f7d56" : "#8a3b3d"}` }}>
                <div style={S.cardHead} onClick={() => setOpen((p) => ({ ...p, [cy.id]: !p[cy.id] }))}>
                  <span style={S.chev}>{isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
                  <input
                    style={S.cycleName}
                    value={cy.name}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => patchCycle(cy.id, { name: e.target.value })}
                  />
                  <div style={S.headStats}>
                    <span style={S.headStat}>modal {fmtIDR(c.modalIDR)}</span>
                    <span style={{ ...S.headProfit, color: pos ? "#5ccb85" : "#e87a7d" }}>
                      {pos ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {fmtIDR(c.profitIDR)}
                    </span>
                  </div>
                  <button
                    style={S.delCycle}
                    onClick={(e) => { e.stopPropagation(); removeCycle(cy.id); }}
                    aria-label="hapus cycle"
                  >
                    <X size={16} />
                  </button>
                </div>

                {isOpen && (
                  <div style={S.cardBody}>
                    <div style={S.bodyRow}>
                      <span style={S.bodyLabel}>Kurs cycle ini</span>
                      <div style={S.inlineRate}>
                        <span style={S.rsignSm}>Rp</span>
                        <input
                          style={S.rateInputSm}
                          type="number"
                          value={cy.rate}
                          onChange={(e) => patchCycle(cy.id, { rate: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    {/* expenses */}
                    <div style={S.section}>
                      <div style={S.sectionTitle}>
                        <span>PENGELUARAN</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <button
                            style={S.kintaraBtn}
                            onClick={(e) => { e.stopPropagation(); openKintara(cy.id); }}
                            title="Import pembelian dari Kintara.gg"
                          >
                            <ShoppingCart size={12} /> Import Kintara
                          </button>
                          <span style={S.sectionSum}>{fmtIDR(c.modalIDR)}</span>
                        </div>
                      </div>
                      {cy.expenses.length > 0 && (
                        <div style={S.expHeadRow}>
                          <span style={{ flex: 1 }}>Keterangan</span>
                          <span style={{ width: 120, textAlign: "right" }}>Jumlah</span>
                          <span style={{ width: 66, textAlign: "center" }}>Kurs</span>
                          <span style={{ width: 28 }} />
                        </div>
                      )}
                      {cy.expenses.length === 0 && (
                        <div style={S.empty}>Belum ada pengeluaran tercatat.</div>
                      )}
                      {cy.expenses.map((e) => (
                        <div key={e.id} style={S.expRow}>
                          <input
                            style={S.expLabel}
                            placeholder="mis. beli wood, coal, metal…"
                            value={e.label}
                            onChange={(ev) => patchExpense(cy.id, e.id, { label: ev.target.value })}
                          />
                          <input
                            style={S.expAmt}
                            type="number"
                            placeholder="0"
                            value={e.amount}
                            onChange={(ev) => patchExpense(cy.id, e.id, { amount: ev.target.value })}
                          />
                          <select
                            style={S.expCur}
                            value={e.currency}
                            onChange={(ev) => patchExpense(cy.id, e.id, { currency: ev.target.value })}
                          >
                            <option value={CUR.IDR}>IDR</option>
                            <option value={CUR.USD}>USD</option>
                          </select>
                          <button style={S.expDel} onClick={() => removeExpense(cy.id, e.id)} aria-label="hapus">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                      <button style={S.addExp} onClick={() => addExpense(cy.id)}>
                        <Plus size={15} /> Tambah pengeluaran
                      </button>
                    </div>

                    {/* revenue */}
                    <div style={S.section}>
                      <div style={S.sectionTitle}>
                        <span><Coins size={13} style={{ verticalAlign: -2, marginRight: 5, color: "#d4a64a" }} />PENJUALAN GOLD</span>
                        <span style={S.sectionSum}>{fmtIDR(c.revenueIDR)}</span>
                      </div>
                      <div className="gold-grid" style={S.goldGrid}>
                        <div style={S.field}>
                          <label style={S.fieldLabel}>Jumlah Gold</label>
                          <input
                            style={S.fieldInput}
                            type="number"
                            placeholder="0"
                            value={cy.goldQty}
                            onChange={(e) => patchCycle(cy.id, { goldQty: e.target.value })}
                          />
                        </div>
                        <div style={S.field}>
                          <label style={S.fieldLabel}>Harga / Gold (USD)</label>
                          <input
                            style={S.fieldInput}
                            type="number"
                            placeholder="0.00"
                            value={cy.goldPrice}
                            onChange={(e) => patchCycle(cy.id, { goldPrice: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    {/* result */}
                    <div className="result-grid" style={S.result}>
                      <ResultCell label="Modal" value={fmtIDR(c.modalIDR)} />
                      <ResultCell label="Revenue" value={fmtIDR(c.revenueIDR)} />
                      <ResultCell label="Net Profit" value={fmtIDR(c.profitIDR)} strong tone={pos ? "good" : "bad"} />
                      <ResultCell label="ROI" value={fmtPct(c.roi)} tone={pos ? "good" : "bad"} />
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <button style={S.addCycle} onClick={addCycle}>
          <Plus size={18} /> Tambah Cycle
        </button>

        <footer style={S.footer}>
          Data tersimpan otomatis di browser ini. Gunakan <b style={{ color: "#9aa4b0" }}>Backup</b> untuk menyimpan salinan, lalu <b style={{ color: "#9aa4b0" }}>Muat</b> untuk memulihkan di perangkat lain.
        </footer>
      </div>

      {/* ===== Kintara Import Modal ===== */}
      {kintaraModal && (
        <div style={S.overlay} onClick={closeKintara}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ShoppingCart size={18} color="#d4a64a" />
                <span style={S.modalTitle}>Import dari Kintara.gg</span>
              </div>
              <button style={S.modalClose} onClick={closeKintara}><X size={18} /></button>
            </div>

            <p style={S.modalHint}>
              Copy semua chat dari Marketplace di Kintara.gg, lalu paste di bawah ini.
            </p>

            <textarea
              style={S.modalTextarea}
              placeholder={"You bought 1 Tool Pickaxe L2 for $0.48 USD (41.29 $KINS).\nMarketplace\nYou bought 1 Tool Axe L2 for $0.49 USD..."}
              value={kintaraPaste}
              onChange={(e) => handleKintaraPaste(e.target.value)}
              rows={8}
            />

            {/* status */}
            {kintaraStatus === "empty" && (
              <div style={S.statusBad}>
                <AlertCircle size={14} /> Tidak ada transaksi yang dikenali. Pastikan format teks benar.
              </div>
            )}
            {kintaraStatus === "ok" && (
              <div style={S.statusOk}>
                <CheckCircle2 size={14} /> Ditemukan {kintaraPreview.length} transaksi · Total ${kintaraTotalUSD.toFixed(2)} USD
              </div>
            )}

            {/* preview list */}
            {kintaraPreview.length > 0 && (
              <div style={S.previewBox}>
                <div style={S.previewHead}>
                  <span>Item</span><span>Harga (USD)</span>
                </div>
                <div style={S.previewList}>
                  {kintaraPreview.map((e) => (
                    <div key={e.id} style={S.previewRow}>
                      <span style={S.previewLabel}>{e.label}</span>
                      <span style={S.previewAmt}>${Number(e.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div style={S.previewTotal}>
                  <span>Total</span>
                  <span style={{ color: "#d4a64a", fontWeight: 700 }}>${kintaraTotalUSD.toFixed(2)} USD</span>
                </div>
              </div>
            )}

            <div style={S.modalActions}>
              <button style={S.cancelBtn} onClick={closeKintara}>Batal</button>
              <button
                style={{ ...S.confirmBtn, opacity: kintaraPreview.length ? 1 : 0.4, cursor: kintaraPreview.length ? "pointer" : "not-allowed" }}
                onClick={confirmKintara}
                disabled={!kintaraPreview.length}
              >
                <Plus size={15} /> Tambahkan {kintaraPreview.length > 0 ? `${kintaraPreview.length} item` : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCell({ label, value, tone, big }) {
  const color = tone === "good" ? "#5ccb85" : tone === "bad" ? "#e87a7d" : "#e6ebf1";
  return (
    <div style={S.sumCell}>
      <div style={S.sumLabel}>{label}</div>
      <div style={{ ...S.sumValue, color, fontSize: big ? 25 : 18 }}>{value}</div>
    </div>
  );
}
function ResultCell({ label, value, strong, tone }) {
  const color = tone === "good" ? "#5ccb85" : tone === "bad" ? "#e87a7d" : "#c4ccd6";
  return (
    <div style={S.resCell}>
      <div style={S.resLabel}>{label}</div>
      <div style={{ ...S.resValue, color, fontWeight: strong ? 700 : 500 }}>{value}</div>
    </div>
  );
}

const mono = "'JetBrains Mono', monospace";
const sans = "'Space Grotesk', sans-serif";
const ACCENT = "#d4a64a";

const S = {
  page: { minHeight: "100vh", position: "relative", overflow: "hidden", background: "#0e1116", color: "#e6ebf1", padding: "32px 16px 72px" },
  glow: { position: "absolute", top: -160, left: "50%", transform: "translateX(-50%)", width: 720, height: 320, background: "radial-gradient(ellipse, rgba(212,166,74,0.13), transparent 70%)", pointerEvents: "none" },
  wrap: { maxWidth: 880, margin: "0 auto", position: "relative" },

  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 26 },
  brand: { display: "flex", alignItems: "center", gap: 13 },
  logo: { width: 42, height: 42, borderRadius: 11, background: "linear-gradient(145deg, #2a2418, #1a1d24)", border: "1px solid #3a3526", display: "flex", alignItems: "center", justifyContent: "center", color: ACCENT, boxShadow: "0 0 20px rgba(212,166,74,0.15)" },
  kicker: { fontSize: 10, letterSpacing: "0.3em", color: "#7d8694", fontWeight: 600, fontFamily: mono },
  h1: { fontFamily: sans, fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", color: "#f2f5f9", lineHeight: 1.1 },

  toolbar: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  ghostBtn: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, color: "#9aa4b0", background: "#161b22", border: "1px solid #232a34", padding: "8px 12px", borderRadius: 9, cursor: "pointer", fontFamily: sans },
  rateBox: { display: "flex", alignItems: "center", gap: 8, background: "#161b22", border: "1px solid #232a34", borderRadius: 9, padding: "5px 10px 5px 12px" },
  rateLabel: { fontSize: 10, color: "#7d8694", fontWeight: 600, fontFamily: mono, letterSpacing: "0.05em" },
  rateInputWrap: { display: "flex", alignItems: "center" },
  rsign: { fontSize: 12, color: "#6b7480", marginRight: 1, fontFamily: mono },
  rsignSm: { fontSize: 11, color: "#6b7480", marginRight: 1, fontFamily: mono },
  rateInput: { border: "none", background: "transparent", width: 78, fontSize: 14, fontWeight: 700, textAlign: "right", color: ACCENT, fontFamily: mono },

  summary: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "#1d242e", border: "1px solid #1d242e", borderRadius: 14, overflow: "hidden", marginBottom: 14 },
  sumCell: { background: "#13181f", padding: "16px 18px" },
  sumLabel: { fontSize: 10, color: "#7d8694", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7, fontFamily: mono },
  sumValue: { fontFamily: mono, fontWeight: 700, letterSpacing: "-0.01em" },

  insights: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "10px 16px", background: "#11161d", border: "1px solid #1d242e", borderRadius: 10, marginBottom: 22, fontSize: 12.5, color: "#8993a0", fontFamily: mono },
  insight: { display: "inline-flex", alignItems: "center", gap: 6 },
  insightDivider: { width: 1, height: 14, background: "#283039" },

  cycleList: { display: "flex", flexDirection: "column", gap: 12 },
  card: { background: "#13181f", border: "1px solid #212834", borderRadius: 13, overflow: "hidden" },
  cardHead: { display: "flex", alignItems: "center", gap: 10, padding: "13px 14px", cursor: "pointer" },
  chev: { color: "#6b7480", display: "flex" },
  cycleName: { border: "none", background: "transparent", fontFamily: sans, fontSize: 17, fontWeight: 600, color: "#eef2f6", width: 130, padding: "2px 4px", borderRadius: 6 },
  headStats: { marginLeft: "auto", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" },
  headStat: { fontSize: 12.5, color: "#7d8694", fontFamily: mono },
  headProfit: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 14, fontWeight: 700, fontFamily: mono },
  delCycle: { border: "none", background: "transparent", color: "#5a4a4a", cursor: "pointer", display: "flex", padding: 4, borderRadius: 6 },

  cardBody: { padding: "2px 16px 18px", borderTop: "1px solid #1c232d" },
  bodyRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0 2px" },
  bodyLabel: { fontSize: 11.5, color: "#7d8694", fontWeight: 500, fontFamily: mono },
  inlineRate: { display: "flex", alignItems: "center", background: "#0f141a", border: "1px solid #232a34", borderRadius: 7, padding: "4px 8px" },
  rateInputSm: { border: "none", background: "transparent", width: 76, fontSize: 12.5, fontWeight: 600, textAlign: "right", color: "#c4ccd6", fontFamily: mono },

  section: { marginTop: 15 },
  sectionTitle: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, fontWeight: 700, color: "#9aa4b0", letterSpacing: "0.12em", marginBottom: 9, paddingBottom: 7, borderBottom: "1px solid #1c232d", fontFamily: mono },
  sectionSum: { fontFamily: mono, fontWeight: 700, color: ACCENT, letterSpacing: 0 },

  kintaraBtn: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 600, color: "#d4a64a", background: "rgba(212,166,74,0.08)", border: "1px solid rgba(212,166,74,0.25)", padding: "4px 9px", borderRadius: 6, cursor: "pointer", fontFamily: mono, letterSpacing: "0.04em" },

  expHeadRow: { display: "flex", gap: 8, fontSize: 9.5, color: "#5d6672", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 0 5px", fontFamily: mono },
  expRow: { display: "flex", gap: 8, alignItems: "center", marginBottom: 6 },
  expLabel: { flex: 1, border: "1px solid #232a34", borderRadius: 7, padding: "8px 10px", fontSize: 13, background: "#0f141a", color: "#e6ebf1", fontFamily: sans, minWidth: 0 },
  expAmt: { width: 120, border: "1px solid #232a34", borderRadius: 7, padding: "8px 10px", fontSize: 13, textAlign: "right", background: "#0f141a", color: "#e6ebf1", fontFamily: mono },
  expCur: { width: 66, border: "1px solid #232a34", borderRadius: 7, padding: "8px 4px", fontSize: 12, background: "#0f141a", color: "#c4ccd6", cursor: "pointer", fontFamily: mono },
  expDel: { width: 28, border: "none", background: "transparent", color: "#5a6470", cursor: "pointer", display: "flex", justifyContent: "center", padding: 4 },
  empty: { fontSize: 12, color: "#5d6672", fontStyle: "italic", padding: "4px 0 8px" },
  addExp: { display: "inline-flex", alignItems: "center", gap: 5, marginTop: 5, border: "1px dashed #3a4350", background: "transparent", color: "#8993a0", fontSize: 12.5, fontWeight: 500, padding: "8px 13px", borderRadius: 8, cursor: "pointer", fontFamily: sans },

  goldGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  fieldLabel: { fontSize: 11, color: "#7d8694", fontWeight: 500, fontFamily: mono },
  fieldInput: { border: "1px solid #232a34", borderRadius: 7, padding: "9px 11px", fontSize: 14, background: "#0f141a", color: "#e6ebf1", fontFamily: mono },

  result: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, marginTop: 16, background: "#1d242e", border: "1px solid #1d242e", borderRadius: 10, overflow: "hidden" },
  resCell: { background: "#0f141a", padding: "11px 13px" },
  resLabel: { fontSize: 9.5, color: "#6b7480", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4, fontFamily: mono },
  resValue: { fontSize: 14.5, fontFamily: mono },

  addCycle: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", marginTop: 16, padding: "14px", border: `1px solid ${ACCENT}`, background: "linear-gradient(180deg, rgba(212,166,74,0.16), rgba(212,166,74,0.06))", color: ACCENT, fontSize: 15, fontWeight: 600, borderRadius: 12, cursor: "pointer", fontFamily: sans, letterSpacing: "0.01em" },
  footer: { marginTop: 26, fontSize: 11.5, color: "#5d6672", textAlign: "center", lineHeight: 1.7, fontFamily: sans },

  /* modal */
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 },
  modal: { background: "#13181f", border: "1px solid #2a3341", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 },
  modalHead: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontFamily: sans, fontSize: 17, fontWeight: 700, color: "#eef2f6" },
  modalClose: { border: "none", background: "transparent", color: "#6b7480", cursor: "pointer", display: "flex", padding: 4, borderRadius: 6 },
  modalHint: { fontSize: 12.5, color: "#8993a0", fontFamily: sans, lineHeight: 1.6, margin: 0 },
  modalTextarea: { width: "100%", background: "#0c1015", border: "1px solid #232a34", borderRadius: 10, padding: "12px 14px", fontSize: 12.5, color: "#c4ccd6", fontFamily: mono, resize: "vertical", lineHeight: 1.7, boxSizing: "border-box" },
  statusOk: { display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#5ccb85", fontFamily: mono, background: "rgba(92,203,133,0.07)", border: "1px solid rgba(92,203,133,0.2)", borderRadius: 8, padding: "9px 12px" },
  statusBad: { display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#e87a7d", fontFamily: mono, background: "rgba(232,122,125,0.07)", border: "1px solid rgba(232,122,125,0.2)", borderRadius: 8, padding: "9px 12px" },
  previewBox: { background: "#0c1015", border: "1px solid #1d242e", borderRadius: 10, overflow: "hidden" },
  previewHead: { display: "flex", justifyContent: "space-between", padding: "8px 12px", fontSize: 9.5, color: "#5d6672", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: mono, borderBottom: "1px solid #1a212b" },
  previewList: { maxHeight: 200, overflowY: "auto" },
  previewRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 12px", borderBottom: "1px solid #131920" },
  previewLabel: { fontSize: 12.5, color: "#c4ccd6", fontFamily: sans },
  previewAmt: { fontSize: 12.5, color: "#d4a64a", fontFamily: mono, fontWeight: 600 },
  previewTotal: { display: "flex", justifyContent: "space-between", padding: "10px 12px", fontSize: 13, fontFamily: mono, fontWeight: 600, color: "#9aa4b0", borderTop: "1px solid #1d242e" },
  modalActions: { display: "flex", gap: 10, justifyContent: "flex-end" },
  cancelBtn: { border: "1px solid #2a3341", background: "transparent", color: "#8993a0", fontSize: 13.5, fontWeight: 500, padding: "10px 18px", borderRadius: 9, cursor: "pointer", fontFamily: sans },
  confirmBtn: { display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "linear-gradient(135deg, #c49030, #a07228)", color: "#fff", fontSize: 13.5, fontWeight: 600, padding: "10px 20px", borderRadius: 9, fontFamily: sans },
};
