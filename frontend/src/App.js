import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Sun, Moon, Search, Send, Upload, FileText, BookOpen, X, Sparkles, Loader2, AlertCircle, ChevronRight, Menu } from "lucide-react";
import "@/App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/* ---------------- Theme hook ---------------- */
function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("finance-theme");
    if (saved) return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("finance-theme", theme);
  }, [theme]);
  return [theme, setTheme];
}

/* ---------------- Confidence badge ---------------- */
function ConfidenceBadge({ level }) {
  const map = {
    high:   { dot: "bg-emerald-600 dark:bg-emerald-400", label: "High confidence" },
    medium: { dot: "bg-amber-500", label: "Medium confidence" },
    low:    { dot: "bg-red-500", label: "Low confidence" },
  };
  const m = map[level] || map.medium;
  return (
    <span data-testid="confidence-badge" className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
      <span className={`w-2 h-2 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

/* ---------------- Render answer with citations ---------------- */
function AnswerText({ text, citations, onCite }) {
  // split on [1] or [1,2,3]
  const parts = [];
  const re = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
  let lastIdx = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    parts.push({ type: "text", value: text.slice(lastIdx, m.index) });
    const nums = m[1].split(",").map((s) => parseInt(s.trim(), 10)).filter(Boolean);
    parts.push({ type: "cite", nums });
    lastIdx = m.index + m[0].length;
  }
  parts.push({ type: "text", value: text.slice(lastIdx) });

  return (
    <div className="leading-relaxed text-[15px]" style={{ color: "hsl(var(--foreground))" }}>
      {parts.map((p, i) => {
        if (p.type === "text") {
          return p.value.split("\n").map((line, j, arr) => (
            <React.Fragment key={`${i}-${j}`}>
              {line}
              {j < arr.length - 1 && <br />}
            </React.Fragment>
          ));
        }
        return (
          <span key={`c-${i}`}>
            {p.nums.map((n) => {
              const c = citations?.find((x) => x.n === n);
              return (
                <button
                  key={n}
                  data-testid="citation-chip"
                  className="citation-chip"
                  title={c ? `${c.form} · ${c.section} · ${c.period}` : `Source ${n}`}
                  onClick={() => c && onCite(c)}
                >
                  {n}
                </button>
              );
            })}
          </span>
        );
      })}
    </div>
  );
}

/* ---------------- Source drawer ---------------- */
function SourceDrawer({ source, onClose }) {
  if (!source) return null;
  return (
    <aside
      data-testid="source-drawer"
      className="fixed top-0 right-0 h-full w-full md:w-[440px] lg:w-[520px] z-40 fadein"
      style={{ background: "hsl(var(--surface))", borderLeft: "1px solid hsl(var(--border))", boxShadow: "-12px 0 32px -16px rgba(0,0,0,0.25)" }}
    >
      <header className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "hsl(var(--border))" }}>
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>Source [{source.n}]</div>
          <h3 className="font-serif text-xl mt-1" style={{ letterSpacing: "-0.01em" }}>{source.section}</h3>
        </div>
        <button data-testid="source-drawer-close" className="btn btn-ghost" onClick={onClose}><X size={16}/></button>
      </header>
      <div className="px-6 py-5 space-y-4 overflow-y-auto" style={{ height: "calc(100% - 84px)" }}>
        <div className="flex flex-wrap gap-2 text-xs font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>
          <span className="px-2 py-0.5 rounded" style={{ background: "hsl(var(--surface-muted))" }}>{source.form}</span>
          <span className="px-2 py-0.5 rounded" style={{ background: "hsl(var(--surface-muted))" }}>{source.period}</span>
        </div>
        <div
          className="text-[15px] leading-relaxed font-serif"
          style={{ background: "hsl(var(--citation-bg) / 0.5)", padding: "1.25rem 1.5rem", borderRadius: "0.5rem", borderLeft: "3px solid hsl(var(--accent))" }}
        >
          {source.snippet}
        </div>
        <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>Excerpt from the indexed filing. The full document is referenced in the chunk index.</p>
      </div>
    </aside>
  );
}

/* ---------------- Company picker ---------------- */
function CompanySidebar({ companies, value, onChange }) {
  const filteredCompanies = companies.filter((company) => {
    const query = company?.name?.toLowerCase() || "";
    const ticker = company?.ticker?.toLowerCase() || "";
    const search = value.search || "";
    return query.includes(search) || ticker.includes(search);
  });

  return (
    <nav className="space-y-4 px-4" aria-label="Company navigation">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>Company Library</div>
        <div className="mb-4">
          <input
            value={value.search ?? ""}
            onChange={(e) => value.setSearch(e.target.value)}
            placeholder="Search companies"
            className="w-full rounded-xl border border-input px-3 py-2 text-sm bg-transparent text-[15px] placeholder:text-muted-foreground"
          />
        </div>
        <div className="space-y-2 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          {filteredCompanies.map((company) => {
            const active = value.ticker === company.ticker;
            return (
              <button
                key={company.ticker}
                onClick={() => onChange(company.ticker)}
                className={`w-full text-left px-4 py-3 transition-colors ${active ? "bg-surface-muted" : "hover:bg-surface-muted/70"}`}
                style={{ borderLeft: active ? "3px solid hsl(var(--accent))" : "3px solid transparent" }}
                data-testid={`company-${company.ticker}`}
                aria-current={active ? "page" : undefined}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: active ? "hsl(var(--accent))" : "hsl(var(--muted-foreground))" }}>{company.ticker}</p>
                    <p className="text-sm" style={{ color: "hsl(var(--foreground))" }}>{company.name.replace(/, Inc\.| Inc\.| Corporation/g, "")}</p>
                  </div>
                  <span className="text-[10px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>{company.filings_count}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/* ---------------- Main App ---------------- */
function App() {
  const [theme, setTheme] = useTheme();
  const [companies, setCompanies] = useState([]);
  const [ticker, setTicker] = useState(null);
  const [companySearch, setCompanySearch] = useState("");
  const [sessionDoc, setSessionDoc] = useState(null); // {session_id, label, chunks}
  const [useSession, setUseSession] = useState(false);
  const [examples, setExamples] = useState([]);
  const [filings, setFilings] = useState([]);
  const [messages, setMessages] = useState([]); // {role, content, citations, confidence, ts}
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [openSource, setOpenSource] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isCompanyDrawerOpen, setIsCompanyDrawerOpen] = useState(false);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);

  /* Initial load */
  useEffect(() => {
    axios.get(`${API}/companies`).then((r) => {
      setCompanies(r.data);
      if (r.data.length) setTicker(r.data[0].ticker);
    }).catch(() => setErrorMsg("Could not load companies"));
  }, []);

  /* Load examples + filings on ticker change */
  useEffect(() => {
    if (!ticker || useSession) return;
    axios.get(`${API}/example-questions/${ticker}`).then((r) => setExamples(r.data)).catch(() => {});
    axios.get(`${API}/companies/${ticker}/filings`).then((r) => setFilings(r.data)).catch(() => {});
    setMessages([]);
  }, [ticker, useSession]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  /* Submit query */
  async function ask(q) {
    const question = (q ?? input).trim();
    if (!question || streaming) return;
    setInput("");
    setErrorMsg("");
    const userMsg = { role: "user", content: question, ts: Date.now() };
    const aiMsg = { role: "assistant", content: "", citations: [], confidence: null, ts: Date.now() + 1 };
    setMessages((m) => [...m, userMsg, aiMsg]);
    setStreaming(true);

    const payload = useSession && sessionDoc
      ? { question, session_id: sessionDoc.session_id }
      : { question, ticker };

    try {
      const res = await fetch(`${API}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body: JSON.stringify(payload),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payloadStr = line.slice(6);
          if (!payloadStr) continue;
          let evt;
          try { evt = JSON.parse(payloadStr); } catch { continue; }
          if (evt.type === "meta") {
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1] = { ...copy[copy.length - 1], citations: evt.citations, confidence: evt.confidence };
              return copy;
            });
          } else if (evt.type === "delta") {
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1] = { ...copy[copy.length - 1], content: copy[copy.length - 1].content + evt.content };
              return copy;
            });
          } else if (evt.type === "error") {
            setErrorMsg(evt.message || "Error");
          }
        }
      }
    } catch (e) {
      setErrorMsg(e.message || "Request failed");
    } finally {
      setStreaming(false);
    }
  }

  /* Upload PDF */
  async function onUpload(file) {
    if (!file) return;
    setUploadBusy(true);
    setErrorMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("label", file.name.replace(/\.pdf$/i, ""));
      const res = await axios.post(`${API}/upload`, fd);
      setSessionDoc(res.data);
      setUseSession(true);
      setMessages([]);
      setExamples([
        "Summarize the key financial highlights in this document.",
        "What are the main risk factors discussed?",
        "What growth drivers does management emphasize?",
        "Are there any notable changes versus the prior period?",
      ]);
      setFilings([{ form: "Uploaded", period: res.data.label, sections: res.data.pages ? [`${res.data.pages} pages, ${res.data.chunks} chunks`] : [] }]);
    } catch (e) {
      setErrorMsg(e.response?.data?.detail || e.message);
    } finally {
      setUploadBusy(false);
    }
  }

  const activeCompany = useMemo(() => companies.find((c) => c.ticker === ticker), [companies, ticker]);
  const showWelcome = messages.length === 0;

  return (
    <div className="paper-grain" style={{ minHeight: "100vh" }}>
      {/* HEADER */}
      <header className="relative z-10 border-b" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--background) / 0.85)", backdropFilter: "blur(8px)", position: "sticky", top: 0 }}>
        <div className="max-w-[1600px] mx-auto px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 flex items-center justify-center font-serif text-xl font-semibold" style={{ background: "hsl(var(--accent))", color: "hsl(var(--surface))", borderRadius: "6px" }}>F</div>
              <div>
                <div className="font-serif text-[17px] leading-none tracking-tight" data-testid="brand-title">Filings &amp; Findings</div>
                <div className="text-[10px] font-mono uppercase tracking-[0.22em] mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>Financial Research Intelligence</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden md:inline text-xs font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>
                Data-driven insights from SEC filings.
              </span>
              <button data-testid="theme-toggle" className="btn btn-ghost" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}> 
                {theme === "dark" ? <Sun size={16}/> : <Moon size={16}/> }
              </button>
            </div>
          </div>
          <div className="mt-3 lg:hidden">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-sm font-medium text-[13px]"
              style={{ borderColor: "hsl(var(--border))" }}
              onClick={() => setIsCompanyDrawerOpen(true)}
            >
              <Menu size={16} />
              Companies
            </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <div className="max-w-[1600px] mx-auto px-2 lg:px-6 grid grid-cols-12 gap-0 lg:gap-6" style={{ minHeight: "calc(100vh - 64px)" }}>
        {isCompanyDrawerOpen && (
          <div className="fixed left-0 top-0 bottom-0 z-40 w-[calc(100%-1rem)] max-w-sm lg:hidden shadow-2xl border-r border-border overflow-y-auto" style={{ background: "hsl(var(--surface) / 1)", borderColor: "hsl(var(--border))" }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "hsl(var(--border))" }}>
              <div className="text-base font-semibold">Companies</div>
              <button type="button" className="btn btn-ghost" onClick={() => setIsCompanyDrawerOpen(false)}><X size={18} /></button>
            </div>
            <div className="p-4">
              <CompanySidebar
                companies={companies}
                value={{ ticker, search: companySearch, setSearch: setCompanySearch }}
                onChange={(t) => { setTicker(t); setUseSession(false); setIsCompanyDrawerOpen(false); }}
              />
            </div>
          </div>
        )}

        {/* LEFT — companies */}
        <aside className="hidden lg:block col-span-3 xl:col-span-2 border-r" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="lg:sticky lg:top-20 pb-6">
            <CompanySidebar
              companies={companies}
              value={{ ticker, search: companySearch, setSearch: setCompanySearch }}
              onChange={(t) => { setTicker(t); setUseSession(false); }}
            />
          </div>
        </aside>

        {/* CENTER — chat */}
        <main className={`col-span-12 ${openSource ? "lg:col-span-5 xl:col-span-6" : "lg:col-span-6 xl:col-span-7"} flex flex-col`} style={{ minHeight: "calc(100vh - 64px)" }}>
          {/* Context strip */}
          <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "hsl(var(--border))" }}>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.22em]" style={{ color: "hsl(var(--muted-foreground))" }}>{useSession ? "Querying your upload" : "Querying"}</div>
              <h2 className="font-serif text-2xl mt-0.5 tracking-tight" data-testid="active-context">
                {useSession ? sessionDoc?.label : (activeCompany ? activeCompany.name : "—")}
              </h2>
            </div>
            {!useSession && activeCompany && (
              <div className="hidden md:flex items-center gap-4 text-xs font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>
                <span>CIK {activeCompany.cik}</span>
                <span>·</span>
                <span>{activeCompany.sector}</span>
              </div>
            )}
          </div>

          {/* Chat scroll */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8" data-testid="chat-scroll">
            {showWelcome && (
              <div className="max-w-2xl mx-auto fadein">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.22em] mb-4" style={{ color: "hsl(var(--accent))" }}>
                  <Sparkles size={14}/> Ask the filing analyst
                </div>
                <h1 className="font-serif text-4xl md:text-5xl leading-[1.05] tracking-tight" style={{ letterSpacing: "-0.02em" }}>
                  Financial research that reads every page<br/>
                  and responds with cited precision.
                </h1>
                <p className="mt-6 text-[15px] leading-relaxed max-w-xl" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Ask natural-language questions about SEC filings, earnings releases, and uploaded financial PDFs. Responses are grounded in indexed sources, with citations and confidence markers for every answer.
                </p>

                <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="example-questions">
                  {examples.map((q, i) => (
                    <button
                      key={i}
                      data-testid={`example-q-${i}`}
                      onClick={() => ask(q)}
                      className="text-left p-4 rounded-lg border transition-colors group"
                      style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--surface))" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--surface-muted))")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "hsl(var(--surface))")}
                    >
                      <div className="text-[10px] font-mono uppercase tracking-[0.2em] mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>Example</div>
                      <div className="text-[14px] leading-snug flex items-start gap-2">
                        <span className="flex-1">{q}</span>
                        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" style={{ color: "hsl(var(--accent))" }}/>
                      </div>
                    </button>
                  ))}
                </div>

                {!useSession && filings.length > 0 && (
                  <div className="mt-10 fadein">
                    <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>Indexed Filings</div>
                    <div className="border rounded-lg overflow-hidden" style={{ borderColor: "hsl(var(--border))" }}>
                      <table className="w-full text-sm" data-testid="filings-table">
                        <thead>
                          <tr style={{ background: "hsl(var(--surface-muted))" }}>
                            <th className="text-left px-4 py-2 font-mono text-[11px] uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>Form</th>
                            <th className="text-left px-4 py-2 font-mono text-[11px] uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>Period</th>
                            <th className="text-left px-4 py-2 font-mono text-[11px] uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>Sections</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filings.map((f, i) => (
                            <tr key={i} className="border-t" style={{ borderColor: "hsl(var(--border))" }}>
                              <td className="px-4 py-2 font-mono text-[12px]">{f.form}</td>
                              <td className="px-4 py-2">{f.period}</td>
                              <td className="px-4 py-2 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{f.sections.join(" · ")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!showWelcome && (
              <div className="max-w-3xl mx-auto space-y-8" data-testid="messages">
                {messages.map((m, idx) => (
                  <div key={idx} className="fadein">
                    {m.role === "user" ? (
                      <div className="flex justify-end">
                        <div className="max-w-[80%] px-4 py-3 rounded-lg" style={{ background: "hsl(var(--surface-muted))" }} data-testid={`msg-user-${idx}`}>
                          <div className="text-[10px] font-mono uppercase tracking-[0.2em] mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>You</div>
                          <div className="text-[15px]">{m.content}</div>
                        </div>
                      </div>
                    ) : (
                      <div data-testid={`msg-ai-${idx}`}>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="text-[10px] font-mono uppercase tracking-[0.22em]" style={{ color: "hsl(var(--accent))" }}>Analyst</div>
                          {m.confidence && <ConfidenceBadge level={m.confidence}/>}
                        </div>
                        {m.content ? (
                          <div className={streaming && idx === messages.length - 1 ? "streaming-cursor" : ""}>
                            <AnswerText text={m.content} citations={m.citations} onCite={setOpenSource}/>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                            <Loader2 size={14} className="animate-spin"/> Retrieving sources…
                          </div>
                        )}
                        {m.citations && m.citations.length > 0 && m.content && (
                          <div className="mt-5 pt-4 border-t flex flex-wrap gap-2" style={{ borderColor: "hsl(var(--border))" }}>
                            <div className="text-[10px] font-mono uppercase tracking-[0.2em] w-full mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Sources</div>
                            {m.citations.map((c) => (
                              <button
                                key={c.n}
                                data-testid={`source-pill-${c.n}`}
                                onClick={() => setOpenSource(c)}
                                className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border text-xs"
                                style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--surface))" }}
                              >
                                <span className="citation-chip" style={{ marginLeft: 0 }}>{c.n}</span>
                                <span className="font-mono text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{c.form}</span>
                                <span>{c.section}</span>
                                <span className="font-mono text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{c.period}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {errorMsg && (
              <div className="max-w-2xl mx-auto mt-6 p-4 rounded-md flex items-start gap-3 text-sm" style={{ background: "hsl(var(--danger) / 0.08)", border: "1px solid hsl(var(--danger) / 0.25)", color: "hsl(var(--danger))" }} data-testid="error-banner">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0"/>
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="border-t px-6 py-4" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--background) / 0.9)", backdropFilter: "blur(6px)" }}>
            <div className="max-w-3xl mx-auto">
              <div className="flex items-end gap-2 p-2 rounded-lg border focus-within:ring-1" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--surface))" }}>
                <Search size={18} className="ml-2 mb-2.5 flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}/>
                <textarea
                  data-testid="chat-input"
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); }
                  }}
                  placeholder={useSession ? "Ask about your uploaded document…" : `Ask anything about ${activeCompany?.name?.split(" ")[0] || "this company"}'s filings…`}
                  className="flex-1 resize-none outline-none py-2 text-[15px] bg-transparent"
                  style={{ maxHeight: "160px" }}
                />
                <button
                  type="button"
                  data-testid="pdf-upload-button"
                  className="btn btn-secondary h-9 px-3"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadBusy}
                  title="Upload a PDF"
                >
                  {uploadBusy ? <Loader2 size={14} className="animate-spin"/> : <Upload size={16}/>}
                </button>
                <input
                  type="file"
                  ref={fileRef}
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onUpload(file);
                    }
                    e.target.value = null;
                  }}
                />
                <button
                  data-testid="send-button"
                  className="btn btn-primary"
                  onClick={() => ask()}
                  disabled={streaming || !input.trim()}
                  style={{ opacity: streaming || !input.trim() ? 0.5 : 1 }}
                >
                  {streaming ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>}

                  {streaming ? "Thinking" : "Send"}
                </button>
              </div>
              <div className="flex flex-col gap-2 mt-2 px-1 text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                <span className="flex items-center gap-1.5"><BookOpen size={11}/> Answers grounded in indexed filings only.</span>
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1"><FileText size={11}/> Upload PDF to query a financial report directly.</span>
                  <span className="ml-auto"><span className="kbd">↵</span> to send · <span className="kbd">Shift+↵</span> newline</span>
                </span>
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT — source pane / details */}
        {!openSource && (
          <aside className="hidden lg:block lg:col-span-3 xl:col-span-3 py-8 px-2 border-l" style={{ borderColor: "hsl(var(--border))" }}>
            <div className="sticky top-20">
              <div className="px-4">
                <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>About</div>
                <p className="text-[13px] leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                  FinanceRAG analyzes SEC filings and uploaded financial PDFs to surface the most relevant disclosures, risks, and commentary. Each answer includes direct source citations for transparency.
                </p>

                <hr className="divider my-6"/>

                <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>How it works</div>
                <ol className="text-[13px] space-y-3" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <li className="flex gap-3"><span className="font-mono text-xs" style={{ color: "hsl(var(--accent))" }}>01</span><span>SEC filings are indexed with form, company, and period metadata.</span></li>
                  <li className="flex gap-3"><span className="font-mono text-xs" style={{ color: "hsl(var(--accent))" }}>02</span><span>Relevant excerpts are retrieved for your question in real time.</span></li>
                  <li className="flex gap-3"><span className="font-mono text-xs" style={{ color: "hsl(var(--accent))" }}>03</span><span>The system returns a concise, cited answer grounded in the retrieved filings.</span></li>
                </ol>

                <hr className="divider my-6"/>

                <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>Hallucination guard</div>
                <p className="text-[13px] leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                  If the indexed excerpts don&apos;t contain an answer, the assistant will be transparent and indicate it explicitly rather than inventing unsupported details.
                </p>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Source drawer */}
      {openSource && <SourceDrawer source={openSource} onClose={() => setOpenSource(null)}/>}
      {openSource && <div className="fixed inset-0 bg-black/20 z-30 lg:hidden" onClick={() => setOpenSource(null)}/>}
    </div>
  );
}

export default App;
