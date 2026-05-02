const nodemailer = require('nodemailer');
const path = require('path');
const logger = require('../../core/logger');

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Send report email to a list of subscribers
 */
async function sendReportEmail(subscribers, reportPath, reportFilename, reportDate, companyName, analysisResults = []) {
  const transporter = createTransporter();

  const dateFormatted = new Date(reportDate).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  let analysisHtml = '';
  if (analysisResults.length > 0) {
    analysisHtml = `
        <div style="margin-bottom: 24px;">
            <h3 style="color:#0f172a; margin-bottom:12px; font-size:18px;">Daily Market Analysis Summary</h3>
            ${analysisResults.map(a => `<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-bottom:12px;">
                <h4 style="margin:0 0 8px 0; color:#0f172a; font-size:16px;">${a.name} (${a.symbol}) — <span style="font-size:14px; font-weight:600; color:${a.commentary.tradeBias === 'Bullish' || a.commentary.tradeBias === 'Demand Zone' ? '#10b981' : '#ef4444'};">${a.commentary.tradeBias}</span></h4>
                <div style="font-size:13px; color:#475569; margin-bottom:12px;">
                    <strong>Analysis:</strong> ${a.commentary.biasSummary}
                </div>
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:8px; margin-bottom:12px;">
                    <table width="100%" style="font-size:12px; color:#475569; border-collapse:collapse; text-align:center;">
                        <tr style="background:#f1f5f9; font-weight:600;">
                            <td style="padding:6px; border-right:1px solid #e2e8f0;">S3</td>
                            <td style="padding:6px; border-right:1px solid #e2e8f0;">S2</td>
                            <td style="padding:6px; border-right:1px solid #e2e8f0;">S1</td>
                            <td style="padding:6px; background:#e2e8f0; border-right:1px solid #cbd5e1; font-weight:bold;">PP</td>
                            <td style="padding:6px; border-right:1px solid #e2e8f0;">R1</td>
                            <td style="padding:6px; border-right:1px solid #e2e8f0;">R2</td>
                            <td style="padding:6px;">R3</td>
                        </tr>
                        <tr>
                            <td style="padding:6px; border-right:1px solid #e2e8f0;">${a.indicators.pivotPoints?.s3?.toFixed(5) || 'N/A'}</td>
                            <td style="padding:6px; border-right:1px solid #e2e8f0;">${a.indicators.pivotPoints?.s2?.toFixed(5) || 'N/A'}</td>
                            <td style="padding:6px; border-right:1px solid #e2e8f0;">${a.indicators.pivotPoints?.s1?.toFixed(5) || 'N/A'}</td>
                            <td style="padding:6px; background:#f8fafc; border-right:1px solid #e2e8f0; font-weight:bold;">${a.indicators.pivotPoints?.pp?.toFixed(5) || 'N/A'}</td>
                            <td style="padding:6px; border-right:1px solid #e2e8f0;">${a.indicators.pivotPoints?.r1?.toFixed(5) || 'N/A'}</td>
                            <td style="padding:6px; border-right:1px solid #e2e8f0;">${a.indicators.pivotPoints?.r2?.toFixed(5) || 'N/A'}</td>
                            <td style="padding:6px;">${a.indicators.pivotPoints?.r3?.toFixed(5) || 'N/A'}</td>
                        </tr>
                    </table>
                </div>
                <div style="font-size:12px; color:#475569; display: flex; justify-content: space-between; background:#fff; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                    <div><strong>Entry Zone:</strong> <span style="color:#0f172a;">${a.commentary.entryZone}</span></div>
                    <div><strong>Stop Loss:</strong> <span style="color:#0f172a;">${a.commentary.stopLoss}</span></div>
                    <div><strong>Targets:</strong> <span style="color:#0f172a;">${(a.commentary.takeProfitTargets || []).join(' / ')}</span></div>
                </div>
            </div>`).join('')}
        </div>
        `;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#f8f9fa;font-family:Inter,Arial,sans-serif">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;margin-top:20px;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
        <tr>
          <td style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:30px;text-align:center">
            <div style="font-size:24px;font-weight:800;color:white">📊 ${companyName}</div>
            <div style="color:rgba(255,255,255,0.6);font-size:13px;margin-top:6px">Daily Technical Analysis Report</div>
          </td>
        </tr>
        <tr>
          <td style="padding:30px">
            <h2 style="color:#0f172a;margin-bottom:8px;font-size:20px">Your Daily Report is Ready</h2>
            <p style="color:#64748b;margin-bottom:20px;line-height:1.6">
              Your <strong>${dateFormatted}</strong> technical analysis report has been generated. See the summary below and the detailed PDF attached.
            </p>
            
            ${analysisHtml}
            
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:24px">
              <div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:8px">📎 Report Attached</div>
              <div style="font-size:12px;color:#64748b">${reportFilename}</div>
            </div>
            
            <p style="color:#64748b;font-size:12px;line-height:1.7;border-top:1px solid #f1f5f9;padding-top:16px;margin-top:16px">
              <strong style="color:#9a3412">⚠️ Disclaimer:</strong> This report is for informational purposes only and does not constitute financial advice. 
              Trading financial instruments involves risk of loss. Past performance is not indicative of future results.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0">
            ${companyName} | To unsubscribe, contact your administrator.
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const results = [];

  for (const subscriber of subscribers) {
    try {
      await transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME || companyName}" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
        to: subscriber.email,
        subject: `📊 Daily Technical Analysis Report — ${dateFormatted}`,
        html,
        attachments: [
          {
            filename: reportFilename,
            path: reportPath,
            contentType: 'application/pdf',
          },
        ],
      });

      results.push({ email: subscriber.email, success: true });
      logger.info(`Report email sent to ${subscriber.email}`);
    } catch (error) {
      results.push({ email: subscriber.email, success: false, error: error.message });
      logger.error(`Failed to send email to ${subscriber.email}: ${error.message}`);
    }
  }

  return results;
}

module.exports = { sendReportEmail };
