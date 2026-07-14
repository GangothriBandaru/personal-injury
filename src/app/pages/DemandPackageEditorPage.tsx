import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileSignature, Sparkles, Upload, History, Download, Save, MoreVertical, Maximize2, Minimize2, X,
  Undo2, Redo2, Bold, Italic, Underline, Strikethrough, Superscript, Subscript,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, IndentIncrease, IndentDecrease,
  List, ListOrdered, Quote, Link2, Image as ImageIcon, Table2, Minus, Palette, Highlighter, Type,
  ChevronDown, Plus, Trash2, FileText, Eye, RefreshCw, UploadCloud, GripVertical, Pencil, Search,
  SlidersHorizontal, Clock, GitCompare, RotateCcw, Send, Bot, Wand2, Scissors, Copy, Gavel,
} from "lucide-react";
import type { DemandPackage } from "../types/case";
import { DAMAGE_EVIDENCE, DA_DAMAGE_FACTORS, VIOLATION_CARDS, type WorkspaceModel } from "../workspace/WorkspaceTabs";

function formatUSD(n: number) {
  return "$" + Math.round(n).toLocaleString("en-US");
}
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ── Package navigation tabs ──────────────────────────────────────────────────
const EDITOR_TABS = [
  { id: "letter", label: "Demand Letter" },
  { id: "summary", label: "Executive Summary" },
  { id: "medical", label: "Medical Summary" },
  { id: "economic", label: "Economic Damages" },
  { id: "noneconomic", label: "Non-Economic Damages" },
  { id: "negligence", label: "Negligence" },
  { id: "violations", label: "Violation Analysis" },
  { id: "documents", label: "Supporting Documents" },
  { id: "settlement", label: "Settlement Demand" },
] as const;
type EditorTabId = (typeof EDITOR_TABS)[number]["id"];

// Which tabs carry a contentEditable region the rich-text toolbar can act on.
const RICH_TEXT_TABS: EditorTabId[] = ["letter", "medical", "negligence", "settlement"];

// Context-aware AI framing per tab, shown in the assistant panel.
const AI_CONTEXT: Record<EditorTabId, string> = {
  letter: "Improve legal writing in the demand letter.",
  summary: "Sharpen the executive summary.",
  medical: "Summarize treatment and medical history.",
  economic: "Explain the economic damages calculations.",
  noneconomic: "Reinforce the non-economic damages reasoning.",
  negligence: "Strengthen the legal argument.",
  violations: "Recommend applicable statutes.",
  documents: "Find supporting evidence.",
  settlement: "Improve the closing language.",
};

const AI_PROMPTS = [
  "Improve this paragraph",
  "Rewrite professionally",
  "Strengthen liability argument",
  "Summarize selected text",
  "Find supporting evidence",
  "Insert applicable statute",
  "Generate stronger demand language",
  "Reduce repetitive wording",
];

const SELECTION_ACTIONS = [
  { id: "rewrite", label: "Rewrite", icon: Wand2 },
  { id: "shorten", label: "Shorten", icon: Scissors },
  { id: "expand", label: "Expand", icon: Plus },
  { id: "formalize", label: "Formalize", icon: FileSignature },
  { id: "persuasive", label: "Make Persuasive", icon: Sparkles },
  { id: "statute", label: "Insert Statute", icon: Gavel },
] as const;

const VERSIONS = [
  { id: "v1", label: "AI Generated", editor: "LECO AI", summary: "Initial package generated from the selected settlement strategy." },
  { id: "v2", label: "Attorney Edit", editor: "Sarah Chen, Esq.", summary: "Edited the medical summary and adjusted non-economic multiplier notes." },
  { id: "v3", label: "Partner Review", editor: "Michael Reyes, Partner", summary: "Strengthened the liability argument and added statutory citations." },
  { id: "v4", label: "Final Version", editor: "Sarah Chen, Esq.", summary: "Finalized settlement demand language and confirmed carrier contact details." },
];

type DocCategory = "Medical Bills" | "Medical Records" | "Police Reports" | "Witness Statements" | "Expert Reports" | "Employment Records";
const DOC_CATEGORIES: DocCategory[] = ["Medical Bills", "Medical Records", "Police Reports", "Witness Statements", "Expert Reports", "Employment Records"];
interface DocRecord { id: string; name: string; category: DocCategory; size: string; }

function seedDocuments(): DocRecord[] {
  return [
    { id: uid(), name: "Hospital_Bill.pdf", category: "Medical Bills", size: "1.2 MB" },
    { id: uid(), name: "ER_Bills.pdf", category: "Medical Bills", size: "480 KB" },
    { id: uid(), name: "PT_Invoice.pdf", category: "Medical Bills", size: "210 KB" },
    { id: uid(), name: "MRI_Report_2026.pdf", category: "Medical Records", size: "3.4 MB" },
    { id: uid(), name: "hospital_medical_records.pdf", category: "Medical Records", size: "5.1 MB" },
    { id: uid(), name: "Life_Care_Plan.pdf", category: "Medical Records", size: "890 KB" },
    { id: uid(), name: "Police_Report.pdf", category: "Police Reports", size: "640 KB" },
    { id: uid(), name: "Officer_Narrative.pdf", category: "Police Reports", size: "220 KB" },
    { id: uid(), name: "Witness_Statement_A.pdf", category: "Witness Statements", size: "150 KB" },
    { id: uid(), name: "Witness_Statement_B.pdf", category: "Witness Statements", size: "140 KB" },
    { id: uid(), name: "EDR_Download.pdf", category: "Expert Reports", size: "2.7 MB" },
    { id: uid(), name: "Vocational_Expert_Assessment.pdf", category: "Expert Reports", size: "1.1 MB" },
    { id: uid(), name: "Wage_Loss_Statement.pdf", category: "Employment Records", size: "300 KB" },
    { id: uid(), name: "Employment_Verification.pdf", category: "Employment Records", size: "180 KB" },
  ];
}

// ── Rich-text toolbar — operates on whatever contentEditable region has focus ──
function exec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}
function ToolbarButton({ icon: Icon, title, onClick, active }: { icon: any; title: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`p-1.5 rounded-lg transition-colors ${active ? "bg-tint text-deep" : "text-ink hover:bg-wash"}`}
    >
      <Icon className="w-4 h-4" strokeWidth={1.75} />
    </button>
  );
}

const TEXT_COLORS = ["#0F1E2B", "#1E7C99", "#3FB5D7", "#16A34A", "#D97706", "#DC2626"];
const HIGHLIGHT_COLORS = ["#FEF3C7", "#DCFCE7", "#E6F6FB", "#FEE2E2", "#EDE9FE"];

function RichTextToolbar() {
  const [colorOpen, setColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);

  const closePopovers = () => { setColorOpen(false); setHighlightOpen(false); setStyleOpen(false); setFontOpen(false); setSizeOpen(false); };

  return (
    <div className="flex items-center gap-0.5 px-3 py-2 border-b border-line bg-white flex-wrap relative">
      <ToolbarButton icon={Undo2} title="Undo" onClick={() => exec("undo")} />
      <ToolbarButton icon={Redo2} title="Redo" onClick={() => exec("redo")} />
      <div className="w-px h-5 bg-line mx-1" />

      {/* Paragraph styles */}
      <div className="relative">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { closePopovers(); setStyleOpen((v) => !v); }} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-ink hover:bg-wash transition-colors">
          <Type className="w-3.5 h-3.5" strokeWidth={1.75} /> Style <ChevronDown className="w-3 h-3" strokeWidth={1.75} />
        </button>
        {styleOpen && (
          <div className="absolute top-full left-0 mt-1 w-44 lg-card p-1.5 z-20">
            {[["Paragraph", "p"], ["Heading 1", "h1"], ["Heading 2", "h2"], ["Heading 3", "h3"], ["Quote", "blockquote"]].map(([label, tag]) => (
              <button key={tag} onMouseDown={(e) => e.preventDefault()} onClick={() => { exec("formatBlock", `<${tag}>`); setStyleOpen(false); }} className="w-full text-left px-2.5 py-1.5 rounded-md text-sm text-ink hover:bg-tint transition-colors">
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Font family */}
      <div className="relative">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { closePopovers(); setFontOpen((v) => !v); }} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-ink hover:bg-wash transition-colors">
          Font <ChevronDown className="w-3 h-3" strokeWidth={1.75} />
        </button>
        {fontOpen && (
          <div className="absolute top-full left-0 mt-1 w-40 lg-card p-1.5 z-20">
            {["Inter", "Georgia", "Times New Roman", "Courier New"].map((f) => (
              <button key={f} onMouseDown={(e) => e.preventDefault()} onClick={() => { exec("fontName", f); setFontOpen(false); }} className="w-full text-left px-2.5 py-1.5 rounded-md text-sm text-ink hover:bg-tint transition-colors" style={{ fontFamily: f }}>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Font size */}
      <div className="relative">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { closePopovers(); setSizeOpen((v) => !v); }} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-ink hover:bg-wash transition-colors">
          Size <ChevronDown className="w-3 h-3" strokeWidth={1.75} />
        </button>
        {sizeOpen && (
          <div className="absolute top-full left-0 mt-1 w-28 lg-card p-1.5 z-20">
            {[["Small", "2"], ["Normal", "3"], ["Large", "5"], ["X-Large", "6"]].map(([label, val]) => (
              <button key={val} onMouseDown={(e) => e.preventDefault()} onClick={() => { exec("fontSize", val); setSizeOpen(false); }} className="w-full text-left px-2.5 py-1.5 rounded-md text-sm text-ink hover:bg-tint transition-colors">
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-line mx-1" />
      <ToolbarButton icon={Bold} title="Bold" onClick={() => exec("bold")} />
      <ToolbarButton icon={Italic} title="Italic" onClick={() => exec("italic")} />
      <ToolbarButton icon={Underline} title="Underline" onClick={() => exec("underline")} />
      <ToolbarButton icon={Strikethrough} title="Strikethrough" onClick={() => exec("strikeThrough")} />
      <ToolbarButton icon={Superscript} title="Superscript" onClick={() => exec("superscript")} />
      <ToolbarButton icon={Subscript} title="Subscript" onClick={() => exec("subscript")} />

      <div className="w-px h-5 bg-line mx-1" />
      <div className="relative">
        <ToolbarButton icon={Palette} title="Text Color" onClick={() => { closePopovers(); setColorOpen((v) => !v); }} />
        {colorOpen && (
          <div className="absolute top-full left-0 mt-1 flex items-center gap-1.5 lg-card p-2 z-20">
            {TEXT_COLORS.map((c) => (
              <button key={c} onMouseDown={(e) => e.preventDefault()} onClick={() => { exec("foreColor", c); setColorOpen(false); }} className="w-5 h-5 rounded-full border border-line" style={{ background: c }} />
            ))}
          </div>
        )}
      </div>
      <div className="relative">
        <ToolbarButton icon={Highlighter} title="Highlight" onClick={() => { closePopovers(); setHighlightOpen((v) => !v); }} />
        {highlightOpen && (
          <div className="absolute top-full left-0 mt-1 flex items-center gap-1.5 lg-card p-2 z-20">
            {HIGHLIGHT_COLORS.map((c) => (
              <button key={c} onMouseDown={(e) => e.preventDefault()} onClick={() => { exec("hiliteColor", c); setHighlightOpen(false); }} className="w-5 h-5 rounded-full border border-line" style={{ background: c }} />
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-line mx-1" />
      <ToolbarButton icon={AlignLeft} title="Align Left" onClick={() => exec("justifyLeft")} />
      <ToolbarButton icon={AlignCenter} title="Align Center" onClick={() => exec("justifyCenter")} />
      <ToolbarButton icon={AlignRight} title="Align Right" onClick={() => exec("justifyRight")} />
      <ToolbarButton icon={AlignJustify} title="Justify" onClick={() => exec("justifyFull")} />

      <div className="w-px h-5 bg-line mx-1" />
      <ToolbarButton icon={IndentDecrease} title="Outdent" onClick={() => exec("outdent")} />
      <ToolbarButton icon={IndentIncrease} title="Indent" onClick={() => exec("indent")} />
      <ToolbarButton icon={List} title="Bullet List" onClick={() => exec("insertUnorderedList")} />
      <ToolbarButton icon={ListOrdered} title="Numbered List" onClick={() => exec("insertOrderedList")} />
      <ToolbarButton icon={Quote} title="Quote" onClick={() => exec("formatBlock", "<blockquote>")} />

      <div className="w-px h-5 bg-line mx-1" />
      <ToolbarButton icon={Link2} title="Insert Link" onClick={() => { const url = window.prompt("Link URL"); if (url) exec("createLink", url); }} />
      <ToolbarButton icon={ImageIcon} title="Insert Image" onClick={() => { const url = window.prompt("Image URL"); if (url) exec("insertImage", url); }} />
      <ToolbarButton
        icon={Table2}
        title="Insert Table"
        onClick={() => exec("insertHTML", `<table style="width:100%;border-collapse:collapse;margin:8px 0;"><tbody>${Array.from({ length: 3 }).map(() => `<tr>${Array.from({ length: 3 }).map(() => `<td style="border:1px solid #E3EBF0;padding:6px 8px;">&nbsp;</td>`).join("")}</tr>`).join("")}</tbody></table>`)}
      />
      <ToolbarButton icon={Minus} title="Horizontal Divider" onClick={() => exec("insertHorizontalRule")} />
    </div>
  );
}

// A contentEditable panel. Always mounted (hidden via CSS when inactive) so
// content and native undo/redo history survive tab switches.
function RichTextPanel({
  active, initialHtml, onDirty, onSelect, panelRef,
}: {
  active: boolean;
  initialHtml: string;
  onDirty: () => void;
  onSelect: (text: string, range: Range | null) => void;
  panelRef: React.RefObject<HTMLDivElement>;
}) {
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current && panelRef.current) {
      panelRef.current.innerHTML = initialHtml;
      initialized.current = true;
    }
  }, [initialHtml, panelRef]);

  const captureSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !panelRef.current?.contains(sel.anchorNode)) return;
    onSelect(sel.toString(), sel.getRangeAt(0).cloneRange());
  };

  return (
    <div
      ref={panelRef}
      contentEditable
      suppressContentEditableWarning
      onInput={onDirty}
      onMouseUp={captureSelection}
      onKeyUp={captureSelection}
      className={`${active ? "block" : "hidden"} min-h-[360px] px-6 py-5 text-sm text-ink leading-relaxed focus:outline-none [&_h1]:page-title [&_h1]:mb-2 [&_h2]:section-header [&_h2]:mb-2 [&_h3]:card-title [&_h3]:mb-1.5 [&_p]:mb-3 [&_blockquote]:border-l-2 [&_blockquote]:border-brand [&_blockquote]:pl-3 [&_blockquote]:text-deep [&_blockquote]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-deep [&_a]:underline`}
    />
  );
}

interface DemandPackageEditorPageProps {
  pkg: DemandPackage;
  model: WorkspaceModel;
  onClose: () => void;
  onSaveNotes: (notes: string) => void;
}

export function DemandPackageEditorPage({ pkg, model, onClose, onSaveNotes }: DemandPackageEditorPageProps) {
  const [activeTab, setActiveTab] = useState<EditorTabId>("letter");
  const [fullScreen, setFullScreen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  // ── Autosave ──
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving">("saved");
  const [lastSavedAt, setLastSavedAt] = useState<number>(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const markDirty = () => setSaveState("unsaved");
  useEffect(() => {
    if (saveState !== "unsaved") return;
    const t1 = setTimeout(() => setSaveState("saving"), 900);
    const t2 = setTimeout(() => { setSaveState("saved"); setLastSavedAt(Date.now()); }, 1700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [saveState]);
  useEffect(() => {
    const t = setInterval(() => setSecondsAgo(Math.round((Date.now() - lastSavedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [lastSavedAt]);

  // ── Structured content state ──
  const [executiveSummary, setExecutiveSummary] = useState({
    claimant: model.plaintiff,
    defendant: model.defendant,
    venue: model.jurisdiction,
    liability: "Clear — defendant's commercial vehicle failed to yield the right-of-way and entered the intersection against a red signal.",
    demandAmount: formatUSD(pkg.estimatedAmount),
    settlementStrategy: pkg.generatedFrom,
  });

  const [economicCategories, setEconomicCategories] = useState(
    DAMAGE_EVIDENCE.map((e) => ({ id: uid(), category: e.category, amount: e.amount, docCount: e.docCount }))
  );
  const liveEconomicTotal = economicCategories.reduce((s, c) => s + c.amount, 0);

  const [nonEconomicFactors, setNonEconomicFactors] = useState(
    DA_DAMAGE_FACTORS.map((f) => ({ id: uid(), category: f.category, multiplier: f.aiMultiplier, notes: "", narrative: f.rationale, aiReasoning: f.aiReasoning }))
  );
  const liveMultiplierSum = nonEconomicFactors.reduce((s, f) => s + f.multiplier, 0);
  const liveNonEconomicTotal = Math.round(liveEconomicTotal * liveMultiplierSum);
  const liveSettlementTotal = liveEconomicTotal + liveNonEconomicTotal;

  const [attachedStatutes, setAttachedStatutes] = useState<string[]>([VIOLATION_CARDS[0]?.statute ?? ""]);

  const [violations, setViolations] = useState(
    VIOLATION_CARDS.map((v) => ({ id: uid(), title: v.title, statute: v.statute, evidence: v.evidence.join(", "), notes: v.whyApplied }))
  );

  const [documents, setDocuments] = useState<DocRecord[]>(seedDocuments);
  const [docSearch, setDocSearch] = useState("");
  const [docFilter, setDocFilter] = useState<"All" | DocCategory>("All");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [previewDoc, setPreviewDoc] = useState<DocRecord | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<string | null>(null);

  const [settlement, setSettlement] = useState({
    amount: formatUSD(pkg.estimatedAmount),
    deadline: "30 days from receipt",
    recipient: "Claims Department",
    carrier: model.insuranceCarrier,
    adjuster: "Assigned Claims Adjuster",
    paymentInstructions: "Payment by certified check payable to counsel's trust account, or wire transfer per instructions to follow upon acceptance.",
  });

  // ── Rich text panel refs + initial HTML ──
  const letterRef = useRef<HTMLDivElement>(null);
  const medicalRef = useRef<HTMLDivElement>(null);
  const negligenceRef = useRef<HTMLDivElement>(null);
  const settlementClosingRef = useRef<HTMLDivElement>(null);

  const letterHtml = useMemo(() => `
    <p>To: ${settlement.recipient}, ${settlement.carrier}</p>
    <p>Re: Settlement Demand — ${model.plaintiff} v. ${model.defendant} · Incident Date: ${model.incidentDate}</p>
    <p>Dear Claims Representative,</p>
    <p>This firm represents ${model.plaintiff} in connection with injuries sustained on ${model.incidentDate} in ${model.jurisdiction}. Liability rests squarely with your insured, whose commercial vehicle failed to yield the right-of-way and entered the intersection in violation of Illinois traffic statutes. As a result, ${model.plaintiff} sustained a two-level cervical herniation requiring ongoing medical treatment.</p>
    <p>Verified economic damages of <span data-field="economicTotal">${formatUSD(liveEconomicTotal)}</span> — comprising medical bills, lost wages, future medical care, and rehabilitation — are fully documented in the enclosed records. Given the severity and permanence of the injuries, non-economic damages are valued at <span data-field="nonEconomicTotal">${formatUSD(liveNonEconomicTotal)}</span>.</p>
    <p>We demand payment of <span data-field="settlementTotal">${formatUSD(liveSettlementTotal)}</span> in full settlement of this claim within ${settlement.deadline}. We trust ${settlement.carrier} will give this matter prompt attention.</p>
    <p>Sincerely,<br/>Counsel for ${model.plaintiff}</p>
  `, []); // seeded once; live totals sync via the effect below

  const medicalHtml = useMemo(() => `
    <h3>Medical Timeline &amp; Current Condition</h3>
    ${DA_DAMAGE_FACTORS.filter((f) => ["Pain & Suffering", "Physical Impairment", "Cognitive Impairment"].includes(f.category)).map((f) => `<p><strong>${f.category}:</strong> ${f.aiReasoning}</p>`).join("")}
  `, []);

  const negligenceHtml = useMemo(() => `
    <p><strong>Duty of Care.</strong> As a commercial motor carrier operating in ${model.jurisdiction}, the defendant owed a duty to operate its vehicle in compliance with Illinois traffic statutes and federal motor-carrier safety regulations.</p>
    <p><strong>Breach of Duty.</strong> The defendant breached that duty by entering the intersection against the plaintiff's right-of-way and against the traffic-control signal, while traveling above the posted speed limit.</p>
    <p><strong>Causation.</strong> Scene reconstruction, event-data-recorder telemetry, and witness corroboration directly tie the defendant's breach to the collision and the resulting cervical injury.</p>
    <p><strong>Damages.</strong> The breach directly caused the economic and non-economic damages detailed in this demand package.</p>
  `, []);

  const settlementClosingHtml = useMemo(() => `
    <p>We are prepared to proceed to litigation should a satisfactory resolution not be reached within the deadline stated above. We remain available to discuss this demand in good faith and look forward to a prompt response.</p>
  `, []);

  // Keep merge-field spans in the Demand Letter in sync with live totals.
  useEffect(() => {
    const root = letterRef.current;
    if (!root) return;
    const set = (field: string, value: string) => root.querySelectorAll(`[data-field="${field}"]`).forEach((el) => { el.textContent = value; });
    set("economicTotal", formatUSD(liveEconomicTotal));
    set("nonEconomicTotal", formatUSD(liveNonEconomicTotal));
    set("settlementTotal", formatUSD(liveSettlementTotal));
  }, [liveEconomicTotal, liveNonEconomicTotal, liveSettlementTotal]);

  // ── AI assistant ──
  const [aiMessages, setAiMessages] = useState<{ from: "ai" | "user"; text: string }[]>([
    { from: "ai", text: "I'm reviewing this demand package with you. Ask me to rewrite a section, find supporting evidence, or strengthen the liability argument." },
  ]);
  const [aiInput, setAiInput] = useState("");
  const [selection, setSelection] = useState<{ text: string; range: Range | null }>({ text: "", range: null });
  const [aiResult, setAiResult] = useState<{ prompt: string; text: string } | null>(null);

  const sendAiMessage = (text: string) => {
    if (!text.trim()) return;
    setAiMessages((prev) => [...prev, { from: "user", text }]);
    const response = `${AI_CONTEXT[activeTab]} Based on the current ${EDITOR_TABS.find((t) => t.id === activeTab)?.label} section, here's my take: this reads clearly and is well-supported by the record. I'd tighten the second sentence and lead with the strongest liability fact.`;
    setTimeout(() => setAiMessages((prev) => [...prev, { from: "ai", text: response }]), 500);
    setAiInput("");
  };

  const runSelectionAction = (actionId: string, label: string) => {
    if (!selection.text) {
      setAiMessages((prev) => [...prev, { from: "ai", text: "Select some text in the document first, then choose an action and I'll work on that passage." }]);
      return;
    }
    let result = selection.text;
    if (actionId === "rewrite") result = `${selection.text.replace(/\.$/, "")}, reframed for maximum clarity and impact.`;
    else if (actionId === "shorten") result = selection.text.split(" ").slice(0, Math.max(6, Math.round(selection.text.split(" ").length * 0.6))).join(" ") + ".";
    else if (actionId === "expand") result = `${selection.text} This is further corroborated by the verified medical records and scene evidence on file, which independently support the same conclusion.`;
    else if (actionId === "formalize") result = `It is respectfully submitted that ${selection.text.charAt(0).toLowerCase()}${selection.text.slice(1)}`;
    else if (actionId === "persuasive") result = `${selection.text} The evidence here is unequivocal and leaves no reasonable basis for dispute.`;
    else if (actionId === "statute") result = `${selection.text} (see ${VIOLATION_CARDS[0]?.statute}).`;
    setAiResult({ prompt: label, text: result });
    setAiMessages((prev) => [...prev, { from: "user", text: `${label}: "${selection.text.slice(0, 60)}${selection.text.length > 60 ? "…" : ""}"` }, { from: "ai", text: result }]);
  };

  const replaceSelection = () => {
    if (!selection.range || !aiResult) return;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(selection.range);
    document.execCommand("insertText", false, aiResult.text);
    markDirty();
    setAiResult(null);
  };
  const insertBelow = () => {
    if (!selection.range || !aiResult) return;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    const r = selection.range.cloneRange();
    r.collapse(false);
    sel?.addRange(r);
    document.execCommand("insertHTML", false, `<p>${aiResult.text}</p>`);
    markDirty();
    setAiResult(null);
  };
  const copyResult = () => { if (aiResult) navigator.clipboard.writeText(aiResult.text); };

  // ── Version history ──
  const [restoreConfirmId, setRestoreConfirmId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [restoredBanner, setRestoredBanner] = useState<string | null>(null);
  const restoreVersion = (id: string) => {
    const v = VERSIONS.find((x) => x.id === id);
    if (!v || !letterRef.current) return;
    letterRef.current.innerHTML = `<p><em>[Restored from "${v.label}" — ${v.summary}]</em></p>` + letterRef.current.innerHTML;
    markDirty();
    setRestoreConfirmId(null);
    setVersionOpen(false);
    setRestoredBanner(v.label);
    setTimeout(() => setRestoredBanner(null), 3500);
  };

  // ── Expand mode: Esc to exit ──
  useEffect(() => {
    if (!fullScreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullScreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullScreen]);

  // ── Document manager helpers ──
  const filteredDocs = documents.filter((d) =>
    (docFilter === "All" || d.category === docFilter) &&
    d.name.toLowerCase().includes(docSearch.toLowerCase())
  );
  const moveDoc = (id: string, dir: -1 | 1) => {
    setDocuments((prev) => {
      const idx = prev.findIndex((d) => d.id === id);
      const swap = idx + dir;
      if (idx < 0 || swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
    markDirty();
  };
  const removeDoc = (id: string) => { setDocuments((prev) => prev.filter((d) => d.id !== id)); markDirty(); };
  const startRename = (d: DocRecord) => { setRenamingId(d.id); setRenameDraft(d.name); };
  const confirmRename = () => {
    if (!renamingId) return;
    setDocuments((prev) => prev.map((d) => (d.id === renamingId ? { ...d, name: renameDraft } : d)));
    setRenamingId(null);
    markDirty();
  };
  const triggerUpload = (replaceId: string | null) => {
    replaceTargetRef.current = replaceId;
    fileInputRef.current?.click();
  };
  const handleFileChosen: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const size = file.size > 1_000_000 ? `${(file.size / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1000))} KB`;
    if (replaceTargetRef.current) {
      setDocuments((prev) => prev.map((d) => (d.id === replaceTargetRef.current ? { ...d, name: file.name, size } : d)));
    } else {
      setDocuments((prev) => [...prev, { id: uid(), name: file.name, category: docFilter === "All" ? "Medical Records" : docFilter, size }]);
    }
    markDirty();
    e.target.value = "";
  };

  return (
    <div className="fixed inset-0 z-[95] bg-ink/50 flex items-center justify-center p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className={`relative bg-white flex flex-col overflow-hidden shadow-2xl border border-line transition-all duration-200 ${fullScreen ? "w-full h-full rounded-none" : "w-full max-w-[1280px] h-[88vh] rounded-2xl"}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
          {/* ── Header ── */}
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-line flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-tint flex items-center justify-center shrink-0">
                <FileSignature className="w-4 h-4 text-deep" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="card-title truncate">{pkg.label}</h1>
                  <span className="pill pill-neutral shrink-0"><Sparkles className="w-3 h-3" strokeWidth={1.75} /> AI Generated</span>
                </div>
                <div className="secondary-text mt-0.5">
                  {saveState === "unsaved" && "Unsaved changes"}
                  {saveState === "saving" && "Saving..."}
                  {saveState === "saved" && `Saved · Last saved ${secondsAgo < 5 ? "just now" : `${secondsAgo}s ago`}`}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button onClick={() => triggerUpload(null)} className="btn btn-secondary gap-1.5">
                <Upload className="w-4 h-4" strokeWidth={1.75} /> Import
              </button>
              <button onClick={() => setVersionOpen(true)} className="btn btn-secondary gap-1.5">
                <History className="w-4 h-4" strokeWidth={1.75} /> Version History
              </button>
              <button onClick={() => window.print()} className="btn btn-secondary gap-1.5">
                <Download className="w-4 h-4" strokeWidth={1.75} /> Download PDF
              </button>
              <button onClick={() => { setSaveState("saving"); setTimeout(() => { setSaveState("saved"); setLastSavedAt(Date.now()); }, 500); }} className="btn btn-primary gap-1.5">
                <Save className="w-4 h-4" strokeWidth={1.75} /> Save
              </button>
              <div className="relative">
                <button onClick={() => setOverflowOpen((v) => !v)} className="p-2 rounded-lg border border-line text-ink hover:bg-wash transition-colors">
                  <MoreVertical className="w-4 h-4" strokeWidth={1.75} />
                </button>
                {overflowOpen && (
                  <div className="absolute top-full right-0 mt-1 w-48 lg-card p-1.5 z-20">
                    <button onClick={() => { onSaveNotes(`Duplicated as reference on ${new Date().toLocaleDateString()}`); setOverflowOpen(false); }} className="w-full text-left px-2.5 py-2 rounded-md text-sm text-ink hover:bg-tint transition-colors">Duplicate Package</button>
                    <button onClick={() => { setOverflowOpen(false); window.print(); }} className="w-full text-left px-2.5 py-2 rounded-md text-sm text-ink hover:bg-tint transition-colors">Export as Document</button>
                    <button onClick={() => setOverflowOpen(false)} className="w-full text-left px-2.5 py-2 rounded-md text-sm text-[#DC2626] hover:bg-tint transition-colors">Delete Package</button>
                  </div>
                )}
              </div>
              <button onClick={() => setFullScreen((v) => !v)} className="p-2 rounded-lg border border-line text-ink hover:bg-wash transition-colors" title={fullScreen ? "Exit Full Screen" : "Expand / Full Screen"}>
                {fullScreen ? <Minimize2 className="w-4 h-4" strokeWidth={1.75} /> : <Maximize2 className="w-4 h-4" strokeWidth={1.75} />}
              </button>
              <button onClick={onClose} className="p-2 rounded-lg border border-line text-ink hover:bg-wash transition-colors" title="Close Editor">
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          {restoredBanner && (
            <div className="px-5 py-2.5 bg-tint border-b border-line text-sm text-deep flex items-center gap-2">
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} /> Restored content from "{restoredBanner}".
            </div>
          )}

          {/* ── Rich text toolbar ── */}
          <RichTextToolbar />

          {/* ── Package navigation tabs ── */}
          <div className="flex items-center gap-1 px-3 border-b border-line overflow-x-auto bg-offwhite">
            {EDITOR_TABS.map((t) => (
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

          {/* ── Tab content ── */}
          <div className="flex-1 overflow-y-auto">
            {/* Rich-text tabs stay mounted (hidden via CSS) so state survives tab switches */}
            <RichTextPanel active={activeTab === "letter"} initialHtml={letterHtml} onDirty={markDirty} onSelect={(text, range) => setSelection({ text, range })} panelRef={letterRef} />
            <RichTextPanel active={activeTab === "medical"} initialHtml={medicalHtml} onDirty={markDirty} onSelect={(text, range) => setSelection({ text, range })} panelRef={medicalRef} />
            <RichTextPanel active={activeTab === "negligence"} initialHtml={negligenceHtml} onDirty={markDirty} onSelect={(text, range) => setSelection({ text, range })} panelRef={negligenceRef} />

            {activeTab === "summary" && (
              <div className="p-6 space-y-4 max-w-2xl">
                {([
                  ["claimant", "Claimant"], ["defendant", "Defendant"], ["venue", "Venue"],
                  ["demandAmount", "Demand Amount"], ["settlementStrategy", "Settlement Strategy"],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <div className="eyebrow mb-1.5">{label}</div>
                    <input
                      value={executiveSummary[key]}
                      onChange={(e) => { setExecutiveSummary((prev) => ({ ...prev, [key]: e.target.value })); markDirty(); }}
                      className="w-full px-3 py-2 rounded-lg border border-line text-sm text-ink focus:outline-none focus:border-brand transition-colors"
                    />
                  </div>
                ))}
                <div>
                  <div className="eyebrow mb-1.5">Liability</div>
                  <textarea
                    value={executiveSummary.liability} rows={3}
                    onChange={(e) => { setExecutiveSummary((prev) => ({ ...prev, liability: e.target.value })); markDirty(); }}
                    className="w-full px-3 py-2 rounded-lg border border-line text-sm text-ink focus:outline-none focus:border-brand transition-colors resize-none"
                  />
                </div>
              </div>
            )}

            {activeTab === "economic" && (
              <div className="p-6">
                <div className="rounded-xl border border-line overflow-hidden">
                  <div className="grid grid-cols-[1fr_140px_120px_40px] gap-2 px-4 py-2.5 bg-offwhite text-xs font-semibold text-[#5B6B78]">
                    <div>Category</div><div>Amount</div><div>Documents</div><div />
                  </div>
                  {economicCategories.map((c, i) => (
                    <div key={c.id} className={`grid grid-cols-[1fr_140px_120px_40px] gap-2 px-4 py-2.5 items-center ${i % 2 === 0 ? "bg-white" : "bg-offwhite"}`}>
                      <input
                        value={c.category}
                        onChange={(e) => { setEconomicCategories((prev) => prev.map((x) => x.id === c.id ? { ...x, category: e.target.value } : x)); markDirty(); }}
                        className="px-2.5 py-1.5 rounded-lg border border-line text-sm text-ink focus:outline-none focus:border-brand transition-colors"
                      />
                      <input
                        type="number"
                        value={c.amount}
                        onChange={(e) => { setEconomicCategories((prev) => prev.map((x) => x.id === c.id ? { ...x, amount: Number(e.target.value) } : x)); markDirty(); }}
                        className="px-2.5 py-1.5 rounded-lg border border-line text-sm text-ink tabular-nums focus:outline-none focus:border-brand transition-colors"
                      />
                      <input
                        type="number"
                        value={c.docCount}
                        onChange={(e) => { setEconomicCategories((prev) => prev.map((x) => x.id === c.id ? { ...x, docCount: Number(e.target.value) } : x)); markDirty(); }}
                        className="px-2.5 py-1.5 rounded-lg border border-line text-sm text-ink tabular-nums focus:outline-none focus:border-brand transition-colors"
                      />
                      <button onClick={() => { setEconomicCategories((prev) => prev.filter((x) => x.id !== c.id)); markDirty(); }} className="p-1.5 rounded-lg hover:bg-tint text-[#DC2626] transition-colors">
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-tint border-t border-line">
                    <div className="text-sm font-bold text-ink">Total Economic Damages</div>
                    <div className="text-sm font-bold text-deep tabular-nums">{formatUSD(liveEconomicTotal)}</div>
                  </div>
                </div>
                <button
                  onClick={() => { setEconomicCategories((prev) => [...prev, { id: uid(), category: "New Category", amount: 0, docCount: 0 }]); markDirty(); }}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-deep hover:text-ink transition-colors mt-3"
                >
                  <Plus className="w-4 h-4" strokeWidth={1.75} /> Add Category
                </button>
              </div>
            )}

            {activeTab === "noneconomic" && (
              <div className="p-6 space-y-4">
                {nonEconomicFactors.map((f) => (
                  <div key={f.id} className="rounded-xl border border-line bg-offwhite p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="card-title text-[15px]">{f.category}</div>
                      <div className="flex items-center gap-2">
                        <span className="secondary-text">Multiplier</span>
                        <input
                          type="number" step="0.05" value={f.multiplier}
                          onChange={(e) => { setNonEconomicFactors((prev) => prev.map((x) => x.id === f.id ? { ...x, multiplier: Number(e.target.value) } : x)); markDirty(); }}
                          className="w-20 px-2.5 py-1.5 rounded-lg border border-line text-sm text-ink tabular-nums focus:outline-none focus:border-brand transition-colors"
                        />
                        <span className="secondary-text">→ {formatUSD(liveEconomicTotal * f.multiplier)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      <div>
                        <div className="eyebrow mb-1">AI Reasoning</div>
                        <textarea
                          value={f.aiReasoning} rows={3}
                          onChange={(e) => { setNonEconomicFactors((prev) => prev.map((x) => x.id === f.id ? { ...x, aiReasoning: e.target.value } : x)); markDirty(); }}
                          className="w-full px-2.5 py-2 rounded-lg border border-line text-sm text-ink focus:outline-none focus:border-brand transition-colors resize-none"
                        />
                      </div>
                      <div>
                        <div className="eyebrow mb-1">Narrative</div>
                        <textarea
                          value={f.narrative} rows={3}
                          onChange={(e) => { setNonEconomicFactors((prev) => prev.map((x) => x.id === f.id ? { ...x, narrative: e.target.value } : x)); markDirty(); }}
                          className="w-full px-2.5 py-2 rounded-lg border border-line text-sm text-ink focus:outline-none focus:border-brand transition-colors resize-none"
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="eyebrow mb-1">Attorney Notes</div>
                      <textarea
                        value={f.notes} rows={2}
                        placeholder="Add internal notes about this factor..."
                        onChange={(e) => { setNonEconomicFactors((prev) => prev.map((x) => x.id === f.id ? { ...x, notes: e.target.value } : x)); markDirty(); }}
                        className="w-full px-2.5 py-2 rounded-lg border border-line text-sm text-ink focus:outline-none focus:border-brand transition-colors resize-none"
                      />
                    </div>
                  </div>
                ))}
                <div className="rounded-xl bg-ink p-4 flex items-center justify-between text-white">
                  <div className="text-sm font-semibold">Non-Economic Total ({liveMultiplierSum.toFixed(2)}×)</div>
                  <div className="text-sm font-bold tabular-nums">{formatUSD(liveNonEconomicTotal)}</div>
                </div>
              </div>
            )}

            {activeTab === "violations" && (
              <div className="p-6 space-y-4">
                <div>
                  <div className="eyebrow mb-2">Attached Statutes</div>
                  <div className="flex flex-wrap gap-1.5">
                    {attachedStatutes.map((s) => (
                      <span key={s} className="pill pill-neutral">
                        {s}
                        <button onClick={() => { setAttachedStatutes((prev) => prev.filter((x) => x !== s)); markDirty(); }} className="ml-1"><X className="w-3 h-3" strokeWidth={1.75} /></button>
                      </span>
                    ))}
                    <button
                      onClick={() => { const s = VIOLATION_CARDS.find((v) => !attachedStatutes.includes(v.statute))?.statute; if (s) { setAttachedStatutes((prev) => [...prev, s]); markDirty(); } }}
                      className="pill pill-neutral hover:bg-wash transition-colors"
                    >
                      <Plus className="w-3 h-3" strokeWidth={1.75} /> Attach Statute
                    </button>
                  </div>
                </div>
                {violations.map((v) => (
                  <div key={v.id} className="rounded-xl border border-line bg-offwhite p-4">
                    <div className="flex items-center justify-between gap-3">
                      <input
                        value={v.title}
                        onChange={(e) => { setViolations((prev) => prev.map((x) => x.id === v.id ? { ...x, title: e.target.value } : x)); markDirty(); }}
                        className="card-title text-[15px] flex-1 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-line focus:border-brand focus:outline-none transition-colors bg-transparent"
                      />
                      <button onClick={() => { setViolations((prev) => prev.filter((x) => x.id !== v.id)); markDirty(); }} className="p-1.5 rounded-lg hover:bg-tint text-[#DC2626] transition-colors shrink-0">
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                    <input
                      value={v.statute}
                      onChange={(e) => { setViolations((prev) => prev.map((x) => x.id === v.id ? { ...x, statute: e.target.value } : x)); markDirty(); }}
                      className="mono-ref mt-1.5 w-full px-2.5 py-1.5 rounded-lg border border-transparent hover:border-line focus:border-brand focus:outline-none transition-colors bg-transparent"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5">
                      <div>
                        <div className="eyebrow mb-1">Supporting Evidence</div>
                        <textarea
                          value={v.evidence} rows={2}
                          onChange={(e) => { setViolations((prev) => prev.map((x) => x.id === v.id ? { ...x, evidence: e.target.value } : x)); markDirty(); }}
                          className="w-full px-2.5 py-2 rounded-lg border border-line text-sm text-ink focus:outline-none focus:border-brand transition-colors resize-none"
                        />
                      </div>
                      <div>
                        <div className="eyebrow mb-1">Attorney Notes</div>
                        <textarea
                          value={v.notes} rows={2}
                          onChange={(e) => { setViolations((prev) => prev.map((x) => x.id === v.id ? { ...x, notes: e.target.value } : x)); markDirty(); }}
                          className="w-full px-2.5 py-2 rounded-lg border border-line text-sm text-ink focus:outline-none focus:border-brand transition-colors resize-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => { setViolations((prev) => [...prev, { id: uid(), title: "New Violation", statute: "", evidence: "", notes: "" }]); markDirty(); }}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-deep hover:text-ink transition-colors"
                >
                  <Plus className="w-4 h-4" strokeWidth={1.75} /> Add Violation
                </button>
              </div>
            )}

            {activeTab === "documents" && (
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-[#8A98A3] absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
                    <input
                      value={docSearch} onChange={(e) => setDocSearch(e.target.value)} placeholder="Search documents..."
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-line text-sm text-ink focus:outline-none focus:border-brand transition-colors"
                    />
                  </div>
                  <div className="relative">
                    <select
                      value={docFilter} onChange={(e) => setDocFilter(e.target.value as any)}
                      className="pl-3 pr-8 py-2 rounded-lg border border-line text-sm text-ink bg-white focus:outline-none focus:border-brand transition-colors appearance-none"
                    >
                      <option value="All">All Categories</option>
                      {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#8A98A3] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
                  </div>
                  <button onClick={() => triggerUpload(null)} className="btn btn-secondary gap-1.5">
                    <UploadCloud className="w-4 h-4" strokeWidth={1.75} /> Upload
                  </button>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChosen} />
                </div>

                {DOC_CATEGORIES.filter((cat) => docFilter === "All" || docFilter === cat).map((cat) => {
                  const docs = filteredDocs.filter((d) => d.category === cat);
                  if (docs.length === 0) return null;
                  return (
                    <div key={cat} className="mb-5 last:mb-0">
                      <div className="eyebrow mb-2">{cat} ({docs.length})</div>
                      <div className="space-y-2">
                        {docs.map((d, i) => (
                          <div key={d.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-line bg-offwhite">
                            <GripVertical className="w-4 h-4 text-[#8A98A3] shrink-0" strokeWidth={1.75} />
                            <FileText className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
                            <div className="min-w-0 flex-1">
                              {renamingId === d.id ? (
                                <input
                                  autoFocus value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") confirmRename(); if (e.key === "Escape") setRenamingId(null); }}
                                  onBlur={confirmRename}
                                  className="w-full px-2 py-1 rounded-md border border-brand text-sm text-ink focus:outline-none"
                                />
                              ) : (
                                <div className="text-sm font-medium text-ink truncate">{d.name}</div>
                              )}
                              <div className="text-xs text-[#8A98A3]">{d.size}</div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => moveDoc(d.id, -1)} disabled={i === 0} className="p-1.5 rounded-lg hover:bg-wash text-ink transition-colors disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5 rotate-180" strokeWidth={1.75} /></button>
                              <button onClick={() => moveDoc(d.id, 1)} disabled={i === docs.length - 1} className="p-1.5 rounded-lg hover:bg-wash text-ink transition-colors disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" strokeWidth={1.75} /></button>
                              <button onClick={() => setPreviewDoc(d)} title="Preview" className="p-1.5 rounded-lg hover:bg-wash text-ink transition-colors"><Eye className="w-3.5 h-3.5" strokeWidth={1.75} /></button>
                              <button onClick={() => startRename(d)} title="Rename" className="p-1.5 rounded-lg hover:bg-wash text-ink transition-colors"><Pencil className="w-3.5 h-3.5" strokeWidth={1.75} /></button>
                              <button onClick={() => triggerUpload(d.id)} title="Replace" className="p-1.5 rounded-lg hover:bg-wash text-ink transition-colors"><RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} /></button>
                              <button onClick={() => removeDoc(d.id)} title="Remove" className="p-1.5 rounded-lg hover:bg-wash text-[#DC2626] transition-colors"><Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {filteredDocs.length === 0 && <p className="secondary-text">No documents match your search.</p>}
              </div>
            )}

            {activeTab === "settlement" && (
              <div className="p-6 space-y-4 max-w-2xl">
                {([
                  ["amount", "Demand Amount"], ["deadline", "Settlement Deadline"], ["recipient", "Recipient"],
                  ["carrier", "Insurance Carrier"], ["adjuster", "Adjuster"],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <div className="eyebrow mb-1.5">{label}</div>
                    <input
                      value={settlement[key]}
                      onChange={(e) => { setSettlement((prev) => ({ ...prev, [key]: e.target.value })); markDirty(); }}
                      className="w-full px-3 py-2 rounded-lg border border-line text-sm text-ink focus:outline-none focus:border-brand transition-colors"
                    />
                  </div>
                ))}
                <button
                  onClick={() => { setSettlement((prev) => ({ ...prev, amount: formatUSD(liveSettlementTotal) })); markDirty(); }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-deep hover:text-ink transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} /> Reset to calculated total ({formatUSD(liveSettlementTotal)})
                </button>
                <div>
                  <div className="eyebrow mb-1.5">Payment Instructions</div>
                  <textarea
                    value={settlement.paymentInstructions} rows={3}
                    onChange={(e) => { setSettlement((prev) => ({ ...prev, paymentInstructions: e.target.value })); markDirty(); }}
                    className="w-full px-3 py-2 rounded-lg border border-line text-sm text-ink focus:outline-none focus:border-brand transition-colors resize-none"
                  />
                </div>
                <div>
                  <div className="eyebrow mb-1.5">Closing Statement</div>
                  <div className="rounded-lg border border-line">
                    <RichTextPanel active initialHtml={settlementClosingHtml} onDirty={markDirty} onSelect={(text, range) => setSelection({ text, range })} panelRef={settlementClosingRef} />
                  </div>
                </div>
              </div>
            )}
          </div>

      {/* ── Version History drawer ── */}
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
                      <span className="text-xs text-ink">Replace current content with this version?</span>
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
                        <div className="eyebrow mb-1">Current Draft</div>
                        <p className="text-ink leading-relaxed">Reflects all edits made in this session, including formatting and structured data changes.</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Document preview modal ── */}
      {previewDoc && (
        <div className="absolute inset-0 bg-ink/30 z-40 flex items-center justify-center p-6" onClick={() => setPreviewDoc(null)}>
          <div className="lg-card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-11 h-11 rounded-xl bg-tint flex items-center justify-center mb-4">
              <FileText className="w-5 h-5 text-deep" strokeWidth={1.75} />
            </div>
            <h2 className="card-title">{previewDoc.name}</h2>
            <div className="secondary-text mt-1">{previewDoc.category} · {previewDoc.size}</div>
            <div className="rounded-xl border border-line bg-offwhite h-64 flex items-center justify-center mt-4">
              <span className="secondary-text">Document preview unavailable in this workspace</span>
            </div>
            <button onClick={() => setPreviewDoc(null)} className="btn btn-secondary w-full justify-center mt-4">Close</button>
          </div>
        </div>
      )}

      {/* ── Floating AI Legal Assistant ── */}
      {!aiOpen && (
        <button
          onClick={() => setAiOpen(true)}
          className="absolute bottom-6 right-6 z-20 inline-flex items-center gap-2 pl-3.5 pr-4 py-2.5 rounded-full bg-ink text-white shadow-lg hover:bg-deep transition-colors"
        >
          <Sparkles className="w-4 h-4 text-brand" strokeWidth={1.75} /> AI Legal Assistant
        </button>
      )}

      {aiOpen && (
        <div className="absolute top-0 right-0 h-full w-[400px] max-w-[92%] bg-white shadow-xl z-30 flex flex-col border-l border-line">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-deep" strokeWidth={1.75} />
              <div>
                <div className="card-title text-[15px]">AI Legal Assistant</div>
                <div className="secondary-text">{AI_CONTEXT[activeTab]}</div>
              </div>
            </div>
            <button onClick={() => setAiOpen(false)} className="p-1.5 hover:bg-tint rounded-lg transition-colors"><X className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} /></button>
          </div>

          <div className="px-5 py-3 border-b border-line">
            <div className="eyebrow mb-2">Selected Text Actions</div>
            <div className="flex flex-wrap gap-1.5">
              {SELECTION_ACTIONS.map((a) => (
                <button key={a.id} onClick={() => runSelectionAction(a.id, a.label)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line text-xs font-medium text-ink hover:bg-tint transition-colors">
                  <a.icon className="w-3.5 h-3.5" strokeWidth={1.75} /> {a.label}
                </button>
              ))}
            </div>
            {selection.text && <p className="text-xs text-[#8A98A3] mt-2 truncate">Selected: "{selection.text}"</p>}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {aiMessages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${m.from === "user" ? "bg-brand text-white" : "bg-tint text-ink"}`}>{m.text}</div>
              </div>
            ))}

            {aiResult && (
              <div className="rounded-xl border border-brand bg-tint p-3.5">
                <div className="eyebrow mb-1.5">AI Result — {aiResult.prompt}</div>
                <p className="text-sm text-ink leading-relaxed">{aiResult.text}</p>
                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                  <button onClick={() => setAiResult(aiResult)} className="btn btn-secondary text-xs px-2.5 py-1.5 gap-1"><Eye className="w-3.5 h-3.5" strokeWidth={1.75} /> Preview</button>
                  <button onClick={replaceSelection} className="btn btn-primary text-xs px-2.5 py-1.5 gap-1"><RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} /> Replace</button>
                  <button onClick={insertBelow} className="btn btn-secondary text-xs px-2.5 py-1.5 gap-1"><Plus className="w-3.5 h-3.5" strokeWidth={1.75} /> Insert Below</button>
                  <button onClick={copyResult} className="btn btn-secondary text-xs px-2.5 py-1.5 gap-1"><Copy className="w-3.5 h-3.5" strokeWidth={1.75} /> Copy</button>
                </div>
              </div>
            )}

            <div className="pt-1">
              <div className="eyebrow mb-2">Suggested Prompts</div>
              <div className="flex flex-wrap gap-1.5">
                {AI_PROMPTS.map((p) => (
                  <button key={p} onClick={() => sendAiMessage(p)} className="px-2.5 py-1.5 rounded-lg border border-line text-xs font-medium text-ink hover:bg-tint transition-colors">{p}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-line p-4 flex items-center gap-2">
            <input
              value={aiInput} onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendAiMessage(aiInput); }}
              placeholder="Ask the AI assistant..."
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-line text-sm text-ink focus:outline-none focus:border-brand transition-colors"
            />
            <button onClick={() => sendAiMessage(aiInput)} className="btn btn-primary px-3.5 py-2.5"><Send className="w-4 h-4" strokeWidth={1.75} /></button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
