import React, { useState, useEffect } from 'react';
import {
  createYard, updateYard, deleteYard, getAllYards,
  getAllWeeklyRecords, getWeekStartDate
} from '../firebase/database';
import emailjs from '@emailjs/browser';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const AdminSetup = () => {
  const [yards, setYards] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingYard, setEditingYard] = useState(null);
  const [formData, setFormData] = useState({
    yardName: '',
    company: '',
    class: 'Self-owned',
    min: '',
    max: ''
  });

  // ===== Email =====
  const [emailConfig, setEmailConfig] = useState({
    recipients: '',
    sendTime: '09:00',
    sendDay: 'monday',
    enabled: false
  });
  const [emailSaving, setEmailSaving] = useState(false);

  const [emailjsConfig, setEmailjsConfig] = useState({
    serviceId: 'service_xxx',
    templateId: 'template_xxx',
    publicKey: 'public_xxx'
  });
  const [emailjsConfigSaving, setEmailjsConfigSaving] = useState(false);

  useEffect(() => {
    loadYards();
    const savedCfg = localStorage.getItem('emailConfig');
    if (savedCfg) setEmailConfig(JSON.parse(savedCfg));
    const savedE = localStorage.getItem('emailjsConfig');
    if (savedE) setEmailjsConfig(JSON.parse(savedE));
  }, []);

  const loadYards = async () => {
    setLoading(true);
    const y = await getAllYards();
    setYards(y || {});
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const handleEmailConfigChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEmailConfig((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleEmailjsConfigChange = (e) => {
    const { name, value } = e.target;
    setEmailjsConfig((p) => ({ ...p, [name]: value }));
  };

  const saveEmailConfig = () => {
    setEmailSaving(true);
    localStorage.setItem('emailConfig', JSON.stringify(emailConfig));
    setTimeout(() => { setEmailSaving(false); alert('Email configuration saved'); }, 500);
  };
  const saveEmailjsConfig = () => {
    setEmailjsConfigSaving(true);
    localStorage.setItem('emailjsConfig', JSON.stringify(emailjsConfig));
    setTimeout(() => { setEmailjsConfigSaving(false); alert('EmailJS configuration saved'); }, 500);
  };

  // ===== Helpers from Analytics logic (对齐你的 Analytics (2).jsx) =====
  const getPreviousWeek = (currentWeek) => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  };
  const getLastReportedStock = (yardName, weeklyRecords, beforeWeek = null) => {
    const weeks = Object.keys(weeklyRecords || {}).sort().reverse();
    for (const w of weeks) {
      if (beforeWeek && w >= beforeWeek) continue;
      const recs = weeklyRecords[w]?.records || [];
      const rec = recs.find((r) => r.dealer === yardName);
      if (rec) return rec.stock;
    }
    return null;
  };
  const getPreviousWeekStock = (yardName, weeklyRecords, week) => {
    const recs = weeklyRecords[week]?.records || [];
    const rec = recs.find((r) => r.dealer === yardName);
    return rec ? rec.stock : getLastReportedStock(yardName, weeklyRecords, week);
  };
  const getLastReportDate = (yardName, weeklyRecords) => {
    const weeks = Object.keys(weeklyRecords || {}).sort().reverse();
    for (const w of weeks) {
      const recs = weeklyRecords[w]?.records || [];
      const rec = recs.find((r) => r.dealer === yardName);
      if (rec && rec.lastUpdated) return rec.lastUpdated;
    }
    return null;
  };
  const getLastReportWeek = (yardName, weeklyRecords) => {
    const weeks = Object.keys(weeklyRecords || {}).sort().reverse();
    for (const w of weeks) {
      const recs = weeklyRecords[w]?.records || [];
      const has = recs.some((r) => r.dealer === yardName);
      if (has) return w;
    }
    return null;
  };
  const getUnreportedWeeksCount = (yardName, weeklyRecords) => {
    const currentWeekStart = getWeekStartDate();
    const lastWeek = getLastReportWeek(yardName, weeklyRecords);
    if (!lastWeek) return 999;
    const cur = new Date(currentWeekStart);
    const last = new Date(lastWeek);
    const diffWeeks = Math.floor((cur.getTime() - last.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(0, diffWeeks);
  };
  const fmtDate = (s) => {
    if (!s) return 'No data';
    const d = new Date(s);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  // ===== PDF builder (A4 版式，和你 Analytics 的信息结构一致) =====
  const buildStyledPdfDataUrl = ({ summary, rows }) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // 主题色
    const blue = [37, 99, 235];     // #2563eb
    const gray = [55, 65, 81];      // #374151

    // Header 背景条
    doc.setFillColor(...blue);
    doc.rect(0, 0, pageW, 22, 'F');

    // 标题
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('YARD INVENTORY REPORT', 10, 14);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - 10, 14, { align: 'right' });

    // KPI 卡片
    doc.setTextColor(...gray);
    const boxY = 30;
    const boxW = (pageW - 20 - 9) / 4; // 10 左右边距 + 3*3 间距
    const boxH = 22;
    const kpis = [
      { label: 'TOTAL', value: summary.totalStock },
      { label: 'SELF-OWNED', value: summary.selfOwnedStock },
      { label: 'JV', value: summary.jvStock },
      { label: 'EXTERNAL', value: summary.externalStock }
    ];
    kpis.forEach((k, i) => {
      const x = 10 + i * (boxW + 3);
      doc.setDrawColor(229, 231, 235);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, boxY, boxW, boxH, 2, 2, 'FD');
      doc.setFontSize(9);
      doc.text(k.label, x + 4, boxY + 8);
      doc.setFontSize(14);
      doc.setTextColor(...blue);
      doc.text(String(k.value?.toLocaleString?.() ?? k.value), x + 4, boxY + 17);
      doc.setTextColor(...gray);
    });

    // 未上报提示
    doc.setFontSize(10);
    const warnY = boxY + boxH + 8;
    if ((summary.unreportedYards?.length || 0) > 0) {
      doc.setTextColor(220, 38, 38);
      doc.text(`⚠ ${summary.unreportedYards.length} yard(s) missing data this week`, 10, warnY);
      doc.setTextColor(...gray);
    }

    // 表格（使用 autoTable）
    const startY = warnY + 4;
    autoTable(doc, {
      startY,
      head: [[
        'Yard', 'Class', 'Stock', 'Min', 'Max', 'Unreported Weeks', 'Last Report Date'
      ]],
      body: rows.map(r => ([
        r.yard,
        r.class,
        r.stockLevel ?? '',
        r.min ?? '',
        r.max ?? '',
        r.unreportedWeeks ?? '',
        fmtDate(r.lastReportDate)
      ])),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: blue, textColor: 255, halign: 'left' },
      columnStyles: {
        2: { halign: 'right' }, // Stock
        3: { halign: 'right' }, // Min
        4: { halign: 'right' }, // Max
        5: { halign: 'right' }, // Unreported Weeks
        6: { halign: 'left' }   // Date
      },
      theme: 'grid',
      margin: { left: 10, right: 10 }
    });

    // Footer 页码
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text(`Page ${i} / ${pageCount}`, pageW - 10, pageH - 8, { align: 'right' });
    }

    return doc.output('datauristring');
  };

  // 从数据库拉数据，按 Analytics 的规则计算汇总与表格
  const buildReportData = async () => {
    const [weeklyRecords, yardsMap] = await Promise.all([
      getAllWeeklyRecords(),
      getAllYards()
    ]);
    const currentWeek = getWeekStartDate();
    const yardNames = Object.keys(yardsMap || {});
    const currentWeekRecords = weeklyRecords[currentWeek]?.records || [];

    let totalStock = 0, selfOwnedStock = 0, jvStock = 0, externalStock = 0;
    const unreportedYards = [];

    const rows = yardNames.map((yardName) => {
      const yd = yardsMap[yardName];
      const currentRecord = currentWeekRecords.find(r => r.dealer === yardName);
      const currentStock = currentRecord ? currentRecord.stock
        : getLastReportedStock(yardName, weeklyRecords);

      if (!currentRecord) unreportedYards.push(yardName);

      // 汇总
      totalStock += currentStock || 0;
      if (yd.Class === 'Self-owned') selfOwnedStock += currentStock || 0;
      if (yd.Class === 'JV Dealer') jvStock += currentStock || 0;
      if (yd.Class === 'External') externalStock += currentStock || 0;

      // 上周对比
      const previousWeek = getPreviousWeek(currentWeek);
      const previousStock = getPreviousWeekStock(yardName, weeklyRecords, previousWeek);
      const stockChange = (currentStock != null && previousStock != null)
        ? (currentStock - previousStock) : null;

      // 是否越界（仅供你自己在表格里看，可选）
      const isCritical = currentStock != null && yd.Min != null && yd.Max != null &&
        (currentStock < yd.Min || currentStock > yd.Max);

      const lastReportDate = getLastReportDate(yardName, weeklyRecords);

      return {
        yard: yardName,
        class: yd.Class,
        stockLevel: currentStock,
        stockChange,
        min: yd.Min,
        max: yd.Max,
        isReported: !!currentRecord,
        unreportedWeeks: getUnreportedWeeksCount(yardName, weeklyRecords),
        isCritical,
        lastReportDate
      };
    }).sort((a, b) => a.yard.localeCompare(b.yard));

    const summary = { totalStock, selfOwnedStock, jvStock, externalStock, unreportedYards };

    return { summary, rows };
  };

  // ===== 发送测试邮件（生成“精排版 PDF” → EmailJS Variable Attachment） =====
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const sendTestEmail = async () => {
    try {
      if (!emailjsConfig.serviceId || !emailjsConfig.templateId || !emailjsConfig.publicKey) {
        alert('Please fill EmailJS Service ID / Template ID / Public Key first.');
        return;
      }
      const recipients = (emailConfig.recipients || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      if (recipients.length === 0) {
        alert('Please fill at least one recipient.');
        return;
      }

      // 1) 拉数据并生成“精排版 PDF”
      const { summary, rows } = await buildReportData(); // 数据口径对齐 Analytics (2).jsx
      const pdfDataUrl = buildStyledPdfDataUrl({ summary, rows });

      if (typeof pdfDataUrl !== 'string' || !pdfDataUrl.startsWith('data:application/pdf')) {
        throw new Error('PDF generation failed.');
      }

      // 2) EmailJS 群发（逐个 + 轻节流）
      emailjs.init(emailjsConfig.publicKey);
      for (const to of recipients) {
        const params = {
          to_email: to,
          report_date: new Date().toLocaleDateString(),
          pdf_attachment: pdfDataUrl // 和模板 Attachments 的 Parameter Name 一致
        };
        await emailjs.send(emailjsConfig.serviceId, emailjsConfig.templateId, params);
        await sleep(1200);
      }

      alert('Test email sent successfully!');
    } catch (e) {
      console.error(e);
      alert('Error sending test email: ' + (e?.message || 'Unknown'));
    }
  };

  // ===== Yard CRUD =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.yardName.trim()) return;
    setSaving(true);

    const payload = {
      Company: formData.company,
      Class: formData.class,
      Min: formData.min ? parseInt(formData.min) : null,
      Max: formData.max ? parseInt(formData.max) : null
    };

    const result = editingYard
      ? await updateYard(formData.yardName, payload)
      : await createYard(formData.yardName, payload);

    if (!result?.success) alert('Error: ' + result?.error);
    setFormData({ yardName: '', company: '', class: 'Self-owned', min: '', max: '' });
    setEditingYard(null);
    await loadYards();
    setSaving(false);
  };
  const handleEdit = (name) => {
    const y = yards[name];
    setFormData({
      yardName: name,
      company: y?.Company || '',
      class: y?.Class || 'Self-owned',
      min: y?.Min ? String(y.Min) : '',
      max: y?.Max ? String(y.Max) : ''
    });
    setEditingYard(name);
  };
  const handleDelete = async (name) => {
    if (!confirm(`Delete ${name}?`)) return;
    const r = await deleteYard(name);
    if (!r?.success) alert('Error: ' + r?.error);
    await loadYards();
  };
  const handleCancel = () => {
    setFormData({ yardName: '', company: '', class: 'Self-owned', min: '', max: '' });
    setEditingYard(null);
  };

  // ===== UI =====
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* EmailJS Config */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">EmailJS Configuration</h2>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <ol className="text-sm text-blue-700 space-y-1">
            <li>1) 在 EmailJS 模板的 <b>Attachments</b> 里添加 <b>Variable Attachment</b></li>
            <li>2) <b>Parameter Name = pdf_attachment</b>, <b>Content Type = PDF</b>, 文件名可固定为 <code>yard-report.pdf</code></li>
            <li>3) 模板正文可使用变量：<code>{{`{{to_email}}`}}</code>, <code>{{`{{report_date}}`}}</code></li>
          </ol>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service ID</label>
            <input name="serviceId" value={emailjsConfig.serviceId} onChange={handleEmailjsConfigChange}
                   className="w-full px-3 py-2 border rounded-md" placeholder="service_xxx" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template ID</label>
            <input name="templateId" value={emailjsConfig.templateId} onChange={handleEmailjsConfigChange}
                   className="w-full px-3 py-2 border rounded-md" placeholder="template_xxx" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Public Key</label>
            <input name="publicKey" value={emailjsConfig.publicKey} onChange={handleEmailjsConfigChange}
                   className="w-full px-3 py-2 border rounded-md" placeholder="public_xxx" />
          </div>
        </div>
        <div className="flex space-x-3 mt-4">
          <button onClick={saveEmailjsConfig} disabled={emailjsConfigSaving}
                  className="bg-green-500 text-white px-4 py-2 rounded-md">
            {emailjsConfigSaving ? 'Saving...' : 'Save EmailJS Configuration'}
          </button>
          <button onClick={sendTestEmail}
                  disabled={!emailConfig.recipients || !emailjsConfig.serviceId || !emailjsConfig.templateId || !emailjsConfig.publicKey}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md">
            Send Test Email (Styled PDF)
          </button>
        </div>
      </div>

      {/* Email Recipients */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Email Recipients</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recipients (comma-separated)</label>
            <input name="recipients" value={emailConfig.recipients} onChange={handleEmailConfigChange}
                   className="w-full px-3 py-2 border rounded-md"
                   placeholder="email1@example.com, email2@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Send Time (for manual)</label>
            <input type="time" name="sendTime" value={emailConfig.sendTime} onChange={handleEmailConfigChange}
                   className="w-full px-3 py-2 border rounded-md" />
          </div>
        </div>
        <button onClick={saveEmailConfig} disabled={emailSaving}
                className="mt-4 bg-green-500 text-white px-4 py-2 rounded-md">
          {emailSaving ? 'Saving...' : 'Save Email Configuration'}
        </button>
      </div>

      {/* Yard CRUD */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{editingYard ? 'Edit Yard' : 'Add New Yard'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yard Name *</label>
              <input name="yardName" value={formData.yardName} onChange={handleInputChange}
                     disabled={!!editingYard}
                     className="w-full px-3 py-2 border rounded-md" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <input name="company" value={formData.company} onChange={handleInputChange}
                     className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class *</label>
              <select name="class" value={formData.class} onChange={handleInputChange}
                      className="w-full px-3 py-2 border rounded-md" required>
                <option value="Self-owned">Self-owned</option>
                <option value="JV Dealer">JV Dealer</option>
                <option value="External">External</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min</label>
              <input type="number" name="min" value={formData.min} onChange={handleInputChange}
                     className="w-full px-3 py-2 border rounded-md" min="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max</label>
              <input type="number" name="max" value={formData.max} onChange={handleInputChange}
                     className="w-full px-3 py-2 border rounded-md" min="0" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
                    className="bg-blue-500 text-white px-4 py-2 rounded-md">
              {saving ? 'Saving...' : (editingYard ? 'Update Yard' : 'Add Yard')}
            </button>
            {editingYard && (
              <button type="button" onClick={handleCancel}
                      className="bg-gray-500 text-white px-4 py-2 rounded-md">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Existing Yards */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-medium">Existing Yards ({Object.keys(yards).length})</h3>
        </div>
        <div className="divide-y">
          {Object.entries(yards).sort(([a],[b]) => a.localeCompare(b)).map(([name, y]) => (
            <div key={name} className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{name}</span>
                  <span className="text-sm text-gray-500">({y.Company || 'No company'})</span>
                  <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                    y.Class === 'Self-owned' ? 'bg-green-100 text-green-800' :
                    y.Class === 'JV Dealer' ? 'bg-blue-100 text-blue-800' :
                    'bg-orange-100 text-orange-800'
                  }`}>{y.Class}</span>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Min: {y.Min ?? '-'} &nbsp; Max: {y.Max ?? '-'}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => handleEdit(name)} className="text-blue-600">Edit</button>
                <button onClick={() => handleDelete(name)} className="text-red-600">Delete</button>
              </div>
            </div>
          ))}
          {Object.keys(yards).length === 0 && (
            <div className="text-center py-8 text-gray-500">No yards configured yet.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSetup;
