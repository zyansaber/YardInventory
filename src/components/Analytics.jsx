import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getAllYards, getAllWeeklyRecords, getWeekStartDate } from '../firebase/database';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const Analytics = () => {
  const [yards, setYards] = useState({});
  const [weeklyRecords, setWeeklyRecords] = useState({});
  const [chartData, setChartData] = useState([]);
  const [selectedYard, setSelectedYard] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [loading, setLoading] = useState(false);
  const [summaryStats, setSummaryStats] = useState({
    totalStock: 0,
    selfOwnedStock: 0,
    jvStock: 0,
    externalStock: 0,
    unreportedYards: []
  });
  const [tableData, setTableData] = useState([]);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const pdfRef = useRef();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    processData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yards, weeklyRecords, selectedYard, selectedClass]);

  const loadData = async () => {
    setLoading(true);
    const [yardsData, recordsData] = await Promise.all([
      getAllYards(),
      getAllWeeklyRecords()
    ]);
    setYards(yardsData || {});
    setWeeklyRecords(recordsData || {});
    setLoading(false);
  };

  const processData = () => {
    if (!yards || !weeklyRecords) return;

    const currentWeek = getWeekStartDate(); // e.g. "YYYY-MM-DD" (Monday)
    const yardNames = Object.keys(yards);

    // ---- Summary ----
    let totalStock = 0;
    let selfOwnedStock = 0;
    let jvStock = 0;
    let externalStock = 0;
    const unreportedYards = [];

    const currentWeekRecords = weeklyRecords[currentWeek]?.records || [];

    yardNames.forEach(yardName => {
      const yardData = yards[yardName];
      const currentRecord = currentWeekRecords.find(r => r.dealer === yardName);

      let stock = null;
      if (currentRecord) {
        stock = currentRecord.stock ?? null;
      } else {
        const lastStock = getLastReportedStock(yardName);
        stock = (lastStock !== null && lastStock !== undefined) ? lastStock : null;
        unreportedYards.push(yardName);
      }

      const stockForSum = stock ?? 0;
      totalStock += stockForSum;

      switch (yardData.Class) {
        case 'Self-owned':
          selfOwnedStock += stockForSum;
          break;
        case 'JV Dealer':
          jvStock += stockForSum;
          break;
        case 'External':
          externalStock += stockForSum;
          break;
        default:
          break;
      }
    });

    setSummaryStats({
      totalStock,
      selfOwnedStock,
      jvStock,
      externalStock,
      unreportedYards
    });

    // ---- Chart data ----
    const weeks = Object.keys(weeklyRecords).sort();
    const processedData = weeks.map(week => {
      const weekData = { week: formatWeekDate(week) };
      const records = weeklyRecords[week].records || [];

      if (selectedYard === 'all') {
        const classData = { 'Self-owned': 0, 'JV Dealer': 0, 'External': 0 };
        const estimatedData = { 'Self-owned': false, 'JV Dealer': false, 'External': false };

        yardNames.forEach(yardName => {
          const yardClass = yards[yardName].Class;
          if (selectedClass !== 'all' && yardClass !== selectedClass) return;

          const record = records.find(r => r.dealer === yardName);
          if (record) {
            classData[yardClass] += record.stock || 0;
          } else {
            const lastStock = getLastReportedStock(yardName, week);
            if (lastStock !== null) {
              classData[yardClass] += lastStock;
              estimatedData[yardClass] = true;
            }
          }
        });

        if (selectedClass === 'all') {
          weekData['Total'] = classData['Self-owned'] + classData['JV Dealer'] + classData['External'];
          weekData['Total_estimated'] = estimatedData['Self-owned'] || estimatedData['JV Dealer'] || estimatedData['External'];
        } else {
          weekData[selectedClass] = classData[selectedClass];
          weekData[`${selectedClass}_estimated`] = estimatedData[selectedClass];
        }
      } else {
        const record = records.find(r => r.dealer === selectedYard);
        if (record) {
          weekData[selectedYard] = record.stock ?? null;
        } else {
          const lastStock = getLastReportedStock(selectedYard, week);
          if (lastStock !== null) {
            weekData[selectedYard] = lastStock;
            weekData[`${selectedYard}_estimated`] = true;
          } else {
            weekData[selectedYard] = null;
          }
        }
      }

      return weekData;
    });

    setChartData(processedData);

    // ---- Table data (Estimated 仅在本周无上报但使用历史值回填时显示) ----
    const tableRows = yardNames.map(yardName => {
      const yardData = yards[yardName];
      const currentRecord = currentWeekRecords.find(r => r.dealer === yardName);

      let currentStock = null;
      let isReported = false;
      let isEstimated = false;

      if (currentRecord) {
        currentStock = currentRecord.stock ?? null;
        isReported = true;
        isEstimated = false;
      } else {
        const lastStock = getLastReportedStock(yardName);
        if (lastStock !== null && lastStock !== undefined) {
          currentStock = lastStock;   // 用历史值
          isEstimated = true;         // 仅这种情况显示 Estimated
        } else {
          currentStock = null;        // 完全无数据
          isEstimated = false;
        }
      }

      const previousWeek = getPreviousWeek(currentWeek);
      const previousStock = getPreviousWeekStock(yardName, previousWeek);
      const stockChange = (currentStock !== null && previousStock !== null)
        ? currentStock - previousStock
        : null;

      const unreportedWeeksCount = getUnreportedWeeksCount(yardName);

      const isCritical = currentStock !== null && yardData.Min !== null && yardData.Max !== null &&
                        (currentStock < yardData.Min || currentStock > yardData.Max);

      const lastReportDate = getLastReportDate(yardName);

      return {
        yard: yardName,
        class: yardData.Class,
        stockLevel: currentStock,
        stockChange,
        min: yardData.Min,
        max: yardData.Max,
        isReported,
        isEstimated,
        unreportedWeeks: unreportedWeeksCount,
        isCritical,
        lastReportDate
      };
    }).sort((a, b) => a.yard.localeCompare(b.yard));

    setTableData(tableRows);
  };

  const getLastReportDate = (yardName) => {
    const weeks = Object.keys(weeklyRecords).sort().reverse();
    for (const week of weeks) {
      const records = weeklyRecords[week].records || [];
      const record = records.find(r => r.dealer === yardName);
      if (record && record.lastUpdated) return record.lastUpdated;
    }
    return null;
  };

  const formatDateToDDMMYYYY = (dateString) => {
    if (!dateString) return 'No data';
    const date = new Date(dateString);
    if (isNaN(date)) return 'No data';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getLastReportedStock = (yardName, beforeWeek = null) => {
    const weeks = Object.keys(weeklyRecords).sort().reverse();
    for (const week of weeks) {
      if (beforeWeek && week >= beforeWeek) continue;
      const records = weeklyRecords[week].records || [];
      const record = records.find(r => r.dealer === yardName);
      if (record) return record.stock;
    }
    return null;
  };

  const getPreviousWeek = (currentWeek) => {
    const date = new Date(currentWeek);
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  };

  const getPreviousWeekStock = (yardName, week) => {
    const records = weeklyRecords[week]?.records || [];
    const record = records.find(r => r.dealer === yardName);
    return record ? record.stock : getLastReportedStock(yardName, week);
  };

  const formatWeekDate = (weekString) => {
    const date = new Date(weekString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getLineColor = (dataKey) => {
    switch (dataKey) {
      case 'Total': return '#2563eb';
      case 'Self-owned': return '#059669';
      case 'JV Dealer': return '#dc2626';
      case 'External': return '#d97706';
      default: return '#2563eb';
    }
  };

  const getDataKey = () => {
    if (selectedYard === 'all') {
      return selectedClass === 'all' ? 'Total' : selectedClass;
    }
    return selectedYard;
  };

  // 未上报周数 = 今天所在周(周一) 与 最近一次上报所在周(周一) 的差
  const getUnreportedWeeksCount = (yardName) => {
    const currentWeekStart = getWeekStartDate(); // Monday string
    const lastReportWeek = getLastReportWeek(yardName);
    if (!lastReportWeek) return 999;
    const currentDate = new Date(currentWeekStart);
    const lastReportDate = new Date(lastReportWeek);
    const timeDiff = currentDate.getTime() - lastReportDate.getTime();
    const weeksDiff = Math.floor(timeDiff / (7 * 24 * 60 * 60 * 1000));
    return Math.max(0, weeksDiff);
  };

  const getLastReportWeek = (yardName) => {
    const weeks = Object.keys(weeklyRecords).sort().reverse();
    for (const week of weeks) {
      const records = weeklyRecords[week].records || [];
      const hasReport = records.some(r => r.dealer === yardName);
      if (hasReport) return week;
    }
    return null;
  };

  const getSeverityColor = (weeksCount) => {
    if (weeksCount >= 4) return 'text-red-600';
    if (weeksCount >= 2) return 'text-yellow-600';
    return 'text-green-600';
  };

  const handleUnreportedYardClick = (yardName) => {
    setSelectedYard(yardName);
    setSelectedClass(yards[yardName].Class);
  };

  const downloadPDF = async () => {
    setGeneratingPDF(true);
    try {
      const element = pdfRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      pdf.setFontSize(16);
      pdf.text('Yard Inventory Report', 105, 15, { align: 'center' });
      pdf.setFontSize(12);
      pdf.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 105, 25, { align: 'center' });

      pdf.addImage(imgData, 'PNG', 0, 30, imgWidth, imgHeight);
      heightLeft -= (pageHeight - 30);

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight + 30;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `Yard_Inventory_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const filteredYards = Object.keys(yards).filter(yardName => {
    if (selectedClass !== 'all' && yards[yardName].Class !== selectedClass) return false;
    return true;
  });

  const getCurrentTrendValue = () => {
    if (chartData.length === 0) return 0;
    const latestData = chartData[chartData.length - 1];
    const dataKey = getDataKey();
    return latestData[dataKey] || 0;
  };

  // Y 轴动态域（±10%）
  const yDomain = useMemo(() => {
    const dataKey = getDataKey();
    if (!dataKey || chartData.length === 0) return ['auto', 'auto'];

    const values = chartData
      .map(d => d?.[dataKey])
      .filter(v => typeof v === 'number' && !isNaN(v));

    if (values.length === 0) return ['auto', 'auto'];

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    if (minVal === maxVal) {
      const pad = Math.max(1, Math.round(minVal * 0.1 || 10));
      return [minVal - pad, maxVal + pad];
    }

    const range = maxVal - minVal;
    const pad = range * 0.1;
    const low = Math.floor(minVal - pad);
    const high = Math.ceil(maxVal + pad);
    return [low, high];
  }, [chartData, selectedYard, selectedClass]);

  return (
    <div className="space-y-6">
      {/* PDF Download Button */}
      <div className="flex justify-end">
        <button
          onClick={downloadPDF}
          disabled={generatingPDF}
          className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
        >
          {generatingPDF ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Generating PDF...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Download PDF Report</span>
            </>
          )}
        </button>
      </div>

      <div ref={pdfRef} className="pdf-content">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-500">Total Stock</p>
            <p className="text-2xl font-semibold text-gray-900">{summaryStats.totalStock.toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-500">Self-owned Stock</p>
            <p className="text-2xl font-semibold text-gray-900">{summaryStats.selfOwnedStock.toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-500">JV Stock</p>
            <p className="text-2xl font-semibold text-gray-900">{summaryStats.jvStock.toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-500">External Stock</p>
            <p className="text-2xl font-semibold text-gray-900">{summaryStats.externalStock.toLocaleString()}</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium">Yard Overview</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Yard</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Level</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unreported Weeks</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Report Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tableData.map((row) => (
                  <tr key={row.yard} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      <div className="flex items-center space-x-2">
                        {row.yard}
                        {row.isCritical && <span className="text-red-500" title="Critical Range">⚠️</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        row.class === 'Self-owned' ? 'bg-green-100 text-green-800' :
                        row.class === 'JV Dealer' ? 'bg-blue-100 text-blue-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {row.class}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-900">
                          {row.stockLevel !== null ? row.stockLevel.toLocaleString() : 'No data'}
                        </span>
                        {row.isEstimated && (
                          <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                            Estimated
                          </span>
                        )}
                        {row.stockChange !== null && (
                          <span className={`text-sm ${
                            row.stockChange > 0 ? 'text-green-600' :
                            row.stockChange < 0 ? 'text-red-600' : 'text-gray-500'
                          }`}>
                            ({row.stockChange > 0 ? '+' : ''}{row.stockChange?.toLocaleString()})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {row.min ?? '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {row.max ?? '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`${getSeverityColor(row.unreportedWeeks)}`}>{row.unreportedWeeks}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {formatDateToDDMMYYYY(row.lastReportDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Yard Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Classes</option>
              <option value="Self-owned">Self-owned</option>
              <option value="JV Dealer">JV Dealer</option>
              <option value="External">External</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Specific Yard</label>
            <select
              value={selectedYard}
              onChange={(e) => setSelectedYard(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Yards</option>
              {filteredYards.map(yardName => (
                <option key={yardName} value={yardName}>{yardName}</option>
              ))}
            </select>
          </div>
        </div>

        {summaryStats.unreportedYards.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
            <div className="flex items-center mb-2">
              <span className="text-red-600 mr-2">⚠️</span>
              <h3 className="text-sm font-medium text-red-800">
                {summaryStats.unreportedYards.length} yard(s) missing data this week
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {summaryStats.unreportedYards.map(yardName => (
                <button
                  key={yardName}
                  onClick={() => handleUnreportedYardClick(yardName)}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200 transition-colors cursor-pointer"
                >
                  {yardName}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trend Chart (safe) */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Stock Trends</h3>
          <div className="text-right">
            <p className="text-sm text-gray-500">Current Value</p>
            <p className="text-xl font-semibold text-gray-900">
              {getCurrentTrendValue().toLocaleString()}
            </p>
          </div>
        </div>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 30, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="week"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={(value) => value.toLocaleString()}
                domain={yDomain}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(value, name, props) => {
                  const isEstimatedPoint = props?.payload?.[`${name}_estimated`];
                  return [
                    value?.toLocaleString(),
                    `${name}${isEstimatedPoint ? ' (estimated)' : ''}`
                  ];
                }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Line
                type="monotone"
                dataKey={getDataKey()}
                stroke={getLineColor(getDataKey())}
                strokeWidth={3}
                dot={false}           /* 关闭自定义 dot，避免生产构建的 SVG 坑 */
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
