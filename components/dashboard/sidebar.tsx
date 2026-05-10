import { useState } from 'react';
import { BarChart3, Settings, FileSpreadsheet, ChevronDown, Calendar } from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface SidebarProps {
  onLogout: () => void;
  stores: any[];
  token: string;
}

type ReportPeriod = 'today' | 'week' | 'month' | 'custom';

export function Sidebar({ onLogout, stores, token }: SidebarProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [downloading, setDownloading] = useState(false);

  const handleDownloadReport = async (period: ReportPeriod) => {
    setDownloading(true);
    try {
      let url = apiUrl(`/api/report?period=${period}`);

      if (period === 'custom') {
        if (!customStartDate || !customEndDate) {
          alert('Please select both start and end dates for custom report.');
          setDownloading(false);
          return;
        }
        url += `&startDate=${customStartDate}&endDate=${customEndDate}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate report');
      }

      // Get the filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `oxygenlead-report.xlsx`;

      // Download the file
      const blob = await response.blob();
      const urlObj = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlObj;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(urlObj);
    } catch (err) {
      console.error('Failed to download report:', err);
      alert('Failed to generate report. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const periodLabels: Record<ReportPeriod, string> = {
    today: 'Today',
    week: 'This Week',
    month: 'This Month',
    custom: 'Custom Range',
  };

  return (
    <aside className="w-64 border-r border-secondary/20 bg-sidebar text-sidebar-foreground flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary/20 flex items-center justify-center">
            <div className="w-4 h-4 rounded bg-sidebar-primary"></div>
          </div>
          <span className="font-semibold text-lg">OxygenLead</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-6 space-y-2">
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-sidebar-foreground/60 mb-3 uppercase">
            Main
          </h3>
          <button className="w-full flex items-center gap-3 px-4 py-2 rounded-lg bg-sidebar-primary/10 text-sidebar-primary font-medium">
            <BarChart3 className="w-4 h-4" />
            Dashboard
          </button>
        </div>

        {/* Report Section */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-sidebar-foreground/60 mb-3 uppercase">
            Reports
          </h3>
          <div>
            <button
              onClick={() => setReportOpen(!reportOpen)}
              className="w-full flex items-center justify-between gap-3 px-4 py-2 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/10 transition"
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-4 h-4" />
                Report
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${reportOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {reportOpen && (
              <div className="mt-2 ml-4 space-y-1">
                {/* Period options */}
                {(['today', 'week', 'month', 'custom'] as ReportPeriod[]).map((period) => (
                  <button
                    key={period}
                    onClick={() => {
                      setReportPeriod(period);
                      if (period !== 'custom') {
                        handleDownloadReport(period);
                      }
                    }}
                    disabled={downloading}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition ${
                      reportPeriod === period
                        ? 'bg-sidebar-accent/10 text-sidebar-foreground'
                        : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/5'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {periodLabels[period]}
                  </button>
                ))}

                {/* Custom date inputs */}
                {reportPeriod === 'custom' && (
                  <div className="pt-2 px-2 space-y-2">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded border border-sidebar-border bg-sidebar-accent/5 text-sidebar-foreground focus:outline-none focus:ring-1 focus:ring-sidebar-primary"
                      placeholder="Start date"
                    />
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded border border-sidebar-border bg-sidebar-accent/5 text-sidebar-foreground focus:outline-none focus:ring-1 focus:ring-sidebar-primary"
                      placeholder="End date"
                    />
                    <button
                      onClick={() => handleDownloadReport('custom')}
                      disabled={downloading || !customStartDate || !customEndDate}
                      className="w-full px-3 py-1.5 text-xs font-medium rounded bg-sidebar-primary text-white hover:bg-sidebar-primary/90 transition disabled:opacity-50"
                    >
                      {downloading ? 'Downloading...' : 'Download Report'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-sidebar-foreground/60 mb-3 uppercase">
            Stats
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-sidebar-foreground/60">Total Stores</p>
              <p className="text-2xl font-bold">{stores.length}</p>
            </div>
            <div>
              <p className="text-sidebar-foreground/60">Hot Leads</p>
              <p className="text-2xl font-bold">
                {stores.filter((s) => (s.leadScore || 0) >= 80).length}
              </p>
            </div>
          </div>
        </div>
      </nav>

      {/* Settings */}
      <div className="p-6 border-t border-sidebar-border">
        <button className="w-full flex items-center gap-3 px-4 py-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/10 rounded-lg transition">
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>
    </aside>
  );
}
