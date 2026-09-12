import { createServiceClient } from '../_shared/supabase-client.ts';
import { buildReport } from '../_shared/report-builder.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { audit_run_id } = await req.json();
    if (!audit_run_id) return new Response('Missing audit_run_id', { status: 400 });

    const supabase = createServiceClient();
    
    const { data: auditRun, error: runError } = await supabase
      .from('audit_runs')
      .select('*')
      .eq('id', audit_run_id)
      .single();
      
    if (runError || !auditRun) throw new Error('Audit run not found');

    const { data: findings, error: findingsError } = await supabase
      .from('findings')
      .select('*')
      .eq('audit_run_id', audit_run_id);
      
    if (findingsError) throw findingsError;

    const groqKey = Deno.env.get('GROQ_API_KEY');
    let aiSummary = "This report presents the findings of an automated security audit. Review each finding below for detailed remediation guidance.";
    if (groqKey) {
      try {
        const findingSummaries = (findings || []).map((f: any) => ({ title: f.title, severity: f.severity, status: f.status }));
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{
              role: 'user',
              content: `Write a 3-paragraph executive summary for a security audit with score ${auditRun.score}/100 and these findings: ${JSON.stringify(findingSummaries)}`
            }]
          })
        });
        if (groqRes.ok) {
          const groqData = await groqRes.json();
          aiSummary = groqData.choices[0]?.message?.content || aiSummary;
        }
      } catch (groqError) {
        console.error('Groq API error (non-fatal):', groqError);
      }
    }

    const pdfBytes = await buildReport(auditRun, findings || [], aiSummary);

    const fileName = `${audit_run_id}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('reports')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: urlData, error: urlError } = await supabase.storage
      .from('reports')
      .createSignedUrl(fileName, 60 * 60 * 24);

    if (urlError) throw urlError;

    await supabase.from('audit_runs').update({
      report_url: urlData.signedUrl
    }).eq('id', audit_run_id);

    return new Response(JSON.stringify({ success: true, report_url: urlData.signedUrl }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error generating report:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
