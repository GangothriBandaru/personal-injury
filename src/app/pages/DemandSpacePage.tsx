import { useState } from "react";
import { FileSignature, Eye, Pencil, Send, ArrowRight } from "lucide-react";
import type { DemandPackage, PackageStatus } from "../types/case";
import type { WorkspaceModel } from "../workspace/WorkspaceTabs";
import { DemandPackageEditorPage } from "./DemandPackageEditorPage";
import { DemandPackagePreviewModal } from "./DemandPackagePreviewModal";

function formatUSD(n: number) {
  return "$" + Math.round(n).toLocaleString("en-US");
}

const STATUS_PILL: Record<PackageStatus, string> = {
  Draft: "pill pill-neutral",
  "Under Review": "pill pill-progress",
  "Ready to Send": "pill pill-complete",
  Sent: "pill pill-neutral",
  Negotiation: "pill pill-progress",
  Closed: "pill pill-complete",
};

interface DemandSpacePageProps {
  model: WorkspaceModel;
  packages: DemandPackage[];
  onUpdatePackage: (id: string, patch: Partial<DemandPackage>) => void;
}

export function DemandSpacePage({ model, packages, onUpdatePackage }: DemandSpacePageProps) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [sendId, setSendId] = useState<string | null>(null);

  const previewPkg = packages.find((p) => p.id === previewId) ?? null;
  const editingPkg = packages.find((p) => p.id === editingPackageId) ?? null;
  const sendPkg = packages.find((p) => p.id === sendId) ?? null;

  const confirmSend = () => {
    if (!sendId) return;
    onUpdatePackage(sendId, { status: "Sent" });
    setSendId(null);
  };

  // ── Demand Package Editor — full-screen, replaces the library view ──
  if (editingPkg) {
    return (
      <DemandPackageEditorPage
        pkg={editingPkg}
        model={model}
        onClose={() => setEditingPackageId(null)}
        onSaveNotes={(notes) => onUpdatePackage(editingPkg.id, { notes })}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Demand Space</h1>
        <p className="secondary-text mt-1">Manage, review, edit, and send AI-generated demand packages.</p>
      </div>

      {packages.length === 0 ? (
        <div className="lg-card p-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-tint flex items-center justify-center mx-auto mb-4">
            <FileSignature className="w-5 h-5 text-deep" strokeWidth={1.75} />
          </div>
          <h2 className="card-title">No demand packages yet</h2>
          <p className="secondary-text mt-1.5 max-w-md mx-auto">
            Generate one from a recommended strategy in the Intelligence tab's Strategy Dashboard — it will appear here automatically.
          </p>
        </div>
      ) : (
        <div>
          <h2 className="section-header mb-4">Demand Package Library</h2>
          <div className="space-y-4">
            {packages.map((pkg) => (
              <div key={pkg.id} className={`lg-card p-6 ${pkg.isNew ? "lg-highlight-in" : ""}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="card-title">{pkg.label}{pkg.suffix ? ` (${pkg.suffix})` : ""}</h3>
                      <span className={STATUS_PILL[pkg.status]}>{pkg.status}</span>
                    </div>
                    <div className="secondary-text mt-1">Version {pkg.version}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <div className="rounded-xl border border-line bg-offwhite p-3">
                    <div className="eyebrow">Generated From</div>
                    <div className="mt-1.5 text-sm font-semibold text-ink">{pkg.generatedFrom}</div>
                  </div>
                  <div className="rounded-xl border border-line bg-offwhite p-3">
                    <div className="eyebrow">Generated</div>
                    <div className="mt-1.5 text-sm font-semibold text-ink">{pkg.generatedAt}</div>
                  </div>
                  <div className="rounded-xl border border-line bg-offwhite p-3">
                    <div className="eyebrow">Estimated Demand</div>
                    <div className="mt-1.5 text-sm font-semibold text-ink tabular-nums">{formatUSD(pkg.estimatedAmount)}</div>
                  </div>
                  <div className="rounded-xl border border-line bg-offwhite p-3">
                    <div className="eyebrow">Supporting Documents</div>
                    <div className="mt-1.5 text-sm font-semibold text-ink tabular-nums">{pkg.docCount}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-5 flex-wrap">
                  <button onClick={() => setPreviewId(pkg.id)} className="btn btn-secondary gap-1.5">
                    <Eye className="w-4 h-4" strokeWidth={1.75} /> Preview Package
                  </button>
                  <button onClick={() => setEditingPackageId(pkg.id)} className="btn btn-secondary gap-1.5">
                    <Pencil className="w-4 h-4" strokeWidth={1.75} /> Edit Package
                  </button>
                  <button onClick={() => setSendId(pkg.id)} className="btn btn-primary gap-1.5">
                    <Send className="w-4 h-4" strokeWidth={1.75} /> Send Demand
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demand Package Preview — read-only modal */}
      {previewPkg && (
        <DemandPackagePreviewModal
          pkg={previewPkg}
          model={model}
          onClose={() => setPreviewId(null)}
          onSend={() => { setPreviewId(null); setSendId(previewPkg.id); }}
        />
      )}

      {/* Send confirmation */}
      {sendPkg && (
        <div className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-6" onClick={() => setSendId(null)}>
          <div className="lg-card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-11 h-11 rounded-xl bg-tint flex items-center justify-center mb-4">
              <Send className="w-5 h-5 text-deep" strokeWidth={1.75} />
            </div>
            <h2 className="card-title">Send Demand Package</h2>
            <p className="secondary-text mt-2 leading-relaxed">
              {sendPkg.label} will be sent to <span className="font-semibold text-ink">{model.insuranceCarrier}</span> on behalf of {model.caseName}.
            </p>
            <div className="rounded-xl border border-line bg-offwhite p-3.5 mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="secondary-text">Estimated Demand</span>
                <span className="font-semibold text-ink tabular-nums">{formatUSD(sendPkg.estimatedAmount)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-6">
              <button onClick={() => setSendId(null)} className="btn btn-secondary flex-1 justify-center">Cancel</button>
              <button onClick={confirmSend} className="btn btn-primary flex-1 justify-center gap-2">
                Confirm &amp; Send <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
