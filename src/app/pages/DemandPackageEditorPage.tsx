import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileSignature, Sparkles, Upload, History, Download, Save, Maximize2, Minimize2, X, ArrowRight,
  Undo2, Redo2, Bold, Italic, Underline, Strikethrough, Superscript, Subscript,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, IndentIncrease, IndentDecrease,
  List, ListOrdered, Quote, Link2, Image as ImageIcon, Table2, Minus, Palette, Highlighter, Type,
  ChevronDown, Plus, Trash2, FileText, Eye, RefreshCw, UploadCloud, GripVertical, Pencil, Search,
  SlidersHorizontal, Clock, GitCompare, RotateCcw, Send, Bot, Wand2, Scissors, Copy,
  Loader2, Circle, CheckCircle, Lightbulb, ShieldCheck,
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

// Quick-action suggestion chips, tailored to whichever section is active.
const QUICK_ACTIONS: Record<EditorTabId, string[]> = {
  letter: ["Improve Legal Tone", "Strengthen Liability", "Generate Stronger Demand", "Make More Professional"],
  summary: ["Make More Professional", "Summarize", "Strengthen Liability"],
  medical: ["Summarize", "Expand", "Improve Legal Tone"],
  economic: ["Summarize", "Make More Professional"],
  noneconomic: ["Strengthen Liability", "Summarize"],
  negligence: ["Strengthen Liability", "Add Supporting Case Law", "Rewrite Paragraph"],
  violations: ["Add Supporting Case Law", "Strengthen Liability"],
  documents: ["Summarize", "Expand"],
  settlement: ["Increase Negotiation Pressure", "Make More Professional", "Shorten Section"],
};

// Inline actions shown in a floating toolbar next to a text selection.
const INLINE_ACTIONS = [
  { id: "improve", label: "Improve", icon: Sparkles },
  { id: "rewrite", label: "Rewrite", icon: Wand2 },
  { id: "explain", label: "Explain", icon: Lightbulb },
  { id: "strengthen", label: "Strengthen", icon: ShieldCheck },
  { id: "simplify", label: "Simplify", icon: Scissors },
] as const;

const VERSIONS = [
  { id: "v1", label: "AI Generated", editor: "LECO AI", summary: "Initial package generated from the selected settlement strategy." },
  { id: "v2", label: "Attorney Edit", editor: "Sarah Chen, Esq.", summary: "Edited the medical summary and adjusted non-economic multiplier notes." },
  { id: "v3", label: "Partner Review", editor: "Michael Reyes, Partner", summary: "Strengthened the liability argument and added statutory citations." },
  { id: "v4", label: "Final Version", editor: "Sarah Chen, Esq.", summary: "Finalized settlement demand language and confirmed carrier contact details." },
];

// ── Demand Letter sections — each independently editable, each with its own
// inline "Edit with AI" workflow. Together they read as one continuous letter. ──
const LETTER_SECTIONS_META = [
  { id: "header", title: "Formal Header & Insurer Addressee" },
  { id: "narrative", title: "Statement of Facts & Incident Narrative" },
  { id: "liability", title: "Liability" },
  { id: "medical", title: "Medical Treatment" },
  { id: "economic", title: "Economic Damages" },
  { id: "noneconomic", title: "Non-Economic Damages" },
  { id: "settlement", title: "Settlement Demand" },
] as const;
type LetterSectionId = (typeof LETTER_SECTIONS_META)[number]["id"];

const SECTION_QUICK_ACTIONS: Record<LetterSectionId, string[]> = {
  header: ["Improve Legal Tone", "Correct Formatting", "Update Insurer Details", "Professional Tone"],
  narrative: ["Strengthen Liability", "Improve Timeline", "Add Clinical Details", "Make More Persuasive"],
  liability: ["Strengthen Liability", "Cite Supporting Evidence", "Make More Persuasive", "Improve Legal Tone"],
  medical: ["Summarize Records", "Add Clinical Language", "Improve Medical Narrative"],
  economic: ["Strengthen Economic Damages", "Add Supporting Evidence"],
  noneconomic: ["Increase Pain & Suffering Argument", "Add Supporting Evidence"],
  settlement: ["Increase Negotiation Pressure", "Strengthen Closing", "Cite Policy Limits", "More Assertive"],
};

const SECTION_GENERATION_STEPS = ["Analyzing section...", "Reviewing legal language...", "Applying attorney instructions...", "Generating revised draft..."];
const CHANGE_CHECKLIST = ["Improved legal wording", "Enhanced structure", "Applied attorney instructions", "Preserved legal meaning"];

function stripHtml(html: string) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || "").replace(/\s+/g, " ").trim();
}

// Deterministic, instruction-aware revision: appends one grounded sentence
// rather than rewriting the section, so verified merge-field data (dollar
// amounts) already inside the section is never disturbed.
function generateSectionRevision(originalHtml: string, instruction: string) {
  const lower = instruction.toLowerCase();
  let addition = "This section has been refined to more directly support the demand.";
  if (/insurer|update/.test(lower)) addition = "Insurer contact and policy details have been confirmed and updated.";
  else if (/format/.test(lower)) addition = "Formatting and addressee details have been verified for accuracy.";
  else if (/timeline/.test(lower)) addition = "The sequence of events has been clarified to present a clear chronological account.";
  else if (/tone|professional/.test(lower)) addition = "This correspondence is submitted in the interest of a prompt and professional resolution of this claim.";
  else if (/clinical|medical|summariz/.test(lower)) addition = "Treating providers have consistently documented these findings throughout the course of care.";
  else if (/persuasive/.test(lower)) addition = "This conclusion is further corroborated by the verified evidence enclosed with this correspondence.";
  else if (/pain|suffering/.test(lower)) addition = "The impact on daily function and quality of life has been significant and ongoing.";
  else if (/policy/.test(lower)) addition = "This demand is made with full awareness of the applicable policy limits, which further supports prompt resolution.";
  else if (/evidence/.test(lower)) addition = "This is fully supported by the enclosed documentation on file.";
  else if (/liability|assertive|pressure|closing|strengthen/.test(lower)) addition = "The evidence on file leaves no reasonable basis for dispute on this point.";
  return `${originalHtml}<p>${addition}</p>`;
}

// Word-level diff (simple LCS) so Preview Changes can highlight what the AI
// actually added — plain-text only, since these sections are short paragraphs.
function wordDiff(a: string, b: string) {
  const aw = a.split(/(\s+)/).filter(Boolean);
  const bw = b.split(/(\s+)/).filter(Boolean);
  const m = aw.length, n = bw.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = aw[i - 1] === bw[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const ops: { type: "same" | "added" | "removed"; text: string }[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (aw[i - 1] === bw[j - 1]) { ops.unshift({ type: "same", text: aw[i - 1] }); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) { ops.unshift({ type: "removed", text: aw[i - 1] }); i--; }
    else { ops.unshift({ type: "added", text: bw[j - 1] }); j--; }
  }
  while (i > 0) { ops.unshift({ type: "removed", text: aw[i - 1] }); i--; }
  while (j > 0) { ops.unshift({ type: "added", text: bw[j - 1] }); j--; }
  return ops;
}

// Reassemble a single saved HTML blob from labeled section markers, or fall
// back to the defaults (e.g. the very first time a letter is generated).
const SECTION_MARKER = (id: string) => `<!--section:${id}-->`;
function buildCombinedLetterHtml(sections: { id: string; html: string }[]) {
  return sections.map((s) => `${SECTION_MARKER(s.id)}${s.html}`).join("");
}
function parseLetterSections(combined: string | undefined, defaults: { id: LetterSectionId; title: string; html: string }[]) {
  if (!combined) return defaults;
  const parts = combined.split(/<!--section:([a-z]+)-->/);
  if (parts.length < 3) return defaults;
  const map: Record<string, string> = {};
  for (let i = 1; i < parts.length; i += 2) map[parts[i]] = parts[i + 1];
  return defaults.map((d) => ({ ...d, html: map[d.id] ?? d.html }));
}

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
  active, initialHtml, onDirty, onSelect, panelRef, className = "",
}: {
  active: boolean;
  initialHtml: string;
  onDirty: () => void;
  onSelect: (text: string, range: Range | null) => void;
  panelRef: React.RefObject<HTMLDivElement>;
  className?: string;
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
      className={`${active ? "block" : "hidden"} min-h-[360px] px-6 py-5 text-sm text-ink leading-relaxed focus:outline-none [&_h1]:page-title [&_h1]:mb-2 [&_h2]:section-header [&_h2]:mb-2 [&_h3]:card-title [&_h3]:mb-1.5 [&_p]:mb-3 [&_blockquote]:border-l-2 [&_blockquote]:border-brand [&_blockquote]:pl-3 [&_blockquote]:text-deep [&_blockquote]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-deep [&_a]:underline ${className}`}
    />
  );
}

// One Demand Letter section: its own editable text plus an inline,
// section-scoped "Edit with AI" workflow (generate → review → preview → apply).
// The right-hand AI Legal Assistant sidebar is untouched by any of this.
function LetterSection({
  meta, initialHtml, registerRef, onDirty, onSelect,
}: {
  meta: (typeof LETTER_SECTIONS_META)[number];
  initialHtml: string;
  registerRef: (id: LetterSectionId, el: HTMLDivElement | null) => void;
  onDirty: () => void;
  onSelect: (text: string, range: Range | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current && ref.current) {
      ref.current.innerHTML = initialHtml;
      initialized.current = true;
    }
    registerRef(meta.id, ref.current);
    return () => registerRef(meta.id, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [aiOpen, setAiOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [phase, setPhase] = useState<"idle" | "generating" | "review" | "preview" | "applied">("idle");
  const [instruction, setInstruction] = useState("");
  const [genStep, setGenStep] = useState(0);
  const [revised, setRevised] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== "generating") return;
    if (genStep >= SECTION_GENERATION_STEPS.length) {
      const t = setTimeout(() => {
        setRevised(generateSectionRevision(ref.current?.innerHTML ?? initialHtml, instruction));
        setPhase("review");
      }, 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setGenStep((s) => s + 1), 480);
    return () => clearTimeout(t);
  }, [phase, genStep]);

  const runGenerate = (prompt?: string) => {
    const value = prompt ?? instruction;
    if (!value.trim()) return;
    setInstruction(value);
    setGenStep(0);
    setPhase("generating");
  };
  const discard = () => { setPhase("idle"); setRevised(null); setInstruction(""); };
  const applyChanges = () => {
    if (!revised || !ref.current) return;
    ref.current.innerHTML = revised;
    onDirty();
    setPhase("applied");
    setTimeout(() => {
      setAiOpen(false);
      setPhase("idle");
      setRevised(null);
      setInstruction("");
    }, 1200);
  };

  const captureSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !ref.current?.contains(sel.anchorNode)) return;
    onSelect(sel.toString(), sel.getRangeAt(0).cloneRange());
  };

  const original = ref.current?.innerHTML ?? initialHtml;

  return (
    <div className={`pt-4 mt-4 border-t border-line first:border-t-0 first:pt-0 first:mt-0 rounded-lg transition-colors ${focused || aiOpen ? "bg-wash/60 -mx-3 px-3" : ""}`}>
      <div className="flex items-center justify-between gap-3 mb-1.5 min-h-[24px]">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8A98A3]">{meta.title}</span>
        {(focused || aiOpen) && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="pill pill-neutral text-[10px]">Attorney Editing Focus</span>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setAiOpen((v) => !v)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${aiOpen ? "border-brand bg-tint text-deep" : "border-line text-deep hover:bg-tint"}`}
            >
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} /> Edit with AI
            </button>
          </div>
        )}
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={onDirty}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onMouseUp={captureSelection}
        onKeyUp={captureSelection}
        className="text-sm text-ink leading-relaxed focus:outline-none [&_p]:mb-3 last:[&_p]:mb-0"
      />

      {/* Inline AI editor — expands beneath the section, pushing content down */}
      <div className={`grid transition-all duration-300 ease-out ${aiOpen ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="rounded-xl border border-line bg-offwhite p-4">
            {phase === "idle" && (
              <>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-deep" strokeWidth={1.75} />
                  <div className="card-title text-[15px]">AI Section Editor</div>
                </div>
                <div className="secondary-text mt-1">Editing: <span className="font-semibold text-ink">{meta.title}</span></div>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  rows={2}
                  placeholder="Describe how you'd like to improve this section..."
                  className="w-full mt-3 px-3 py-2 rounded-lg border border-line bg-white text-sm text-ink focus:outline-none focus:border-brand transition-colors resize-none"
                />
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {SECTION_QUICK_ACTIONS[meta.id].map((a) => (
                    <button key={a} onClick={() => setInstruction(a)} className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${instruction === a ? "border-brand bg-tint text-deep" : "border-line bg-white text-ink hover:bg-tint"}`}>
                      {a}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => runGenerate()}
                  disabled={!instruction.trim()}
                  className="btn btn-primary w-full justify-center gap-2 mt-3 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Generate Changes <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </>
            )}

            {phase === "generating" && (
              <div className="py-1 space-y-2">
                {SECTION_GENERATION_STEPS.map((label, i) => {
                  const done = i < genStep, active = i === genStep;
                  return (
                    <div key={label} className={`flex items-center gap-2 text-sm transition-opacity duration-300 ${done || active ? "opacity-100" : "opacity-30"}`}>
                      {done ? (
                        <CheckCircle className="w-4 h-4 text-brand shrink-0" strokeWidth={1.75} />
                      ) : active ? (
                        <Loader2 className="w-4 h-4 text-brand shrink-0 animate-spin" strokeWidth={1.75} />
                      ) : (
                        <Circle className="w-4 h-4 text-[#CBD5DD] shrink-0" strokeWidth={1.75} />
                      )}
                      <span className={done || active ? "text-ink font-medium" : "text-[#8A98A3]"}>{label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {phase === "review" && revised && (
              <>
                <div className="card-title text-[15px]">Changes Ready</div>
                <ul className="mt-2 space-y-1">
                  {CHANGE_CHECKLIST.map((c) => (
                    <li key={c} className="flex items-center gap-2 text-sm text-ink">
                      <CheckCircle className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} /> {c}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={discard} className="btn btn-secondary flex-1 justify-center">Discard</button>
                  <button onClick={() => setPhase("preview")} className="btn btn-secondary flex-1 justify-center">Preview Changes</button>
                  <button onClick={applyChanges} className="btn btn-primary flex-1 justify-center">Apply Changes</button>
                </div>
              </>
            )}

            {phase === "preview" && revised && (
              <>
                <div className="card-title text-[15px] mb-2">Preview Changes</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="eyebrow mb-1.5">Original Section</div>
                    <div className="rounded-lg border border-line bg-white p-3 text-xs text-ink leading-relaxed max-h-56 overflow-y-auto">
                      {wordDiff(stripHtml(original), stripHtml(revised)).filter((op) => op.type !== "added").map((op, i) => (
                        <span key={i} className={op.type === "removed" ? "bg-red-100 text-red-700 line-through" : ""}>{op.text}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="eyebrow mb-1.5">AI Revised Section</div>
                    <div className="rounded-lg border border-brand bg-white p-3 text-xs text-ink leading-relaxed max-h-56 overflow-y-auto">
                      {wordDiff(stripHtml(original), stripHtml(revised)).filter((op) => op.type !== "removed").map((op, i) => (
                        <span key={i} className={op.type === "added" ? "bg-green-100 text-green-800 font-medium" : ""}>{op.text}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={discard} className="btn btn-secondary flex-1 justify-center">Discard</button>
                  <button onClick={applyChanges} className="btn btn-primary flex-1 justify-center">Apply Changes</button>
                </div>
              </>
            )}

            {phase === "applied" && (
              <div className="flex items-center gap-2 text-sm text-deep font-semibold py-1">
                <CheckCircle className="w-4 h-4 text-brand" strokeWidth={1.75} /> Section Updated
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface DemandPackageEditorPageProps {
  pkg: DemandPackage;
  model: WorkspaceModel;
  onClose: () => void;
  // Drafting-stage mode: only the Demand Letter exists yet, so only that tab
  // is shown. Saving hands the letter's HTML (and scroll position, so the
  // attorney returns to where they left off) back to the caller.
  letterOnly?: boolean;
  initialLetterHtml?: string;
  initialScrollTop?: number;
  onSaveLetter?: (html: string, scrollTop: number) => void;
}

const SAVE_STEPS = ["Saving Draft...", "Updating Demand...", "Creating Version {v}...", "Saved Successfully"];

export function DemandPackageEditorPage({
  pkg, model, onClose,
  letterOnly = false, initialLetterHtml, initialScrollTop, onSaveLetter,
}: DemandPackageEditorPageProps) {
  const [activeTab, setActiveTab] = useState<EditorTabId>("letter");
  const [fullScreen, setFullScreen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [saveFlowStep, setSaveFlowStep] = useState<number | null>(null);

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

  // ── Explicit "Save Changes" flow — a short sequence, then hands the saved
  // letter back to the caller (who creates/updates the package record). ──
  const nextVersionNumber = Math.floor(parseFloat(pkg.version || "0")) + 1;
  useEffect(() => {
    if (saveFlowStep === null) return;
    if (saveFlowStep >= SAVE_STEPS.length) {
      const t = setTimeout(() => {
        setSaveFlowStep(null);
        setSaveState("saved");
        setLastSavedAt(Date.now());
        const combinedLetterHtml = buildCombinedLetterHtml(
          LETTER_SECTIONS_META.map((m) => ({ id: m.id, html: letterSectionRefs.current[m.id]?.innerHTML ?? "" }))
        );
        onSaveLetter?.(combinedLetterHtml, contentScrollRef.current?.scrollTop ?? 0);
      }, 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setSaveFlowStep((s) => (s ?? 0) + 1), 450);
    return () => clearTimeout(t);
  }, [saveFlowStep]);
  const runSaveFlow = () => setSaveFlowStep(0);

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
  const letterSectionRefs = useRef<Partial<Record<LetterSectionId, HTMLDivElement | null>>>({});
  const registerLetterSectionRef = (id: LetterSectionId, el: HTMLDivElement | null) => { letterSectionRefs.current[id] = el; };
  const contentScrollRef = useRef<HTMLDivElement>(null);
  // Restore exactly where the attorney left off when reopening a draft letter.
  useEffect(() => {
    if (initialScrollTop && contentScrollRef.current) contentScrollRef.current.scrollTop = initialScrollTop;
  }, [initialScrollTop]);
  const medicalRef = useRef<HTMLDivElement>(null);
  const negligenceRef = useRef<HTMLDivElement>(null);
  const settlementClosingRef = useRef<HTMLDivElement>(null);

  // The letter is stored as one blob (marker-delimited) but edited as 7
  // independent sections. Split once on mount; each section owns its DOM.
  const letterSections = useMemo(() => parseLetterSections(initialLetterHtml, [
    {
      id: "header" as const, title: "Formal Header & Insurer Addressee", html: `
      <p style="text-align:right;margin-bottom:28px;">${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
      <p style="margin-bottom:2px;">Claims Department</p>
      <p style="margin-bottom:2px;">${settlement.carrier}</p>
      <p style="margin-bottom:24px;">Via Certified Mail &amp; Email</p>
      <p style="font-weight:600;margin-bottom:24px;">Re:&nbsp; Settlement Demand — ${model.plaintiff} v. ${model.defendant}<br/>Date of Loss: ${model.incidentDate}&nbsp;&nbsp;|&nbsp;&nbsp;Claimant: ${model.plaintiff}</p>
      <p>Dear Claims Representative:</p>
    `},
    {
      id: "narrative" as const, title: "Statement of Facts & Incident Narrative", html: `
      <p>This firm represents ${model.plaintiff} in connection with a collision that occurred on ${model.incidentDate} in ${model.jurisdiction}. ${model.defendant}'s commercial vehicle failed to yield the right-of-way and entered the intersection in violation of applicable traffic statutes, striking the vehicle occupied by ${model.plaintiff}.</p>
    `},
    {
      id: "liability" as const, title: "Liability", html: `
      <p>Liability rests squarely with your insured. The responding officer's report, scene reconstruction, and corroborating witness statements establish that ${model.defendant} entered the intersection against ${model.plaintiff}'s right-of-way. No credible comparative-fault argument is available on these facts.</p>
    `},
    {
      id: "medical" as const, title: "Medical Treatment", html: `
      <p>As a direct result of this collision, ${model.plaintiff} sustained a two-level cervical herniation requiring ongoing medical treatment, including emergency evaluation, diagnostic imaging, and a supervised course of physical therapy. Treating physicians have documented persistent pain and functional limitation consistent with the imaging findings.</p>
    `},
    {
      id: "economic" as const, title: "Economic Damages", html: `
      <p>Verified economic damages total <span data-field="economicTotal">${formatUSD(liveEconomicTotal)}</span>, comprising medical bills, lost wages, future medical care, and rehabilitation — all fully documented in the enclosed records.</p>
    `},
    {
      id: "noneconomic" as const, title: "Non-Economic Damages", html: `
      <p>Given the severity and permanence of the injuries, non-economic damages are valued at <span data-field="nonEconomicTotal">${formatUSD(liveNonEconomicTotal)}</span>, reflecting the pain, suffering, and diminished quality of life ${model.plaintiff} has experienced and will continue to experience.</p>
    `},
    {
      id: "settlement" as const, title: "Settlement Demand", html: `
      <p>We demand payment of <span data-field="settlementTotal">${formatUSD(liveSettlementTotal)}</span> in full settlement of this claim within ${settlement.deadline}. We trust ${settlement.carrier} will give this matter prompt attention.</p>
      <p style="margin-top:8px;">Sincerely,</p>
      <p style="margin-top:48px;margin-bottom:2px;">Sarah Chen, Esq.</p>
      <p style="margin-bottom:2px;">Counsel for ${model.plaintiff}</p>
    `},
  ]), []); // seeded once (split from a saved draft when re-opening); live totals sync via the effect below

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

  // Keep merge-field spans in the Demand Letter in sync with live totals —
  // across whichever section each field actually lives in.
  useEffect(() => {
    const set = (field: string, value: string) => {
      Object.values(letterSectionRefs.current).forEach((root) => {
        root?.querySelectorAll(`[data-field="${field}"]`).forEach((el) => { el.textContent = value; });
      });
    };
    set("economicTotal", formatUSD(liveEconomicTotal));
    set("nonEconomicTotal", formatUSD(liveNonEconomicTotal));
    set("settlementTotal", formatUSD(liveSettlementTotal));
  }, [liveEconomicTotal, liveNonEconomicTotal, liveSettlementTotal]);

  // ── AI assistant — permanent sidebar, always understands the active section ──
  type ChatMsg = { id: string; from: "ai" | "user"; text: string; streaming?: boolean };
  const [aiMessages, setAiMessages] = useState<ChatMsg[]>([
    { id: "seed", from: "ai", text: "I'm reviewing this demand package with you. Ask me to rewrite a section, find supporting evidence, or strengthen the liability argument." },
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const [selection, setSelection] = useState<{ text: string; range: Range | null }>({ text: "", range: null });
  const [aiResult, setAiResult] = useState<{ prompt: string; text: string } | null>(null);
  const [inlineToolbar, setInlineToolbar] = useState<{ x: number; y: number } | null>(null);

  // Shared by every rich-text panel: captures the selection for the AI
  // sidebar and positions the inline floating action toolbar above it.
  const handleTextSelect = (text: string, range: Range | null) => {
    setSelection({ text, range });
    if (text && range) {
      const rect = range.getBoundingClientRect();
      setInlineToolbar({ x: rect.left + rect.width / 2, y: rect.top });
    } else {
      setInlineToolbar(null);
    }
  };

  // Dismiss the inline toolbar on scroll or on any click outside it.
  useEffect(() => {
    const dismiss = () => setInlineToolbar(null);
    window.addEventListener("scroll", dismiss, true);
    return () => window.removeEventListener("scroll", dismiss, true);
  }, []);

  // Progressively reveal the AI's reply, like a live-typed response.
  const streamAiResponse = (fullText: string) => {
    const id = uid();
    setAiMessages((prev) => [...prev, { id, from: "ai", text: "", streaming: true }]);
    const chunk = Math.max(3, Math.round(fullText.length / 35));
    let i = 0;
    const tick = () => {
      i = Math.min(fullText.length, i + chunk);
      setAiMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: fullText.slice(0, i) } : m)));
      if (i < fullText.length) setTimeout(tick, 20);
      else setAiMessages((prev) => prev.map((m) => (m.id === id ? { ...m, streaming: false } : m)));
    };
    tick();
  };

  // Context-aware reply — grounded in the current section, damages, defendant,
  // policy limits, medical evidence, settlement amount, and case documents.
  const buildAiResponse = (prompt: string) => {
    switch (activeTab) {
      case "letter":
        return `Looking at the Demand Letter: it currently seeks ${formatUSD(liveSettlementTotal)} from ${settlement.carrier} on behalf of ${model.plaintiff}, citing ${model.defendant}'s liability. I can strengthen the liability paragraph, tighten the tone, or make the closing more assertive — just tell me which.`;
      case "summary":
        return `The Executive Summary lists ${model.plaintiff} v. ${model.defendant} with a demand of ${executiveSummary.demandAmount}. I can make the liability line read more persuasively or sharpen the settlement-strategy framing.`;
      case "medical":
        return `The Medical Summary should tie the treatment record directly to the injuries claimed. I can tighten the timeline, or expand on the permanence of the injuries for more weight.`;
      case "economic":
        return `Economic damages total ${formatUSD(liveEconomicTotal)} across ${economicCategories.length} verified categories, led by ${economicCategories[0]?.category}. I can explain how a category was calculated or flag one that needs stronger documentation.`;
      case "noneconomic":
        return `Non-economic damages are valued at ${formatUSD(liveNonEconomicTotal)} using a ${liveMultiplierSum.toFixed(2)}× multiplier. I can reinforce the reasoning behind the highest-weighted factors.`;
      case "negligence":
        return `The negligence argument ties ${model.defendant}'s breach directly to ${model.plaintiff}'s injuries. I can strengthen the causation language or add supporting case law.`;
      case "violations":
        return `Based on the case facts on file, I can recommend additional statutes or federal regulations that reinforce the violation analysis.`;
      case "documents":
        return `You have ${documents.length} supporting documents on file across all categories. I can help spot gaps in the medical, police, or expert evidence.`;
      case "settlement":
        return `The Settlement Demand asks for ${settlement.amount} from ${settlement.carrier}, with a ${settlement.deadline} deadline. I can add urgency to the closing statement or firm up the tone.`;
      default:
        return `I can help rewrite, strengthen, or shorten this section — just tell me what you'd like.`;
    }
  };

  const sendAiMessage = (text: string) => {
    if (!text.trim()) return;
    setAiMessages((prev) => [...prev, { id: uid(), from: "user", text }]);
    setAiInput("");
    setAiThinking(true);
    setTimeout(() => {
      setAiThinking(false);
      streamAiResponse(buildAiResponse(text));
    }, 650);
  };

  // Triggered from the inline floating toolbar next to a text selection.
  const runSelectionAction = (actionId: string, label: string) => {
    if (!selection.text) return;
    let result = selection.text;
    if (actionId === "improve") result = `${selection.text.replace(/\.$/, "")} — refined for clarity and stronger legal phrasing.`;
    else if (actionId === "rewrite") result = `${selection.text.replace(/\.$/, "")}, reframed for maximum clarity and impact.`;
    else if (actionId === "explain") result = `This passage matters because it directly ties ${model.defendant}'s conduct to the damages claimed, reinforcing the causation element of the case.`;
    else if (actionId === "strengthen") result = `${selection.text} The evidence here is unequivocal and leaves no reasonable basis for dispute.`;
    else if (actionId === "simplify") result = selection.text.split(" ").slice(0, Math.max(6, Math.round(selection.text.split(" ").length * 0.6))).join(" ") + ".";
    setAiMessages((prev) => [...prev, { id: uid(), from: "user", text: `${label}: "${selection.text.slice(0, 60)}${selection.text.length > 60 ? "…" : ""}"` }]);
    setInlineToolbar(null);
    setAiThinking(true);
    setTimeout(() => {
      setAiThinking(false);
      streamAiResponse(result);
      setAiResult({ prompt: label, text: result });
    }, 650);
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
    const headerEl = letterSectionRefs.current.header;
    if (!v || !headerEl) return;
    headerEl.innerHTML = `<p><em>[Restored from "${v.label}" — ${v.summary}]</em></p>` + headerEl.innerHTML;
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
    <div className={`fixed inset-0 z-[95] bg-ink/50 flex items-center justify-center transition-all duration-200 ${fullScreen ? "p-0" : "p-6"}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className={`relative bg-white flex flex-col overflow-hidden shadow-2xl border border-line transition-all duration-200 ${fullScreen ? "w-screen h-screen rounded-none border-0" : "w-full max-w-[1280px] h-[88vh] rounded-2xl"}`}
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
              <button onClick={onSaveLetter ? runSaveFlow : () => { setSaveState("saving"); setTimeout(() => { setSaveState("saved"); setLastSavedAt(Date.now()); }, 500); }} className="btn btn-primary gap-1.5">
                <Save className="w-4 h-4" strokeWidth={1.75} /> Save Changes
              </button>
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
          {!letterOnly && (
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
          )}
          {letterOnly && (
            <div className="px-6 py-3 border-b border-line bg-offwhite">
              <span className="eyebrow text-deep">Demand Letter</span>
              <span className="secondary-text ml-2">Only the demand letter is drafted at this stage — the full package is assembled later.</span>
            </div>
          )}

          {/* ── Body: document (75%) + permanent AI sidebar (25%) ── */}
          <div className="flex-1 flex overflow-hidden">
          <div ref={contentScrollRef} className="flex-[65] overflow-y-auto">
            {/* Rich-text tabs stay mounted (hidden via CSS) so state survives tab switches */}
            <div className={activeTab === "letter" ? "flex justify-center bg-wash py-8 px-4" : "hidden"}>
              <div className="w-full max-w-[760px] bg-white shadow-md border border-line font-serif px-14 py-14">
                {letterSections.map((s) => (
                  <LetterSection
                    key={s.id}
                    meta={s}
                    initialHtml={s.html}
                    registerRef={registerLetterSectionRef}
                    onDirty={markDirty}
                    onSelect={handleTextSelect}
                  />
                ))}
              </div>
            </div>
            {!letterOnly && (
              <>
            <RichTextPanel active={activeTab === "medical"} initialHtml={medicalHtml} onDirty={markDirty} onSelect={handleTextSelect} panelRef={medicalRef} />
            <RichTextPanel active={activeTab === "negligence"} initialHtml={negligenceHtml} onDirty={markDirty} onSelect={handleTextSelect} panelRef={negligenceRef} />

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
                    <RichTextPanel active initialHtml={settlementClosingHtml} onDirty={markDirty} onSelect={handleTextSelect} panelRef={settlementClosingRef} />
                  </div>
                </div>
              </div>
            )}
              </>
            )}
          </div>

          {/* ── Permanent AI sidebar — 25% ── */}
          <div className="flex-[35] min-w-[320px] max-w-[480px] border-l border-line flex flex-col bg-white shrink-0">
            <div className="flex items-center justify-between gap-2 px-4 py-3.5 border-b border-line shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-tint flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-deep" strokeWidth={1.75} />
                </div>
                <div className="card-title text-sm truncate">AI Legal Assistant</div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#15803D] shrink-0">
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-[#22C55E] opacity-75 animate-ping" />
                  <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                </span>
                Active
              </span>
            </div>

            <div className="px-4 py-2.5 border-b border-line bg-offwhite shrink-0">
              <div className="eyebrow">Editing</div>
              <div className="text-sm font-semibold text-ink mt-0.5">{EDITOR_TABS.find((t) => t.id === activeTab)?.label}</div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {aiMessages.map((m) => (
                <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed ${m.from === "user" ? "bg-brand text-white" : "bg-tint text-ink"}`}>
                    {m.text}
                    {m.streaming && <span className="inline-block w-1 h-3 bg-deep ml-0.5 align-middle animate-pulse" />}
                  </div>
                </div>
              ))}

              {aiThinking && (
                <div className="flex justify-start">
                  <div className="rounded-xl px-3 py-2.5 bg-tint flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-deep/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-deep/50 animate-bounce" style={{ animationDelay: "120ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-deep/50 animate-bounce" style={{ animationDelay: "240ms" }} />
                  </div>
                </div>
              )}

              {aiResult && (
                <div className="rounded-xl border border-brand bg-tint p-3">
                  <div className="eyebrow mb-1">AI Result — {aiResult.prompt}</div>
                  <p className="text-xs text-ink leading-relaxed">{aiResult.text}</p>
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    <button onClick={replaceSelection} className="btn btn-primary text-[11px] px-2 py-1 gap-1"><RefreshCw className="w-3 h-3" strokeWidth={1.75} /> Replace</button>
                    <button onClick={insertBelow} className="btn btn-secondary text-[11px] px-2 py-1 gap-1"><Plus className="w-3 h-3" strokeWidth={1.75} /> Insert Below</button>
                    <button onClick={copyResult} className="btn btn-secondary text-[11px] px-2 py-1 gap-1"><Copy className="w-3 h-3" strokeWidth={1.75} /> Copy</button>
                    <button onClick={() => setAiResult(null)} className="text-[11px] font-medium text-[#8A98A3] hover:text-ink px-1">Dismiss</button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-line shrink-0">
              <div className="eyebrow mb-1.5">Quick Actions</div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ACTIONS[activeTab].map((p) => (
                  <button key={p} onClick={() => sendAiMessage(p)} className="px-2.5 py-1.5 rounded-lg border border-line text-xs font-medium text-ink hover:bg-tint transition-colors">{p}</button>
                ))}
              </div>
            </div>

            <div className="border-t border-line p-3 flex items-center gap-1.5 shrink-0">
              <input
                value={aiInput} onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendAiMessage(aiInput); }}
                placeholder="Ask AI to improve this section..."
                className="flex-1 px-3 py-2 rounded-lg border border-line text-xs text-ink focus:outline-none focus:border-brand transition-colors"
              />
              <button onClick={() => sendAiMessage(aiInput)} className="btn btn-primary px-2.5 py-2"><Send className="w-3.5 h-3.5" strokeWidth={1.75} /></button>
            </div>
          </div>
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

      {/* ── Inline floating action toolbar — appears next to a text selection ── */}
      {inlineToolbar && selection.text && (
        <div
          className="fixed z-[96] -translate-x-1/2 -translate-y-full flex items-center gap-0.5 rounded-lg border border-line bg-ink shadow-2xl p-1"
          style={{ left: inlineToolbar.x, top: inlineToolbar.y - 8 }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {INLINE_ACTIONS.map((a) => (
            <button
              key={a.id}
              onClick={() => runSelectionAction(a.id, a.label)}
              title={a.label}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-white text-xs font-medium hover:bg-white/10 transition-colors"
            >
              <a.icon className="w-3.5 h-3.5" strokeWidth={1.75} /> {a.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Save Changes flow — sequential steps, then hands off to the caller ── */}
      {saveFlowStep !== null && (
        <div className="absolute inset-0 z-40 bg-white/95 flex items-center justify-center">
          <div className="w-full max-w-xs text-center">
            <div className="w-12 h-12 rounded-2xl bg-tint flex items-center justify-center mx-auto mb-5">
              <Save className="w-5 h-5 text-deep" strokeWidth={1.75} />
            </div>
            <div className="space-y-2.5 text-left">
              {SAVE_STEPS.map((label, i) => {
                const text = label.replace("{v}", String(nextVersionNumber));
                const done = i < saveFlowStep;
                const active = i === saveFlowStep;
                const isLast = i === SAVE_STEPS.length - 1;
                return (
                  <div key={label} className={`flex items-center gap-2.5 text-sm transition-opacity duration-300 ${done || active ? "opacity-100" : "opacity-30"}`}>
                    {done || (active && isLast) ? (
                      <CheckCircle className="w-4 h-4 text-brand shrink-0" strokeWidth={1.75} />
                    ) : active ? (
                      <Loader2 className="w-4 h-4 text-brand shrink-0 animate-spin" strokeWidth={1.75} />
                    ) : (
                      <Circle className="w-4 h-4 text-[#CBD5DD] shrink-0" strokeWidth={1.75} />
                    )}
                    <span className={done || active ? "text-ink font-medium" : "text-[#8A98A3]"}>{text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
