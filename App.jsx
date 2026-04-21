import { useState, useEffect, useRef } from "react";

const CATEGORIES = [
  { id: "alquiler", label: "Alquiler / Expensas", icon: "🏠", color: "#818cf8" },
  { id: "salud", label: "Salud", icon: "🏥", color: "#4ade80" },
  { id: "supermercado", label: "Supermercado", icon: "🛒", color: "#60a5fa" },
  { id: "servicios", label: "Servicios", icon: "⚡", color: "#a78bfa" },
  { id: "salidas", label: "Salidas / Ocio", icon: "🎉", color: "#f472b6" },
  { id: "transporte", label: "Transporte", icon: "🚌", color: "#fb923c" },
  { id: "ropa", label: "Ropa", icon: "👗", color: "#34d399" },
  { id: "entrenamiento", label: "Entrenamiento", icon: "💪", color: "#f43f5e" },
  { id: "otros", label: "Otros", icon: "📦", color: "#94a3b8" },
];

const DEFAULT_BUDGETS = {
  alquiler: 390000,  // $315k alquiler + $75k expensas
  salud: 160000,      // psiquiatra $65k/mes + psicóloga $80k/mes + margen
  supermercado: 180000,
  servicios: 90000, // luz, gas, internet, celular
  salidas: 90000,
  transporte: 55000,
  ropa: 55000,
  entrenamiento: 60000, // entrenadora personal
  otros: 40000,
  // ahorro proyectado: ~$125.000
};

const CURRENCY_RATE = 1200; // ARS per USD approx
const MONTHLY_INCOME = 1500000;
const SAVINGS_TARGET = 125000; // ~8% ahorro mensual

function formatARS(n) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}
function formatUSD(n) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

async function analyzeReceiptWithClaude(imageBase64, mediaType) {
  const prompt = `Sos un asistente financiero. Analizá este comprobante/ticket/resumen y extraé:
1. Monto total (número solamente, sin símbolo)
2. Moneda (ARS o USD)
3. Comercio o descripción del gasto
4. Fecha (si está visible, formato DD/MM/YYYY, sino null)
5. Categoría más apropiada de esta lista: salud, supermercado, salidas, transporte, servicios, ropa, otros
6. Confianza en la clasificación: alta, media, baja

Respondé SOLO con JSON válido, sin markdown, sin explicación extra:
{"monto": 0, "moneda": "ARS", "comercio": "nombre", "fecha": null, "categoria": "otros", "confianza": "alta", "descripcion_breve": "texto corto"}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(typeof import.meta !== 'undefined' && import.meta.env?.VITE_ANTHROPIC_API_KEY
        ? {
            "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true"
          }
        : {}),
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: prompt }
        ]
      }]
    })
  });
  const data = await response.json();
  const text = data.content?.find(b => b.type === "text")?.text || "{}";
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

function BudgetBar({ category, spent, budget, compact = false }) {
  const pct = Math.min((spent / budget) * 100, 100);
  const color = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : category.color;
  const statusIcon = pct >= 90 ? "🔴" : pct >= 70 ? "🟡" : "🟢";

  return (
    <div style={{ marginBottom: compact ? 8 : 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: compact ? 12 : 14, color: "#e2e8f0" }}>
          {category.icon} {category.label} {statusIcon}
        </span>
        <span style={{ fontSize: compact ? 11 : 13, color: "#94a3b8" }}>
          {formatARS(spent)} / {formatARS(budget)}
        </span>
      </div>
      <div style={{ height: compact ? 6 : 8, borderRadius: 99, background: "#1e293b", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 99,
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          transition: "width 0.6s cubic-bezier(.4,0,.2,1)"
        }} />
      </div>
    </div>
  );
}

function AlertBox({ expenses, budgets }) {
  const alerts = CATEGORIES.map(cat => {
    const spent = expenses.filter(e => e.categoria === cat.id).reduce((s, e) => s + (e.moneda === "USD" ? e.monto * CURRENCY_RATE : e.monto), 0);
    const budget = budgets[cat.id] || 0;
    const pct = budget > 0 ? (spent / budget) * 100 : 0;
    return { cat, spent, budget, pct };
  }).filter(a => a.pct >= 70).sort((a, b) => b.pct - a.pct);

  if (alerts.length === 0) return (
    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 16, marginBottom: 20 }}>
      <p style={{ color: "#4ade80", margin: 0, fontSize: 14 }}>✅ Todo en orden. Vas bien con el presupuesto este mes.</p>
    </div>
  );

  return (
    <div style={{ background: "#0f172a", border: "1px solid #ef4444", borderRadius: 12, padding: 16, marginBottom: 20 }}>
      {alerts.map(({ cat, spent, budget, pct }) => {
        const daysInMonth = 30;
        const today = new Date().getDate();
        const projectedEnd = today > 0 ? (spent / today) * daysInMonth : spent;
        const overBudget = projectedEnd > budget;
        return (
          <div key={cat.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #1e293b" }}>
            <p style={{ margin: "0 0 4px", color: pct >= 90 ? "#ef4444" : "#f59e0b", fontWeight: 700, fontSize: 14 }}>
              {pct >= 90 ? "🔴" : "🟡"} {cat.icon} {cat.label}: {Math.round(pct)}% usado
            </p>
            <p style={{ margin: "0 0 4px", color: "#94a3b8", fontSize: 13 }}>
              Gastaste {formatARS(spent)} de {formatARS(budget)}.
              {overBudget && ` A este ritmo, te pasás ${formatARS(projectedEnd - budget)} a fin de mes.`}
            </p>
            {overBudget && (
              <p style={{ margin: 0, color: "#60a5fa", fontSize: 12 }}>
                💡 Intentá gastar máx. {formatARS((budget - spent) / Math.max(daysInMonth - today, 1))} por día en {cat.label.toLowerCase()} hasta fin de mes.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

const FIXED_EXPENSES = [
  { id: "alquiler", label: "Alquiler", monto: 315000, categoria: "alquiler", icon: "🏠" },
  { id: "expensas", label: "Expensas", monto: 75000, categoria: "alquiler", icon: "🏢" },
  { id: "psiquiatra", label: "Psiquiatra", monto: 65000, categoria: "salud", icon: "🧠" },
  { id: "psicologa", label: "Psicóloga (×4)", monto: 80000, categoria: "salud", icon: "💬" },
  { id: "entrenadora", label: "Entrenadora", monto: 60000, categoria: "salud", icon: "💪" },
];

export default function BudgetDashboard() {
  const [expenses, setExpenses] = useState([]);
  const [budgets, setBudgets] = useState(DEFAULT_BUDGETS);
  const [view, setView] = useState("dashboard");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [budgetInput, setBudgetInput] = useState({});
  const [checkedFixed, setCheckedFixed] = useState({});
  const [monthlyIncome, setMonthlyIncome] = useState(MONTHLY_INCOME);
  const [showIncomePopup, setShowIncomePopup] = useState(false);
  const [incomeInput, setIncomeInput] = useState("");
  const fileRef = useRef();

  // Load from storage
  useEffect(() => {
    (async () => {
      try {
        const e = await window.storage.get("budget_expenses");
        if (e) setExpenses(JSON.parse(e.value));
      } catch {}
      try {
        const b = await window.storage.get("budget_budgets");
        if (b) setBudgets(JSON.parse(b.value));
      } catch {}
      try {
        const c = await window.storage.get("budget_checked_fixed");
        if (c) setCheckedFixed(JSON.parse(c.value));
      } catch {}
      try {
        const inc = await window.storage.get("budget_income");
        if (inc) setMonthlyIncome(Number(inc.value));
      } catch {}
      // Show income popup if new month
      try {
        const lastMonth = await window.storage.get("budget_last_month");
        const now = new Date();
        const thisMonth = `${now.getFullYear()}-${now.getMonth()}`;
        if (!lastMonth || lastMonth.value !== thisMonth) {
          setShowIncomePopup(true);
          await window.storage.set("budget_last_month", thisMonth);
          // Reset checklist for new month
          setCheckedFixed({});
          await window.storage.set("budget_checked_fixed", "{}");
        }
      } catch {}
    })();
  }, []);

  const saveExpenses = async (data) => {
    setExpenses(data);
    try { await window.storage.set("budget_expenses", JSON.stringify(data)); } catch {}
  };
  const saveBudgets = async (data) => {
    setBudgets(data);
    try { await window.storage.set("budget_budgets", JSON.stringify(data)); } catch {}
  };
  const saveChecked = async (data) => {
    setCheckedFixed(data);
    try { await window.storage.set("budget_checked_fixed", JSON.stringify(data)); } catch {}
  };
  const saveIncome = async (val) => {
    setMonthlyIncome(val);
    try { await window.storage.set("budget_income", String(val)); } catch {}
  };
  const confirmIncome = () => {
    const val = Number(incomeInput.replace(/\D/g, ""));
    if (val > 0) saveIncome(val);
    setShowIncomePopup(false);
  };

  const now = new Date();
  const monthExpenses = expenses.filter(e => {
    const d = new Date(e.timestamp);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalSpentARS = monthExpenses.reduce((s, e) => s + (e.moneda === "USD" ? e.monto * CURRENCY_RATE : e.monto), 0);
  const totalBudgetARS = Object.values(budgets).reduce((s, v) => s + v, 0);
  const remaining = monthlyIncome - totalSpentARS;

  // Projection
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projectedTotal = dayOfMonth > 0 ? (totalSpentARS / dayOfMonth) * daysInMonth : totalSpentARS;
  const projectedStatus = projectedTotal <= totalBudgetARS ? "ok" : "over";

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setView("upload");
    const mediaType = file.type;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(",")[1];
      try {
        const result = await analyzeReceiptWithClaude(base64, mediaType);
        setPreview({ imageBase64: base64, mediaType, result, imageUrl: ev.target.result });
      } catch (err) {
        setPreview({ error: "No pude leer el comprobante. Intentá con otra imagen." });
      }
      setUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const confirmExpense = (edited) => {
    const newExp = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...preview.result,
      ...edited,
    };
    saveExpenses([newExp, ...expenses]);
    setPreview(null);
    setView("dashboard");
  };

  const deleteExpense = (id) => {
    saveExpenses(expenses.filter(e => e.id !== id));
  };

  const updateExpense = (id, changes) => {
    saveExpenses(expenses.map(e => e.id === id ? { ...e, ...changes } : e));
    setEditingExpense(null);
  };

  const styles = {
    app: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%)",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      color: "#e2e8f0",
      maxWidth: 480,
      margin: "0 auto",
      position: "relative",
    },
    header: {
      padding: "24px 20px 16px",
      borderBottom: "1px solid #1e293b",
    },
    title: {
      fontSize: 22,
      fontWeight: 800,
      letterSpacing: "-0.5px",
      margin: 0,
      background: "linear-gradient(90deg, #f1f5f9, #94a3b8)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
    },
    subtitle: { fontSize: 12, color: "#475569", margin: "4px 0 0", letterSpacing: "0.05em", textTransform: "uppercase" },
    nav: {
      display: "flex",
      background: "#0f172a",
      borderTop: "1px solid #1e293b",
      position: "sticky",
      bottom: 0,
    },
    navBtn: (active) => ({
      flex: 1,
      padding: "12px 4px",
      background: "none",
      border: "none",
      cursor: "pointer",
      fontSize: 10,
      color: active ? "#60a5fa" : "#475569",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 3,
      borderTop: active ? "2px solid #60a5fa" : "2px solid transparent",
      transition: "all 0.2s",
    }),
    section: { padding: "20px 20px 0" },
    card: {
      background: "#0f172a",
      border: "1px solid #1e293b",
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
    },
    bigNumber: {
      fontSize: 36,
      fontWeight: 800,
      letterSpacing: "-1px",
      lineHeight: 1,
    },
    btn: (variant = "primary") => ({
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "12px 20px",
      borderRadius: 12,
      border: "none",
      cursor: "pointer",
      fontWeight: 700,
      fontSize: 14,
      background: variant === "primary" ? "linear-gradient(135deg, #3b82f6, #1d4ed8)"
        : variant === "danger" ? "#ef444420"
        : variant === "ghost" ? "transparent"
        : "#1e293b",
      color: variant === "danger" ? "#ef4444" : variant === "ghost" ? "#94a3b8" : "#fff",
      border: variant === "ghost" ? "1px solid #1e293b" : "none",
      transition: "all 0.2s",
    }),
    input: {
      background: "#1e293b",
      border: "1px solid #334155",
      borderRadius: 8,
      padding: "8px 12px",
      color: "#e2e8f0",
      fontSize: 14,
      width: "100%",
      boxSizing: "border-box",
    },
    select: {
      background: "#1e293b",
      border: "1px solid #334155",
      borderRadius: 8,
      padding: "8px 12px",
      color: "#e2e8f0",
      fontSize: 14,
      width: "100%",
      boxSizing: "border-box",
    },
    label: { fontSize: 12, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" },
  };

  // ---- VIEWS ----

  const renderDashboard = () => (
    <div style={styles.section}>
      {/* Summary card */}
      <div style={{ ...styles.card, background: "linear-gradient(135deg, #0f172a, #1e293b)", border: "1px solid #334155" }}>
        <p style={{ margin: "0 0 4px", fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Disponible este mes
        </p>
        <div style={{ ...styles.bigNumber, color: remaining >= 0 ? "#4ade80" : "#ef4444" }}>
          {formatARS(Math.abs(remaining))}
          {remaining < 0 && <span style={{ fontSize: 14, color: "#ef4444", marginLeft: 8 }}>EXCEDIDO</span>}
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#64748b" }}>
          ≈ {formatUSD(Math.abs(remaining) / CURRENCY_RATE)} USD · Gastaste {formatARS(totalSpentARS)} de {formatARS(totalBudgetARS)}
        </p>
        <div style={{ marginTop: 12, height: 6, borderRadius: 99, background: "#0f172a", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 99,
            width: `${Math.min((totalSpentARS / totalBudgetARS) * 100, 100)}%`,
            background: remaining >= 0 ? "linear-gradient(90deg, #4ade8099, #4ade80)" : "linear-gradient(90deg, #ef444499, #ef4444)",
          }} />
        </div>
      </div>

      {/* Projection */}
      <div style={{ ...styles.card, borderColor: projectedStatus === "over" ? "#ef444430" : "#1e293b" }}>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          📈 Proyección fin de mes
        </p>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: projectedStatus === "ok" ? "#4ade80" : "#ef4444" }}>
          {formatARS(projectedTotal)}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#475569" }}>
          {projectedStatus === "ok"
            ? `Vas a llegar con ${formatARS(totalBudgetARS - projectedTotal)} de sobra 🎉`
            : `Te excederías ${formatARS(projectedTotal - totalBudgetARS)} si seguís a este ritmo ⚠️`}
        </p>
      </div>

      {/* Savings card */}
      <div style={{ ...styles.card, borderColor: "#818cf830" }}>
        <p style={{ margin: "0 0 4px", fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          💰 Ahorro proyectado este mes
        </p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ ...styles.bigNumber, fontSize: 28, color: monthlyIncome - projectedTotal >= SAVINGS_TARGET ? "#4ade80" : "#f59e0b" }}>
            {formatARS(Math.max(monthlyIncome - projectedTotal, 0))}
          </span>
          <span style={{ fontSize: 12, color: "#475569" }}>meta: {formatARS(SAVINGS_TARGET)}</span>
        </div>
        <button style={{ ...styles.btn("ghost"), padding: "4px 10px", fontSize: 11, marginTop: 8 }}
          onClick={() => setShowIncomePopup(true)}>
          Ingreso este mes: {formatARS(monthlyIncome)} ✏️
        </button>
      </div>


      <AlertBox expenses={monthExpenses} budgets={budgets} />

      {/* Category bars */}
      <div style={styles.card}>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Por categoría</p>
        {CATEGORIES.map(cat => {
          const spent = monthExpenses.filter(e => e.categoria === cat.id).reduce((s, e) => s + (e.moneda === "USD" ? e.monto * CURRENCY_RATE : e.monto), 0);
          return <BudgetBar key={cat.id} category={cat} spent={spent} budget={budgets[cat.id] || 0} />;
        })}
      </div>

      {/* Upload CTA */}
      <div style={{ textAlign: "center", padding: "8px 0 24px" }}>
        <button style={{ ...styles.btn("primary"), fontSize: 16, padding: "16px 32px", borderRadius: 16 }}
          onClick={() => fileRef.current.click()}>
          📸 Registrar gasto con foto
        </button>
      </div>
    </div>
  );

  const renderUpload = () => {
    if (uploading) return (
      <div style={{ ...styles.section, textAlign: "center", paddingTop: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 16, animation: "spin 1s linear infinite" }}>🔍</div>
        <p style={{ color: "#60a5fa", fontWeight: 600 }}>Analizando comprobante...</p>
        <p style={{ color: "#475569", fontSize: 13 }}>Claude está leyendo tu imagen</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );

    if (!preview) return (
      <div style={{ ...styles.section, textAlign: "center", paddingTop: 40 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>📸</div>
        <p style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 18 }}>Subí tu comprobante</p>
        <p style={{ color: "#475569", fontSize: 14, marginBottom: 24 }}>Ticket, resumen, transferencia o factura</p>
        <button style={styles.btn("primary")} onClick={() => fileRef.current.click()}>
          Elegir imagen
        </button>
        <br /><br />
        <button style={styles.btn("ghost")} onClick={() => setView("dashboard")}>← Volver</button>
      </div>
    );

    if (preview.error) return (
      <div style={{ ...styles.section, textAlign: "center", paddingTop: 40 }}>
        <p style={{ color: "#ef4444" }}>❌ {preview.error}</p>
        <button style={styles.btn()} onClick={() => { setPreview(null); fileRef.current.click(); }}>Intentar de nuevo</button>
      </div>
    );

    return <ConfirmExpense preview={preview} onConfirm={confirmExpense} onCancel={() => { setPreview(null); setView("dashboard"); }} styles={styles} />;
  };

  const renderHistory = () => (
    <div style={styles.section}>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Gastos registrados ({monthExpenses.length} este mes)
      </p>
      {monthExpenses.length === 0 && (
        <div style={{ ...styles.card, textAlign: "center" }}>
          <p style={{ color: "#475569" }}>Todavía no hay gastos este mes.</p>
        </div>
      )}
      {monthExpenses.map(exp => {
        const cat = CATEGORIES.find(c => c.id === exp.categoria) || CATEGORIES[6];
        const isEditing = editingExpense === exp.id;
        return (
          <div key={exp.id} style={{ ...styles.card, borderLeft: `3px solid ${cat.color}` }}>
            {isEditing ? (
              <EditExpense exp={exp} onSave={(ch) => updateExpense(exp.id, ch)} onCancel={() => setEditingExpense(null)} styles={styles} />
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 15 }}>
                      {cat.icon} {exp.comercio || exp.descripcion_breve || "Gasto"}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                      {cat.label} · {exp.fecha || new Date(exp.timestamp).toLocaleDateString("es-AR")}
                    </p>
                  </div>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 18, color: cat.color }}>
                    {exp.moneda === "USD" ? formatUSD(exp.monto) : formatARS(exp.monto)}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button style={{ ...styles.btn("ghost"), padding: "6px 12px", fontSize: 12 }} onClick={() => setEditingExpense(exp.id)}>✏️ Editar</button>
                  <button style={{ ...styles.btn("danger"), padding: "6px 12px", fontSize: 12 }} onClick={() => deleteExpense(exp.id)}>🗑️</button>
                </div>
              </>
            )}
          </div>
        );
      })}
      <div style={{ height: 24 }} />
    </div>
  );

  const renderChecklist = () => {
    const totalFixed = FIXED_EXPENSES.reduce((s, f) => s + f.monto, 0);
    const paidTotal = FIXED_EXPENSES.filter(f => checkedFixed[f.id]).reduce((s, f) => s + f.monto, 0);
    const pendingTotal = totalFixed - paidTotal;
    return (
      <div style={styles.section}>
        <div style={{ ...styles.card, background: "linear-gradient(135deg, #0f172a, #1e293b)" }}>
          <p style={{ margin: "0 0 4px", fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Gastos fijos del mes
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800, color: "#e2e8f0" }}>{formatARS(paidTotal)}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#475569" }}>pagado de {formatARS(totalFixed)}</p>
            </div>
            {pendingTotal > 0 && (
              <p style={{ margin: 0, fontSize: 13, color: "#f59e0b" }}>⏳ {formatARS(pendingTotal)} pendiente</p>
            )}
          </div>
          <div style={{ marginTop: 10, height: 5, borderRadius: 99, background: "#0f172a", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 99, width: `${(paidTotal / totalFixed) * 100}%`, background: "linear-gradient(90deg, #4ade8099, #4ade80)", transition: "width 0.5s" }} />
          </div>
        </div>

        {FIXED_EXPENSES.map(f => {
          const paid = !!checkedFixed[f.id];
          return (
            <div key={f.id} style={{
              ...styles.card,
              display: "flex", alignItems: "center", gap: 14, padding: "16px 18px",
              borderColor: paid ? "#4ade8030" : "#1e293b",
              opacity: paid ? 0.75 : 1,
              transition: "all 0.2s",
            }}>
              <button
                onClick={() => saveChecked({ ...checkedFixed, [f.id]: !paid })}
                style={{
                  width: 28, height: 28, borderRadius: 8, border: `2px solid ${paid ? "#4ade80" : "#334155"}`,
                  background: paid ? "#4ade80" : "transparent", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, flexShrink: 0, transition: "all 0.2s",
                }}>
                {paid ? "✓" : ""}
              </button>
              <span style={{ fontSize: 22 }}>{f.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: paid ? "#64748b" : "#e2e8f0", textDecoration: paid ? "line-through" : "none" }}>
                  {f.label}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "#475569" }}>{CATEGORIES.find(c => c.id === f.categoria)?.label}</p>
              </div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: paid ? "#4ade80" : "#e2e8f0" }}>
                {formatARS(f.monto)}
              </p>
            </div>
          );
        })}
        <div style={{ height: 24 }} />
      </div>
    );
  };

  const renderSettings = () => (
    <div style={styles.section}>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Presupuestos mensuales por categoría
      </p>
      {CATEGORIES.map(cat => (
        <div key={cat.id} style={{ ...styles.card, padding: "14px 16px" }}>
          <label style={styles.label}>{cat.icon} {cat.label}</label>
          <input
            style={styles.input}
            type="number"
            defaultValue={budgets[cat.id] || 0}
            onChange={e => setBudgetInput(prev => ({ ...prev, [cat.id]: Number(e.target.value) }))}
          />
        </div>
      ))}
      <button style={{ ...styles.btn("primary"), width: "100%", justifyContent: "center", marginBottom: 24 }}
        onClick={() => saveBudgets({ ...budgets, ...budgetInput })}>
        💾 Guardar presupuestos
      </button>
    </div>
  );

  const IncomePopup = () => (
    <div style={{
      position: "fixed", inset: 0, background: "#000000cc", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360 }}>
        <p style={{ margin: "0 0 6px", fontSize: 22 }}>💸</p>
        <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: "#f1f5f9" }}>Nuevo mes, nueva plata</h2>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#64748b" }}>
          ¿Cuánto cobraste este mes?
        </p>
        <label style={styles.label}>Ingreso en ARS</label>
        <input
          style={{ ...styles.input, fontSize: 20, fontWeight: 700, marginBottom: 20 }}
          type="number"
          placeholder="1.500.000"
          value={incomeInput}
          onChange={e => setIncomeInput(e.target.value)}
          autoFocus
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ ...styles.btn("primary"), flex: 1, justifyContent: "center" }} onClick={confirmIncome}>
            Confirmar
          </button>
          <button style={{ ...styles.btn("ghost") }} onClick={() => setShowIncomePopup(false)}>
            Después
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={styles.app}>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
      {showIncomePopup && <IncomePopup />}

      <div style={styles.header}>
        <h1 style={styles.title}>Budget Dashboard</h1>
        <p style={styles.subtitle}>{now.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</p>
      </div>

      <div style={{ overflowY: "auto", paddingBottom: 70 }}>
        {view === "dashboard" && renderDashboard()}
        {view === "upload" && renderUpload()}
        {view === "checklist" && renderChecklist()}
        {view === "history" && renderHistory()}
        {view === "settings" && renderSettings()}
      </div>

      <nav style={styles.nav}>
        {[
          { id: "dashboard", icon: "📊", label: "Inicio" },
          { id: "upload", icon: "📸", label: "Registrar" },
          { id: "checklist", icon: "✅", label: "Fijos" },
          { id: "history", icon: "📋", label: "Historial" },
          { id: "settings", icon: "⚙️", label: "Config" },
        ].map(({ id, icon, label }) => (
          <button key={id} style={styles.navBtn(view === id)}
            onClick={() => { if (id === "upload") { setPreview(null); fileRef.current.click(); } else setView(id); }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function ConfirmExpense({ preview, onConfirm, onCancel, styles }) {
  const { result, imageUrl } = preview;
  const [form, setForm] = useState({
    monto: result.monto || 0,
    moneda: result.moneda || "ARS",
    comercio: result.comercio || "",
    fecha: result.fecha || new Date().toLocaleDateString("es-AR"),
    categoria: result.categoria || "otros",
    descripcion_breve: result.descripcion_breve || "",
  });

  return (
    <div style={{ padding: 20 }}>
      <p style={{ margin: "0 0 16px", fontWeight: 700, fontSize: 16 }}>✅ Comprobante detectado</p>
      {imageUrl && <img src={imageUrl} style={{ width: "100%", borderRadius: 12, marginBottom: 16, maxHeight: 200, objectFit: "cover" }} alt="comprobante" />}

      <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <p style={{ margin: "0 0 4px", fontSize: 12, color: "#64748b" }}>Confianza de clasificación: <strong style={{ color: result.confianza === "alta" ? "#4ade80" : "#f59e0b" }}>{result.confianza}</strong></p>
      </div>

      {[
        { label: "Comercio / descripción", key: "comercio", type: "text" },
        { label: "Fecha", key: "fecha", type: "text" },
      ].map(({ label, key, type }) => (
        <div key={key} style={{ marginBottom: 12 }}>
          <label style={styles.label}>{label}</label>
          <input style={styles.input} type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
        </div>
      ))}

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 2 }}>
          <label style={styles.label}>Monto</label>
          <input style={styles.input} type="number" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: Number(e.target.value) }))} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={styles.label}>Moneda</label>
          <select style={styles.select} value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={styles.label}>Categoría</label>
        <select style={styles.select} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button style={{ ...styles.btn("primary"), flex: 1, justifyContent: "center" }} onClick={() => onConfirm(form)}>
          💾 Confirmar gasto
        </button>
        <button style={{ ...styles.btn("ghost"), flex: 0 }} onClick={onCancel}>✕</button>
      </div>
    </div>
  );
}

function EditExpense({ exp, onSave, onCancel, styles }) {
  const [form, setForm] = useState({ monto: exp.monto, moneda: exp.moneda, comercio: exp.comercio, categoria: exp.categoria });
  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 2 }}>
          <label style={styles.label}>Monto</label>
          <input style={styles.input} type="number" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: Number(e.target.value) }))} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={styles.label}>Moneda</label>
          <select style={styles.select} value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={styles.label}>Comercio</label>
        <input style={styles.input} value={form.comercio} onChange={e => setForm(f => ({ ...f, comercio: e.target.value }))} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={styles.label}>Categoría</label>
        <select style={styles.select} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={{ ...styles.btn("primary"), padding: "8px 16px", fontSize: 13 }} onClick={() => onSave(form)}>Guardar</button>
        <button style={{ ...styles.btn("ghost"), padding: "8px 16px", fontSize: 13 }} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}
