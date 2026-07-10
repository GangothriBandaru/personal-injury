import { useState } from "react";
import { ChevronLeft, ChevronRight, FileSignature, FolderOpen, Settings2 } from "lucide-react";
import type { AnalysisFinding, CaseDocument } from "../types/case";
import {
  WorkspaceModel,
  OverviewTab, MedicalTimelineTab, EconomicDamagesTab, NonEconomicDamagesTab,
  LiabilityAnalysisTab, EvidenceRepositoryTab, DemandPackageTab, NegotiationTab,
} from "../workspace/WorkspaceTabs";

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

export function CaseWorkspacePage({ caseData, analysisFindings = [], documents = [], onBackToIntake, onNavigateToValuation }: CaseWorkspacePageProps) {
  const [activeTab, setActiveTab] = useState("overview");

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

  const tabProps = { model, findings: analysisFindings, documents, goTo: setActiveTab, goToValuation: onNavigateToValuation };

  const renderTab = () => {
    switch (activeTab) {
      case "medical": return <MedicalTimelineTab {...tabProps} />;
      case "economic": return <EconomicDamagesTab {...tabProps} />;
      case "noneconomic": return <NonEconomicDamagesTab {...tabProps} />;
      case "liability": return <LiabilityAnalysisTab {...tabProps} />;
      case "evidence": return <EvidenceRepositoryTab {...tabProps} />;
      case "demand": return <DemandPackageTab {...tabProps} />;
      case "negotiation": return <NegotiationTab {...tabProps} />;
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
              <button onClick={() => setActiveTab("demand")} className="btn btn-primary gap-2">
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
    </div>
  );
}
