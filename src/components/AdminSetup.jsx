import React, { useState, useEffect } from 'react';
import { createYard, updateYard, deleteYard, getAllYards } from '../firebase/database';
import emailjs from '@emailjs/browser';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const AdminSetup = () => {
  const [yards, setYards] = useState({});
  const [formData, setFormData] = useState({
    yardName: '',
    company: '',
    class: 'Self-owned',
    min: '',
    max: ''
  });
  const [editingYard, setEditingYard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Email scheduling state
  const [emailConfig, setEmailConfig] = useState({
    recipients: '',
    sendTime: '09:00',
    sendDay: 'monday',
    enabled: false
  });
  const [emailSaving, setEmailSaving] = useState(false);

  // EmailJS configuration state
  const [emailjsConfig, setEmailjsConfig] = useState({
    serviceId: 'service_q3qp9rz',
    templateId: 'template_jp0j1s4',
    publicKey: 'Ox1_IwykSClDMOhqz'
  });
  const [emailjsConfigSaving, setEmailjsConfigSaving] = useState(false);

  useEffect(() => {
    loadYards();
    loadEmailConfig();
    loadEmailjsConfig();
  }, []);

  const loadYards = async () => {
    setLoading(true);
    const yardsData = await getAllYards();
    setYards(yardsData);
    setLoading(false);
  };

  const loadEmailConfig = () => {
    const savedConfig = localStorage.getItem('emailConfig');
    if (savedConfig) setEmailConfig(JSON.parse(savedConfig));
  };

  const loadEmailjsConfig = () => {
    const savedConfig = localStorage.getItem('emailjsConfig');
    if (savedConfig) setEmailjsConfig(JSON.parse(savedConfig));
  };

  const saveEmailjsConfig = () => {
    setEmailjsConfigSaving(true);
    localStorage.setItem('emailjsConfig', JSON.stringify(emailjsConfig));
    setTimeout(() => {
      setEmailjsConfigSaving(false);
      alert('EmailJS configuration saved successfully!');
    }, 600);
  };

  const saveEmailConfig = () => {
    setEmailSaving(true);
    localStorage.setItem('emailConfig', JSON.stringify(emailConfig));
    setTimeout(() => {
      setEmailSaving(false);
      alert('Email configuration saved successfully!');
    }, 600);
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  /** 截图页面上的报告区域为 PDF（A4，多页自动分页）并返回 Data URL */
  const captureReportAreaToPdfDataUrl = async () => {
    // 尝试多种常见容器选择器，与你的 Analytics 页面保持兼容
    const el =
      document.querySelector('.pdf-content') ||
      document.querySelector('#pdf-content') ||
      document.querySelector('#report') ||
      document.querySelector('#analytics-root');

    if (!el) return null;

    // 用 html2canvas 把该区域渲染为高分辨率画布
    const canvas = await html2canvas(el, {
      scale: 2,                // 高清
      useCORS: true,           // 允许跨域图片
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4'); // A4 竖向

    const pdfW = pdf.internal.pageSize.getWidth();   // 210mm
    const pdfH = pdf.internal.pageSize.getHeight();  // 297mm

    // 以宽度等比缩放图片
    const imgW = pdfW;
    const imgH = (canvas.height * imgW) / canvas.width;

    let y = 0;
    // 首页
    pdf.addImage(imgData, 'PNG', 0, y, imgW, imgH, undefined, 'FAST');

    // 如果高度超过一页，分页处理
    let heightLeft = imgH - pdfH;
    while (heightLeft > 0) {
      pdf.addPage();
      y = -(imgH - heightLeft);
      pdf.addImage(imgData, 'PNG', 0, y, imgW, imgH, undefined, 'FAST');
      heightLeft -= pdfH;
    }

    return pdf.output('datauristring'); // 完整 Data URL
  };

  /** 当页面上没有报告区域时，生成一个“摘要报表 PDF”并返回 Data URL */
  const buildFallbackPdfDataUrl = () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const marginX = 14;
    const lineH = 7;

    // 标题
    pdf.setFontSize(18);
    pdf.text('Yard Inventory – Summary Report', marginX, 18);

    // 副标题
    pdf.setFontSize(11);
    pdf.text(`Generated at: ${new Date().toLocaleString()}`, marginX, 28);

    // 收件人
    pdf.text(`Recipients: ${(emailConfig.recipients || '').trim() || '-'}`, marginX, 35);

    // 表头
    const headers = ['Yard', 'Company', 'Class', 'Min', 'Max'];
    const colsW = [60, 50, 30, 20, 20]; // 总宽 180mm 内
    let cursorY = 48;

    pdf.setFillColor(245, 245, 245);
    pdf.rect(marginX, cursorY - 5, colsW.reduce((a, b) => a + b, 0), 8, 'F');
    pdf.setFontSize(11);
    let x = marginX;
    headers.forEach((h, i) => {
      pdf.text(h, x + 2, cursorY);
      x += colsW[i];
    });
    cursorY += 4;

    // 表体
    pdf.setFontSize(10);
    const rows = Object.entries(yards)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, y]) => [
        name,
        y?.Company || '',
        y?.Class || '',
        y?.Min ?? '',
        y?.Max ?? ''
      ]);

    const pageH = pdf.internal.pageSize.getHeight();
    rows.forEach((row, idx) => {
      // 分页检查
      if (cursorY + lineH > pageH - 15) {
        pdf.addPage();
        cursorY = 20;
      }
      // 绘制一行
      let colX = marginX;
      row.forEach((cell, i) => {
        const txt = String(cell);
        pdf.text(txt, colX + 2, cursorY);
        colX += colsW[i];
      });
      cursorY += lineH;
    });

    return pdf.output('datauristring');
  };

  /** 发送测试邮件（优先截图报告区域 → 否则回退为摘要表） */
  const sendTestEmail = async () => {
    try {
      // 初始化 EmailJS
      emailjs.init(emailjsConfig.publicKey);

      // 先尝试“截图报告区域”的 PDF
      let pdfDataUrl = await captureReportAreaToPdfDataUrl();

      // 如果没找到报告区域，回退为摘要 PDF
      if (!pdfDataUrl || !pdfDataUrl.startsWith('data:application/pdf')) {
        pdfDataUrl = buildFallbackPdfDataUrl();
      }

      if (typeof pdfDataUrl !== 'string' || !pdfDataUrl.startsWith('data:application/pdf')) {
        throw new Error('PDF generation failed (not a PDF Data URL).');
      }

      // 多收件人逐个发送（逗号分隔）
      const recipients = (emailConfig.recipients || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      if (recipients.length === 0) {
        alert('Please fill in at least one recipient.');
        return;
      }

      for (const to of recipients) {
        const templateParams = {
          to_email: to,
          report_date: new Date().toLocaleDateString(),
          // 模板 Attachments 的 Variable Attachment 参数名需是 pdf_attachment（PDF 类型）
          pdf_attachment: pdfDataUrl
        };

        await emailjs.send(
          emailjsConfig.serviceId,
          emailjsConfig.templateId,
          templateParams
        );

        // 轻微节流（EmailJS 建议 1 rps 左右）
        await sleep(1200);
      }

      alert('Test email sent successfully!');
    } catch (error) {
      console.error('Error sending test email:', error);
      alert('Error sending test email: ' + (error?.message || 'Unknown error'));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleEmailConfigChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEmailConfig({ ...emailConfig, [name]: type === 'checkbox' ? checked : value });
  };

  const handleEmailjsConfigChange = (e) => {
    const { name, value } = e.target;
    setEmailjsConfig({ ...emailjsConfig, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.yardName.trim()) return;

    setSaving(true);

    const yardData = {
      Company: formData.company,
      Class: formData.class,
      Min: formData.min ? parseInt(formData.min) : null,
      Max: formData.max ? parseInt(formData.max) : null
    };

    let result;
    if (editingYard) {
      result = await updateYard(formData.yardName, yardData);
    } else {
      result = await createYard(formData.yardName, yardData);
    }

    if (result.success) {
      setFormData({ yardName: '', company: '', class: 'Self-owned', min: '', max: '' });
      setEditingYard(null);
      loadYards();
    } else {
      alert('Error: ' + result.error);
    }

    setSaving(false);
  };

  const handleEdit = (yardName) => {
    const yard = yards[yardName];
    setFormData({
      yardName,
      company: yard.Company || '',
      class: yard.Class || 'Self-owned',
      min: yard.Min ? yard.Min.toString() : '',
      max: yard.Max ? yard.Max.toString() : ''
    });
    setEditingYard(yardName);
  };

  const handleDelete = async (yardName) => {
    if (!confirm(`Are you sure you want to delete ${yardName}?`)) return;
    const result = await deleteYard(yardName);
    if (result.success) loadYards();
    else alert('Error: ' + result.error);
  };

  const handleCancel = () => {
    setFormData({ yardName: '', company: '', class: 'Self-owned', min: '', max: '' });
    setEditingYard(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Yard Management Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">
          {editingYard ? 'Edit Yard' : 'Add New Yard'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yard Name *</label>
              <input
                type="text"
                name="yardName"
                value={formData.yardName}
                onChange={handleInputChange}
                disabled={editingYard}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <input
                type="text"
                name="company"
                value={formData.company}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class *</label>
              <select
                name="class"
                value={formData.class}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="Self-owned">Self-owned</option>
                <option value="JV Dealer">JV Dealer</option>
                <option value="External">External</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Stock Level</label>
              <input
                type="number"
                name="min"
                value={formData.min}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Stock Level</label>
              <input
                type="number"
                name="max"
                value={formData.max}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
              />
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : (editingYard ? 'Update Yard' : 'Add Yard')}
            </button>

            {editingYard && (
              <button
                type="button"
                onClick={handleCancel}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* EmailJS Configuration */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">EmailJS Configuration</h2>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Setup Instructions:</h3>
            <ol className="text-sm text-blue-700 space-y-1">
              <li>1. Create an account at <a href="https://www.emailjs.com/" target="_blank" rel="noopener noreferrer" className="underline">emailjs.com</a></li>
              <li>2. Create an Email Service (e.g., Gmail/SMTP)</li>
              <li>3. Create an Email Template with variables: <code>to_email</code>, <code>report_date</code></li>
              <li>4. In <strong>Attachments</strong>, add a <strong>Variable Attachment</strong> with <strong>Parameter Name = pdf_attachment</strong>, <strong>Content Type = PDF</strong>, a fixed filename like <code>yard-report.pdf</code>.</li>
              <li>5. Fill Service ID, Template ID, Public Key below and save.</li>
            </ol>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service ID</label>
              <input
                type="text"
                name="serviceId"
                value={emailjsConfig.serviceId}
                onChange={handleEmailjsConfigChange}
                placeholder="service_xxxxxxx"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template ID</label>
              <input
                type="text"
                name="templateId"
                value={emailjsConfig.templateId}
                onChange={handleEmailjsConfigChange}
                placeholder="template_xxxxxxx"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Public Key</label>
              <input
                type="text"
                name="publicKey"
                value={emailjsConfig.publicKey}
                onChange={handleEmailjsConfigChange}
                placeholder="Your public key"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={saveEmailjsConfig}
              disabled={emailjsConfigSaving}
              className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {emailjsConfigSaving ? 'Saving...' : 'Save EmailJS Configuration'}
            </button>

            <button
              onClick={sendTestEmail}
              disabled={
                !emailConfig.recipients ||
                !emailjsConfig.serviceId ||
                !emailjsConfig.templateId ||
                !emailjsConfig.publicKey
              }
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Send Test Email
            </button>
          </div>
        </div>
      </div>

      {/* Email Configuration */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Email Recipients</h2>

        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-orange-800 mb-2">Note about Scheduled Emails:</h3>
            <p className="text-sm text-orange-700">
              This is a frontend-only application. Scheduled emails will only work when someone has the app open in their browser.
              For true automated scheduling, please use a backend service (e.g., Render Cron Job or Firebase Cloud Functions).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipients (comma-separated)</label>
              <input
                type="text"
                name="recipients"
                value={emailConfig.recipients}
                onChange={handleEmailConfigChange}
                placeholder="email1@example.com, email2@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Send Time (for manual sending)</label>
              <input
                type="time"
                name="sendTime"
                value={emailConfig.sendTime}
                onChange={handleEmailConfigChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            onClick={saveEmailConfig}
            disabled={emailSaving}
            className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {emailSaving ? 'Saving...' : 'Save Email Configuration'}
          </button>
        </div>
      </div>

      {/* Existing Yards */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium">Existing Yards ({Object.keys(yards).length})</h3>
        </div>

        <div className="divide-y divide-gray-100">
          {Object.entries(yards)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([yardName, yardData]) => (
              <div key={yardName} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-1">
                      <h4 className="text-base font-medium text-gray-900 truncate">{yardName}</h4>
                      <span className="text-sm text-gray-500">({yardData.Company || 'No company'})</span>
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                          yardData.Class === 'Self-owned'
                            ? 'bg-green-100 text-green-800'
                            : yardData.Class === 'JV Dealer'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {yardData.Class}
                      </span>
                    </div>

                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>Min: {yardData.Min || 'Not set'}</span>
                      <span>Max: {yardData.Max || 'Not set'}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleEdit(yardName)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(yardName)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>

        {Object.keys(yards).length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No yards configured yet. Add your first yard above.
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSetup;
