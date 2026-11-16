import React, { useEffect, useState } from 'react';
import { CloudUpload, Download, ExternalLink, FileText, Printer, X } from 'lucide-react';
import type {
  CompanySettings,
  CuttingProject,
  OptimizationResult,
  ProjectReport,
} from '../types/cutmaster';
import { generateProjectPdfBlob, printPdfBlob } from '../lib/pdfGenerator';
import { fetchProjectReports, saveReportToCloud } from '../lib/firestoreService';

interface ReportsModalProps {
  project: CuttingProject;
  result: OptimizationResult;
  settings: CompanySettings;
  isCloudUser: boolean;
  onClose: () => void;
}

export const ReportsModal: React.FC<ReportsModalProps> = ({
  project,
  result,
  settings,
  isCloudUser,
  onClose,
}) => {
  const [savedReports, setSavedReports] = useState<ProjectReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [savingCloud, setSavingCloud] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isCloudUser || project.isLocalOnly) return;
    setLoadingReports(true);
    fetchProjectReports(project.id, project.ownerId)
      .then(setSavedReports)
      .catch(() => {
        // Ignore if project isn't saved to cloud yet
      })
      .finally(() => setLoadingReports(false));
  }, [isCloudUser, project.id, project.ownerId, project.isLocalOnly]);

  const handleDownloadPdf = () => {
    const { blob, fileName } = generateProjectPdfBlob(project, result, settings);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handlePrint = () => {
    const { blob } = generateProjectPdfBlob(project, result, settings);
    printPdfBlob(blob);
  };

  const handleSaveToCloud = async () => {
    if (!isCloudUser || project.isLocalOnly) {
      setStatusMsg('Sign in with a verified cloud account to archive reports in cloud storage.');
      return;
    }
    setSavingCloud(true);
    setStatusMsg(null);
    try {
      const { blob, fileName } = generateProjectPdfBlob(project, result, settings);
      const saved = await saveReportToCloud(project, fileName, blob);
      setSavedReports((prev) => [saved, ...prev]);
      setStatusMsg(
        saved.downloadUrl
          ? 'PDF report uploaded to Firebase Storage and logged to project history.'
          : 'Report summary saved to Firestore project history.'
      );
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Failed to archive report.');
    } finally {
      setSavingCloud(false);
    }
  };

  const currency = settings.currency || '$';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181B1F] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <div>
              <h2 className="font-display text-base font-bold text-zinc-900 dark:text-zinc-100">
                PDF Cutting Report &amp; Print Center
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {project.name} · {result.totalSheets} sheets · {result.efficiencyPct}% yield
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Report Contents Summary */}
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#111315] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Included in Generated PDF
              </span>
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                A4 Vector Diagrams
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <div>· Company Name &amp; Logo</div>
              <div>· Customer &amp; Date Header</div>
              <div>· Material &amp; Kerf Spec</div>
              <div>· Cost &amp; Waste Analysis</div>
              <div>· Full Parts Cut List</div>
              <div>· Scaled Sheet Diagrams ({result.totalSheets})</div>
            </div>
          </div>

          {statusMsg && (
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-700 dark:text-emerald-300">
              {statusMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-orange-500 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#22262C] px-4 py-2.5 text-xs font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Report</span>
            </button>

            <button
              type="button"
              disabled={savingCloud}
              onClick={() => void handleSaveToCloud()}
              className="flex items-center justify-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#22262C] px-4 py-2.5 text-xs font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <CloudUpload className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span>{savingCloud ? 'Saving...' : 'Save to Cloud'}</span>
            </button>
          </div>

          {/* Cloud Archive History */}
          <div className="space-y-2.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Saved Cloud Reports
            </h3>
            {loadingReports ? (
              <p className="text-xs text-zinc-400">Loading saved reports...</p>
            ) : savedReports.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                No archived cloud reports for this project yet. Click &ldquo;Save to Cloud&rdquo; to store a snapshot.
              </p>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                {savedReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {rep.fileName}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                        {new Date(rep.createdAt).toLocaleString()} · {rep.totalSheets} sheets · {rep.efficiencyPct}% · {currency}{rep.totalCost.toFixed(2)}
                      </div>
                    </div>
                    {rep.downloadUrl ? (
                      <a
                        href={rep.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium text-orange-600 dark:text-orange-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 shrink-0"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-zinc-400 shrink-0">Logged</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
