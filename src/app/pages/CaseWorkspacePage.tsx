import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FileSignature, FolderOpen, Settings2, Loader2, CheckCircle, Circle } from "lucide-react";
import type { AnalysisFinding, CaseDocument, DemandPackage } from "../types/case";
import {
  WorkspaceModel,
  OverviewTab, MedicalTimelineTab, EconomicDamagesTab, NonEconomicDamagesTab,
  LiabilityAnalysisTab, EvidenceRepositoryTab, DemandPackageTab, NegotiationTab,
} from "../workspace/WorkspaceTabs";
import { DemandSpacePage } from "./DemandSpacePage";

interface CaseWorkspacePageProps {
  caseData?: any;
  analysisFindings?: AnalysisFinding[];
  documents?: CaseDocument[];
  onBackToIntake?: () => void;
  onNavigateToValuation?: () => void;
}

const TABS = [
  { id: "overview", label: "Case Overview" },
  { id: "medical", label: "Chronology" },
  { id: "economic", label: "Damages Analysis" },
  { id: "noneconomic", label: "Negligence" },
  { id: "liability", label: "Violations" },
  { id: "evidence", label: "Case Journey" },
  { id: "demand", label: "Intelligence" },
  { id: "negotiation", label: "Negotiations" },
];

// Canonical valuation baseline (kept consistent with the Valuation stage).
const BASE_ECONOMIC = 161450;
const MULTIPLIER = 9;

// Sequential steps shown while a demand package is being generated.
const GENERATE_STEPS = [
  "Collecting verified medical records...",
  "Compiling economic damages...",
  "Calculating non-economic damages...",
  "Linking negligence findings...",
  "Applying legal statutes...",
  "Matching historical cases...",
  "Drafting demand letter...",
  "Organizing supporting exhibits...",
  "Building final demand package...",
];

export function CaseWorkspacePage({ caseData, analysisFindings = [], documents = [], onBackToIntake, onNavigateToValuation }: CaseWorkspacePageProps) {
  const [activeTab, setActiveTab] = useState("overview");

  // ── Generate Demand → Demand Space workflow ──
  const [demandPackages, setDemandPackages] = useState<DemandPackage[]>([]);
  const [genPhase, setGenPhase] = useState<"idle" | "running" | "success">("idle");
  const [genStep, setGenStep] = useState(0);
  const [pendingGen, setPendingGen] = useState<{ strategyLabel: string; amount: number } | null>(null);

  const startGenerateDemand = (strategyLabel: string, amount: number) => {
    setPendingGen({ strategyLabel, amount });
    setGenStep(0);
    setGenPhase("running");
  };

  // Advance one processing step at a time; hand off to "success" at the end.
  useEffect(() => {
    if (genPhase !== "running") return;
    if (genStep >= GENERATE_STEPS.length) {
      const t = setTimeout(() => setGenPhase("success"), 300);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setGenStep((s) => s + 1), 520);
    return () => clearTimeout(t);
  }, [genPhase, genStep]);

  // After the success beat, create the package and jump into Demand Space.
  useEffect(() => {
    if (genPhase !== "success" || !pendingGen) return;
    const t = setTimeout(() => {
      setDemandPackages((prev) => {
        const number = prev.length + 1;
        const pkg: DemandPackage = {
          id: `pkg-${number}-${Date.now()}`,
          number,
          label: `Demand Package #${String(number).padStart(3, "0")}`,
          status: "Draft",
          generatedFrom: pendingGen.strategyLabel,
          generatedAt: `Today • ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
          estimatedAmount: pendingGen.amount,
          docCount: 42,
          version: "1.0",
          isNew: true,
        };
        return [pkg, ...prev.map((p) => ({ ...p, isNew: false }))];
      });
      setActiveTab("demandspace");
      setGenPhase("idle");
      setPendingGen(null);
    }, 1100);
    return () => clearTimeout(t);
  }, [genPhase, pendingGen]);

  const updateDemandPackage = (id: string, patch: Partial<DemandPackage>) => {
    setDemandPackages((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const nonEconomic = BASE_ECONOMIC * MULTIPLIER;
  const model: WorkspaceModel = {
    caseName: caseData?.caseName ?? "Estate of Miller vs Logistics Co.",
    caseId: caseData?.id ?? caseData?.caseId ?? "CASE-94101",
    plaintiff: caseData?.plaintiff ?? "Evelyn Miller",
    defendant: caseData?.defendant ?? "Midwest Logistics Co.",
    insuranceCarrier: caseData?.insuranceCarrier ?? "ABC Professional Liability Insurance",
    caseType: caseData?.caseType ?? "Motor Vehicle Accident",
    jurisdiction: caseData?.jurisdiction ?? "Cook County, IL",
    incidentDate: caseData?.dateOfIncident ?? "Feb 14, 2026",
    status: "Ready for Review",
    recommendedSettlement: BASE_ECONOMIC + nonEconomic,
    confidence: 94,
    multiplier: MULTIPLIER,
    economicTotal: BASE_ECONOMIC,
    nonEconomicTotal: nonEconomic,
    estimatedLow: caseData?.estimatedLow ?? 968700,
    estimatedHigh: caseData?.estimatedHigh ?? 1372325,
  };

  const tabProps = { model, findings: analysisFindings, documents, goTo: setActiveTab, goToValuation: onNavigateToValuation, onGenerateDemand: startGenerateDemand };

  const renderTab = () => {
    switch (activeTab) {
      case "medical": return <MedicalTimelineTab {...tabProps} />;
      case "economic": return <EconomicDamagesTab {...tabProps} />;
      case "noneconomic": return <NonEconomicDamagesTab {...tabProps} />;
      case "liability": return <LiabilityAnalysisTab {...tabProps} />;
      case "evidence": return <EvidenceRepositoryTab {...tabProps} />;
      case "demand": return <DemandPackageTab {...tabProps} />;
      case "negotiation": return <NegotiationTab {...tabProps} />;
      case "demandspace": return (
        <DemandSpacePage
          model={model}
          packages={demandPackages}
          onUpdatePackage={updateDemandPackage}
        />
      );
      default: return <OverviewTab {...tabProps} />;
    }
  };

  return (
    <div className="min-h-screen bg-wash">
      {/* ── Sticky header: breadcrumb + title + actions + tabs ── */}
      <div className="sticky top-0 z-40">
      <div className="bg-white border-b border-line">
        <div className="max-w-[1400px] mx-auto px-8 pt-5 pb-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-4 secondary-text mb-5">
            <button onClick={onBackToIntake} className="flex items-center gap-1.5 hover:text-ink transition-colors">
              <ChevronLeft className="w-4 h-4" strokeWidth={1.75} /> Case Workspace
            </button>
            <div className="ml-auto flex items-center gap-2 min-w-0">
              <span>Case Workspace</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#9BA8B4]" strokeWidth={1.75} />
              <span className="text-ink font-medium truncate">{model.caseName}</span>
            </div>
          </div>

          {/* Title + actions */}
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="min-w-0">
              <h1 className="page-title">{model.caseName}</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setActiveTab("demandspace")} className="btn btn-secondary gap-2">
                <FileSignature className="w-4 h-4" strokeWidth={1.75} /> Demand Space
              </button>
              <button onClick={() => setActiveTab("evidence")} className="btn btn-secondary gap-2">
                <FolderOpen className="w-4 h-4" strokeWidth={1.75} /> Documents
              </button>
              <button className="btn btn-secondary gap-2">
                <Settings2 className="w-4 h-4" strokeWidth={1.75} /> Manage Case
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white border-b border-line">
        <div className="max-w-[1400px] mx-auto px-8">
          <div className="flex items-center gap-1 overflow-x-auto">
            {TABS.map((t, i) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`relative px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em] whitespace-nowrap transition-colors ${
                    active ? "text-brand" : "text-[#5B6B78] hover:text-ink"
                  }`}
                >
                  {i + 1}. {t.label}
                  {active && <span className="absolute left-3 right-3 -bottom-px h-0.5 rounded-full bg-brand" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="max-w-[1400px] mx-auto px-8 py-10">
        {renderTab()}
      </div>

      {/* ── Generate Demand: full-screen generating / success overlay ── */}
      {genPhase !== "idle" && (
        <div className="fixed inset-0 z-[100] bg-ink flex items-center justify-center p-6">
          <div className="w-full max-w-md text-center">
            {genPhase === "running" ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mx-auto mb-6">
                  <Loader2 className="w-6 h-6 text-brand animate-spin" strokeWidth={1.75} />
                </div>
                <h2 className="page-title text-white">Generating Demand Package</h2>
                <p className="text-soft text-sm mt-2">Compiling legal documents, evidence, and settlement demand package.</p>
                <div className="mt-8 space-y-2.5 text-left">
                  {GENERATE_STEPS.map((label, i) => {
                    const done = i < genStep;
                    const active = i === genStep;
                    return (
                      <div key={label} className={`flex items-center gap-2.5 text-sm transition-opacity duration-300 ${done || active ? "opacity-100" : "opacity-30"}`}>
                        {done ? (
                          <CheckCircle className="w-4 h-4 text-brand shrink-0" strokeWidth={1.75} />
                        ) : active ? (
                          <Loader2 className="w-4 h-4 text-brand shrink-0 animate-spin" strokeWidth={1.75} />
                        ) : (
                          <Circle className="w-4 h-4 text-white/30 shrink-0" strokeWidth={1.75} />
                        )}
                        <span className={done ? "text-soft" : "text-white"}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-brand/15 border border-brand/30 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-7 h-7 text-brand" strokeWidth={1.75} />
                </div>
                <h2 className="page-title text-white">Demand Package Generated Successfully</h2>
                <p className="text-soft text-sm mt-2">Opening Demand Space...</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
