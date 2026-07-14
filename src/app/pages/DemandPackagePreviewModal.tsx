import { useEffect, useRef, useState } from "react";
import {
  X, Download, Printer, History, Expand, Shrink, ChevronDown, FileText, Eye,
  ShieldCheck, Gavel, Clock, GitCompare, RotateCcw, Send, Folder, FolderOpen,
} from "lucide-react";
import type { DemandPackage } from "../types/case";
import { DAMAGE_EVIDENCE, DA_DAMAGE_FACTORS, VIOLATION_CARDS, POLICY_LIMIT, type WorkspaceModel } from "../workspace/WorkspaceTabs";

function formatUSD(n: number) {
  return "$" + Math.round(n).toLocaleString("en-US");
}

const PREVIEW_TABS = [
  { id: "letter", label: "Demand Letter" },
  { id: "summary", label: "Executive Summary" },
  { id: "medical", label: "Medical Summary" },
  { id: "economic", label: "Economic Damages" },
  { id: "noneconomic", label: "Non-Economic Damages" },
  { id: "negligence", label: "Negligence" },
  { id: "violations", label: "Violations" },
  { id: "documents", label: "Supporting Documents" },
  { id: "settlement", label: "Settlement Demand" },
] as const;
type PreviewTabId = (typeof PREVIEW_TABS)[number]["id"];

const VERSIONS = [
  { id: "v1", label: "AI Generated", editor: "LECO AI", summary: "Initial package generated from the selected settlement strategy." },
  { id: "v2", label: "Attorney Edit", editor: "Sarah Chen, Esq.", summary: "Edited the medical summary and adjusted non-economic multiplier notes." },
  { id: "v3", label: "Partner Review", editor: "Michael Reyes, Partner", summary: "Strengthened the liability argument and added statutory citations." },
  { id: "v4", label: "Final Version", editor: "Sarah Chen, Esq.", summary: "Finalized settlement demand language and confirmed carrier contact details." },
];

// ── Itemized, verified financial documents. Amounts reconcile exactly to the
// DAMAGE_EVIDENCE category totals shown in Economic Damages. ──
type FinancialDoc = { file: string; amount: number };
const MEDICAL_BILL_DOCS: FinancialDoc[] = [
  { file: "Hospital_Bill.pdf", amount: 52000 },
  { file: "ER_Bills.pdf", amount: 21300 },
  { file: "PT_Invoice.pdf", amount: 9200 },
  { file: "Out_of_Pocket_Receipts.pdf", amount: 5000 },
];

type DocFolder = "Medical Records" | "Hospital Bills" | "Police Reports" | "Expert Reports" | "Employment Records" | "Witness Statements";
const DOC_FOLDERS: { name: DocFolder; docs: { file: string; amount?: number; note: string }[] }[] = [
  {
    name: "Hospital Bills",
    docs: MEDICAL_BILL_DOCS.map((d) => ({ file: d.file, amount: d.amount, note: "Verified charge, reconciles to the Medical Bills total." })),
  },
  {
    name: "Medical Records",
    docs: [
      { file: "MRI_Report_2026.pdf", note: "Confirms the two-level cervical herniation central to this claim." },
      { file: "hospital_medical_records.pdf", note: "Core hospital chart covering the acute treatment window." },
      { file: "Life_Care_Plan.pdf", note: "Physician-prepared projection of future treatment needs." },
    ],
  },
  {
    name: "Police Reports",
    docs: [
      { file: "Police_Report.pdf", note: "Responding officer's fault determination." },
      { file: "Officer_Narrative.pdf", note: "Contemporaneous scene narrative." },
    ],
  },
  {
    name: "Expert Reports",
    docs: [
      { file: "EDR_Download.pdf", note: "Event-data-recorder telemetry supporting causation." },
      { file: "Vocational_Expert_Assessment.pdf", note: "Quantifies earning-capacity impact." },
    ],
  },
  {
    name: "Employment Records",
    docs: [
      { file: "Wage_Loss_Statement.pdf", note: "Employer-verified wage loss during treatment." },
      { file: "Employment_Verification.pdf", note: "Confirms pre-incident employment and earnings." },
    ],
  },
  {
    name: "Witness Statements",
    docs: [
      { file: "Witness_Statement_A.pdf", note: "Corroborates the failure-to-yield violation." },
      { file: "Witness_Statement_B.pdf", note: "Corroborates the red-light signal violation." },
    ],
  },
];

interface DemandPackagePreviewModalProps {
  pkg: DemandPackage;
  model: WorkspaceModel;
  onClose: () => void;
  onSend: () => void;
}

export function DemandPackagePreviewModal({ pkg, model, onClose, onSend }: DemandPackagePreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<PreviewTabId>("letter");
  const [fullScreen, setFullScreen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [restoreConfirmId, setRestoreConfirmId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [openFolders, setOpenFolders] = useState<Set<DocFolder>>(new Set());
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());

  const contentRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef(0);

  // Mount fade + scale animation.
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Lock background scroll while the preview is open — the modal is the
  // only interactive surface.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // ESC exits fullscreen only, never closes the preview.
  useEffect(() => {
    if (!fullScreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") toggleFullScreen(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullScreen]);

  const toggleFullScreen = () => {
    if (contentRef.current) savedScrollRef.current = contentRef.current.scrollTop;
    setFullScreen((v) => !v);
  };
  // Restore scroll position after the size transition settles.
  useEffect(() => {
    const t = setTimeout(() => { if (contentRef.current) contentRef.current.scrollTop = savedScrollRef.current; }, 50);
    return () => clearTimeout(t);
  }, [fullScreen]);

  const toggleFolder = (name: DocFolder) =>
    setOpenFolders((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });

  const markDownloaded = (id: string) => {
    setDownloadedIds((prev) => new Set(prev).add(id));
    setTimeout(() => setDownloadedIds((prev) => { const n = new Set(prev); n.delete(id); return n; }), 2000);
  };

  const restoreVersion = (id: string) => { setRestoreConfirmId(null); setVersionOpen(false); };

  const economicTotal = DAMAGE_EVIDENCE.reduce((s, e) => s + e.amount, 0);
  const nonEconomicTotal = economicTotal * model.multiplier;
  const medicalBillsTotal = DAMAGE_EVIDENCE.find((e) => e.category === "Medical Bills")?.amount ?? 0;

  const [duty, breach, causation] = [
    `As a commercial motor carrier operating in ${model.jurisdiction}, the defendant owed a duty to operate its vehicle in compliance with Illinois traffic statutes and federal motor-carrier safety regulations.`,
    "The defendant breached that duty by entering the intersection against the plaintiff's right-of-way and against the traffic-control signal, while traveling above the posted speed limit.",
    "Scene reconstruction, event-data-recorder telemetry, and witness corroboration directly tie the defendant's breach to the collision and the resulting cervical injury.",
  ];

  const stateStatutes = VIOLATION_CARDS.filter((v) => v.statute.startsWith("625"));
  const federalRegs = VIOLATION_CARDS.filter((v) => !v.statute.startsWith("625"));

  return (
    <div
      className={`fixed inset-0 z-[95] flex items-center justify-center transition-opacity duration-200 ${mounted ? "opacity-100" : "opacity-0"}`}
      style={{ background: "rgba(14,58,71,0.5)", backdropFilter: "blur(4px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`relative bg-white flex flex-col overflow-hidden shadow-2xl border border-line transition-all duration-200 ${mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"} ${fullScreen ? "w-screen h-screen rounded-none" : "w-[90vw] h-[90vh] rounded-2xl"}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ── Header (sticky) ── */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-line flex-wrap shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="card-title">{pkg.label}</h1>
              <span className="pill pill-neutral">{pkg.status}</span>
              <span className="pill pill-neutral">AI Generated</span>
            </div>
            <div className="secondary-text mt-1">Generated {pkg.generatedAt} · {pkg.docCount} Supporting Documents</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => window.print()} className="btn btn-secondary gap-1.5">
              <Download className="w-4 h-4" strokeWidth={1.75} /> Download
            </button>
            <button onClick={() => window.print()} className="btn btn-secondary gap-1.5">
              <Printer className="w-4 h-4" strokeWidth={1.75} /> Print
            </button>
            <button onClick={() => setVersionOpen(true)} className="btn btn-secondary gap-1.5">
              <History className="w-4 h-4" strokeWidth={1.75} /> Version History
            </button>
            <button
              onClick={toggleFullScreen}
              title={fullScreen ? "Exit Fullscreen" : "Expand"}
              className="p-2 rounded-lg border border-line text-ink hover:bg-wash transition-colors"
            >
              {fullScreen ? <Shrink className="w-4 h-4" strokeWidth={1.75} /> : <Expand className="w-4 h-4" strokeWidth={1.75} />}
            </button>
            <button onClick={onClose} title="Close" className="p-2 rounded-lg border border-line text-ink hover:bg-wash transition-colors">
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* ── Package tabs (sticky) ── */}
        <div className="flex items-center gap-1 px-4 border-b border-line overflow-x-auto bg-offwhite shrink-0">
          {PREVIEW_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`relative px-3.5 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${activeTab === t.id ? "text-brand" : "text-[#5B6B78] hover:text-ink"}`}
            >
              {t.label}
              {activeTab === t.id && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-brand" />}
            </button>
          ))}
        </div>

        {/* ── Body: scrollable content + sticky right summary ── */}
        <div className="flex-1 flex overflow-hidden">
          <div ref={contentRef} className="flex-1 overflow-y-auto p-6">
            {activeTab === "letter" && (
              <div className="max-w-3xl mx-auto rounded-xl border border-line bg-offwhite p-6 space-y-4 text-sm text-ink leading-relaxed font-serif select-text">
                <p>To: Claims Department, {model.insuranceCarrier}</p>
                <p>Re: Settlement Demand — {model.plaintiff} v. {model.defendant} · Incident Date: {model.incidentDate}</p>
                <p>Dear Claims Representative,</p>
                <p>
                  This firm represents {model.plaintiff} in connection with injuries sustained on {model.incidentDate} in {model.jurisdiction}. Liability rests squarely with your insured, whose commercial vehicle failed to yield the right-of-way and entered the intersection in violation of Illinois traffic statutes. As a result, {model.plaintiff} sustained a two-level cervical herniation requiring ongoing medical treatment.
                </p>
                <p>
                  Verified economic damages of {formatUSD(economicTotal)} — comprising medical bills, lost wages, future medical care, and rehabilitation — are fully documented in the enclosed records. Given the severity and permanence of the injuries, non-economic damages are valued at {formatUSD(nonEconomicTotal)}.
                </p>
                <p>
                  We demand payment of {formatUSD(pkg.estimatedAmount)} in full settlement of this claim within 30 days of receipt. We trust {model.insuranceCarrier} will give this matter prompt attention.
                </p>
                <p>Sincerely,<br />Sarah Chen, Esq.<br />Counsel for {model.plaintiff}</p>
              </div>
            )}

            {activeTab === "summary" && (
              <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  ["Claimant", model.plaintiff], ["Defendant", model.defendant], ["Attorney", "Sarah Chen, Esq."],
                  ["Venue", model.jurisdiction], ["Case Number", model.caseId], ["Settlement Strategy", pkg.generatedFrom],
                  ["Policy Limit", formatUSD(POLICY_LIMIT)], ["Estimated Demand", formatUSD(pkg.estimatedAmount)],
                  ["Confidence", `${model.confidence}%`],
                ] as const).map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-line bg-offwhite p-3.5">
                    <div className="eyebrow">{label}</div>
                    <div className="mt-1.5 text-sm font-semibold text-ink">{value}</div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "medical" && (
              <div className="max-w-3xl mx-auto space-y-3">
                {[
                  { title: "Timeline", body: `Injury sustained ${model.incidentDate}; emergency evaluation same day; MRI-confirmed cervical herniation within two weeks; ongoing pain-management and physical therapy through the present.` },
                  { title: "Diagnoses", body: "Two-level cervical disc herniation with nerve-root compression; chronic pain syndrome; secondary cognitive and emotional sequelae." },
                  { title: "Treatments", body: "Emergency stabilization, diagnostic imaging, pain-management specialist care, and a supervised physical therapy program." },
                  { title: "Surgeries", body: "No surgical intervention to date; treating physicians continue to monitor for surgical candidacy if conservative treatment plateaus." },
                  { title: "Permanent Injuries", body: "Treating specialists project permanent range-of-motion restriction and chronic pain consistent with the imaging findings." },
                  { title: "Current Limitations", body: "Reduced mobility, disrupted sleep, and functional restrictions in work and daily activities, as documented in the physical therapy and functional-capacity records." },
                ].map((s) => (
                  <div key={s.title} className="rounded-xl border border-line bg-offwhite p-4">
                    <div className="card-title text-[15px]">{s.title}</div>
                    <p className="secondary-text mt-1.5 leading-relaxed">{s.body}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "economic" && (
              <div className="max-w-3xl mx-auto space-y-6">
                {DAMAGE_EVIDENCE.map((cat) => {
                  const docs = cat.category === "Medical Bills" ? MEDICAL_BILL_DOCS : [{ file: cat.primary, amount: cat.amount }];
                  return (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="eyebrow">{cat.category}</div>
                        <div className="secondary-text">{formatUSD(cat.amount)} verified</div>
                      </div>
                      <div className="space-y-2">
                        {docs.map((d, i) => {
                          const id = `${cat.category}-${d.file}`;
                          return (
                            <div key={id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-line bg-offwhite">
                              <FileText className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
                              <div className="min-w-0 flex-1">
                                <div className="eyebrow">Document {String(i + 1).padStart(2, "0")}</div>
                                <div className="text-sm font-medium text-ink truncate">{d.file}</div>
                              </div>
                              <div className="text-sm font-bold text-ink tabular-nums shrink-0">{formatUSD(d.amount)}</div>
                              <span className="pill pill-complete shrink-0">Verified</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button className="p-1.5 rounded-lg hover:bg-wash text-ink transition-colors" title="View"><Eye className="w-3.5 h-3.5" strokeWidth={1.75} /></button>
                                <button onClick={() => markDownloaded(id)} className="p-1.5 rounded-lg hover:bg-wash text-ink transition-colors" title="Download">
                                  {downloadedIds.has(id) ? <ShieldCheck className="w-3.5 h-3.5 text-deep" strokeWidth={1.75} /> : <Download className="w-3.5 h-3.5" strokeWidth={1.75} />}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-ink text-white">
                  <div className="text-sm font-semibold">Total Verified Economic Damages</div>
                  <div className="text-sm font-bold tabular-nums">{formatUSD(economicTotal)}</div>
                </div>
              </div>
            )}

            {activeTab === "noneconomic" && (
              <div className="max-w-3xl mx-auto space-y-3">
                {DA_DAMAGE_FACTORS.map((f) => (
                  <div key={f.category} className="rounded-xl border border-line bg-offwhite p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="card-title text-[15px]">{f.category}</div>
                      <div className="text-right">
                        <div className="eyebrow">Multiplier</div>
                        <div className="text-sm font-bold text-ink tabular-nums">{f.aiMultiplier}×</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="eyebrow mb-1">AI Summary</div>
                      <p className="secondary-text leading-relaxed">{f.aiReasoning}</p>
                    </div>
                    <div className="mt-3">
                      <div className="eyebrow mb-1.5">Supporting Evidence</div>
                      <div className="flex flex-wrap gap-1.5">
                        {f.drivers.map((d) => <span key={d} className="pill pill-neutral">{d}</span>)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-line">
                      <div className="text-sm font-semibold text-ink">Final Contribution</div>
                      <div className="text-sm font-bold text-deep tabular-nums">{formatUSD(economicTotal * f.aiMultiplier)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "negligence" && (
              <div className="max-w-3xl mx-auto space-y-3">
                <div className="rounded-xl border border-line bg-offwhite p-4">
                  <div className="card-title text-[15px]">Negligence Findings</div>
                  <p className="secondary-text mt-1.5 leading-relaxed">
                    LECO's analysis establishes a clear negligence claim: the defendant owed and breached a duty of care, that breach directly caused the collision and resulting cervical injury, and the plaintiff sustained substantial economic and non-economic damages as a result.
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-offwhite p-4">
                  <div className="card-title text-[15px]">Applicable Duty Breaches</div>
                  <ul className="mt-1.5 space-y-1.5">
                    {VIOLATION_CARDS.map((v) => (
                      <li key={v.id} className="flex items-start gap-2 text-sm text-ink">
                        <Gavel className="w-3.5 h-3.5 text-deep mt-0.5 shrink-0" strokeWidth={1.75} /> {v.title}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-line bg-offwhite p-4">
                  <div className="card-title text-[15px]">Supporting Evidence</div>
                  <p className="secondary-text mt-1.5 leading-relaxed">{causation}</p>
                </div>
                <div className="rounded-xl border border-line bg-offwhite p-4">
                  <div className="card-title text-[15px]">Attorney Narrative</div>
                  <p className="secondary-text mt-1.5 leading-relaxed">{duty} {breach}</p>
                </div>
              </div>
            )}

            {activeTab === "violations" && (
              <div className="max-w-3xl mx-auto space-y-5">
                <div>
                  <div className="eyebrow mb-2">Statutes</div>
                  <div className="space-y-2.5">
                    {stateStatutes.map((v) => (
                      <div key={v.id} className="rounded-xl border border-line bg-offwhite p-4">
                        <div className="card-title text-[15px]">{v.title}</div>
                        <div className="mono-ref mt-1">{v.statute}</div>
                        <p className="secondary-text mt-2 leading-relaxed">{v.aiSummary}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="eyebrow mb-2">Regulations</div>
                  <div className="space-y-2.5">
                    {federalRegs.map((v) => (
                      <div key={v.id} className="rounded-xl border border-line bg-offwhite p-4">
                        <div className="card-title text-[15px]">{v.title}</div>
                        <div className="mono-ref mt-1">{v.statute}</div>
                        <p className="secondary-text mt-2 leading-relaxed">{v.aiSummary}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="eyebrow mb-2">Supporting Evidence &amp; Violation Explanations</div>
                  <div className="space-y-2.5">
                    {VIOLATION_CARDS.map((v) => (
                      <div key={v.id} className="rounded-xl border border-line bg-offwhite p-4">
                        <div className="card-title text-[15px]">{v.title}</div>
                        <p className="secondary-text mt-1.5 leading-relaxed">{v.whyApplied}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {v.evidence.map((e) => <span key={e} className="pill pill-neutral">{e}</span>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "documents" && (
              <div className="max-w-3xl mx-auto space-y-2.5">
                {DOC_FOLDERS.map((folder) => {
                  const open = openFolders.has(folder.name);
                  return (
                    <div key={folder.name} className="rounded-xl border border-line overflow-hidden">
                      <button onClick={() => toggleFolder(folder.name)} className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-offwhite hover:bg-wash transition-colors text-left">
                        <div className="flex items-center gap-2.5">
                          {open ? <FolderOpen className="w-4 h-4 text-deep" strokeWidth={1.75} /> : <Folder className="w-4 h-4 text-deep" strokeWidth={1.75} />}
                          <span className="card-title text-[15px]">{folder.name}</span>
                          <span className="secondary-text">({folder.docs.length})</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-deep transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} />
                      </button>
                      {open && (
                        <div className="p-3 space-y-2 bg-white">
                          {folder.docs.map((d, i) => {
                            const id = `${folder.name}-${d.file}`;
                            return (
                              <div key={id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-line bg-offwhite">
                                <FileText className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
                                <div className="min-w-0 flex-1">
                                  <div className="eyebrow">Document {String(i + 1).padStart(2, "0")}</div>
                                  <div className="text-sm font-medium text-ink truncate">{d.file}</div>
                                  {!d.amount && <div className="text-xs text-[#8A98A3] mt-0.5">{d.note}</div>}
                                </div>
                                {d.amount ? (
                                  <>
                                    <div className="text-sm font-bold text-ink tabular-nums shrink-0">{formatUSD(d.amount)}</div>
                                    <span className="pill pill-complete shrink-0">Verified</span>
                                  </>
                                ) : (
                                  <span className="pill pill-complete shrink-0">Verified</span>
                                )}
                                <div className="flex items-center gap-1 shrink-0">
                                  <button className="p-1.5 rounded-lg hover:bg-wash text-ink transition-colors" title="View"><Eye className="w-3.5 h-3.5" strokeWidth={1.75} /></button>
                                  <button onClick={() => markDownloaded(id)} className="p-1.5 rounded-lg hover:bg-wash text-ink transition-colors" title="Download">
                                    {downloadedIds.has(id) ? <ShieldCheck className="w-3.5 h-3.5 text-deep" strokeWidth={1.75} /> : <Download className="w-3.5 h-3.5" strokeWidth={1.75} />}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "settlement" && (
              <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  ["Demand Amount", formatUSD(pkg.estimatedAmount)], ["Recipient", "Claims Department"],
                  ["Insurance Carrier", model.insuranceCarrier], ["Delivery Method", "Certified Mail &amp; Email"],
                  ["Response Deadline", "30 days from receipt"],
                ] as const).map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-line bg-offwhite p-3.5">
                    <div className="eyebrow">{label}</div>
                    <div className="mt-1.5 text-sm font-semibold text-ink" dangerouslySetInnerHTML={{ __html: value }} />
                  </div>
                ))}
                <div className="rounded-xl border border-line bg-offwhite p-3.5 flex items-center justify-between">
                  <div className="eyebrow">Demand Letter Attached</div>
                  <ShieldCheck className="w-4 h-4 text-deep" strokeWidth={1.75} />
                </div>
                <div className="rounded-xl border border-line bg-offwhite p-3.5 flex items-center justify-between">
                  <div className="eyebrow">Supporting Documents Attached</div>
                  <span className="text-sm font-semibold text-ink tabular-nums">{pkg.docCount}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Sticky right-side Package Summary ── */}
          <div className="w-[280px] shrink-0 border-l border-line overflow-y-auto p-5 bg-offwhite hidden lg:block">
            <div className="eyebrow mb-3">Package Summary</div>
            <div className="space-y-3">
              <div className="rounded-xl border border-line bg-white p-3">
                <div className="eyebrow">Demand Amount</div>
                <div className="mt-1 text-base font-bold text-ink tabular-nums">{formatUSD(pkg.estimatedAmount)}</div>
              </div>
              <div className="rounded-xl border border-line bg-white p-3">
                <div className="eyebrow">Supporting Documents</div>
                <div className="mt-1 text-sm font-semibold text-ink tabular-nums">{pkg.docCount}</div>
              </div>
              <div className="rounded-xl border border-line bg-white p-3">
                <div className="eyebrow">Medical Bills</div>
                <div className="mt-1 text-sm font-semibold text-ink tabular-nums">{formatUSD(medicalBillsTotal)}</div>
              </div>
              <div className="rounded-xl border border-line bg-white p-3">
                <div className="eyebrow">Economic Damages</div>
                <div className="mt-1 text-sm font-semibold text-ink tabular-nums">{formatUSD(economicTotal)}</div>
              </div>
              <div className="rounded-xl border border-line bg-white p-3">
                <div className="eyebrow">Non-Economic Damages</div>
                <div className="mt-1 text-sm font-semibold text-ink tabular-nums">{formatUSD(nonEconomicTotal)}</div>
              </div>
              <div className="rounded-xl border border-line bg-white p-3">
                <div className="eyebrow">Strategy</div>
                <div className="mt-1 text-sm font-semibold text-ink">{pkg.generatedFrom}</div>
              </div>
              <div className="rounded-xl border border-line bg-white p-3">
                <div className="eyebrow">Confidence</div>
                <div className="mt-1 text-sm font-semibold text-ink tabular-nums">{model.confidence}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer (read-only actions only) ── */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-line shrink-0">
          <button onClick={onClose} className="btn btn-secondary">Close Preview</button>
          <button onClick={() => window.print()} className="btn btn-secondary gap-1.5">
            <Download className="w-4 h-4" strokeWidth={1.75} /> Download PDF
          </button>
          <button onClick={onSend} className="btn btn-primary gap-1.5">
            <Send className="w-4 h-4" strokeWidth={1.75} /> Send Demand
          </button>
        </div>

        {/* ── Version History drawer (scoped to this modal) ── */}
        {versionOpen && (
          <>
            <div className="absolute inset-0 bg-ink/30 z-30" onClick={() => setVersionOpen(false)} />
            <div className="absolute top-0 right-0 h-full w-[420px] max-w-[92%] bg-white shadow-xl z-30 flex flex-col border-l border-line">
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
                <h2 className="card-title">Version History</h2>
                <button onClick={() => setVersionOpen(false)} className="p-1.5 hover:bg-tint rounded-lg transition-colors"><X className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {[...VERSIONS].reverse().map((v) => (
                  <div key={v.id} className="rounded-xl border border-line bg-offwhite p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="pill pill-neutral">{v.label}</span>
                      <span className="text-xs text-[#8A98A3] flex items-center gap-1"><Clock className="w-3 h-3" strokeWidth={1.75} /> {v.id === "v1" ? pkg.generatedAt : "Today"}</span>
                    </div>
                    <div className="text-sm font-medium text-ink mt-2">{v.editor}</div>
                    <p className="secondary-text mt-1 leading-relaxed">{v.summary}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <button onClick={() => setCompareId(v.id)} className="btn btn-secondary text-xs px-3 py-1.5 gap-1.5"><GitCompare className="w-3.5 h-3.5" strokeWidth={1.75} /> Compare</button>
                      <button onClick={() => setRestoreConfirmId(v.id)} className="btn btn-secondary text-xs px-3 py-1.5 gap-1.5"><RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} /> Restore</button>
                    </div>
                    {restoreConfirmId === v.id && (
                      <div className="mt-3 pt-3 border-t border-line flex items-center justify-between gap-2">
                        <span className="text-xs text-ink">Restore this version for editing?</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => setRestoreConfirmId(null)} className="text-xs font-medium text-[#5B6B78] hover:text-ink">Cancel</button>
                          <button onClick={() => restoreVersion(v.id)} className="btn btn-primary text-xs px-2.5 py-1">Confirm</button>
                        </div>
                      </div>
                    )}
                    {compareId === v.id && (
                      <div className="mt-3 pt-3 border-t border-line grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-white border border-line p-2">
                          <div className="eyebrow mb-1">{v.label}</div>
                          <p className="text-ink leading-relaxed">{v.summary}</p>
                        </div>
                        <div className="rounded-lg bg-white border border-line p-2">
                          <div className="eyebrow mb-1">Current Package</div>
                          <p className="text-ink leading-relaxed">Reflects the package as it stands now, ready to preview and send.</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
