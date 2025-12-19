import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Twilio credentials
const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

// Resend for email
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = resendApiKey ? new Resend(resendApiKey) : null;

interface SendResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

// Send Email via Resend
async function sendEmail(to: string, subject: string, message: string, prefeituraNome: string): Promise<SendResult> {
  if (!resend) {
    console.log("[EMAIL] Resend not configured, skipping...");
    return { success: false, error: "Resend não configurado" };
  }

  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .footer { background: #333; color: white; padding: 15px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px; }
          .alert-icon { font-size: 32px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="alert-icon">🚨</div>
            <h1 style="margin: 10px 0 0 0;">ALERTA OFICIAL</h1>
            <p style="margin: 5px 0 0 0;">${prefeituraNome}</p>
          </div>
          <div class="content">
            <h2 style="color: #dc2626; margin-top: 0;">${subject}</h2>
            <p>${message.replace(/\n/g, '<br>')}</p>
          </div>
          <div class="footer">
            <p style="margin: 0;">Em caso de emergência ligue <strong>199</strong></p>
            <p style="margin: 5px 0 0 0;">Mensagem oficial da ${prefeituraNome}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const response = await resend.emails.send({
      from: `Alertas ${prefeituraNome} <alertas@civitainfra.com.br>`,
      to: [to],
      subject: `🚨 ALERTA: ${subject}`,
      html: htmlContent,
    });

    if (response.error) {
      console.error("[EMAIL] Resend error:", response.error);
      return { success: false, error: response.error.message || "Erro ao enviar email" };
    }

    console.log("[EMAIL] Sent successfully:", response.data?.id);
    return { success: true, messageId: response.data?.id };
  } catch (error: unknown) {
    console.error("[EMAIL] Error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return { success: false, error: message };
  }
}

// Send SMS via Twilio
async function sendSMS(to: string, message: string): Promise<SendResult> {
  if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
    console.log("[SMS] Twilio not configured, skipping...");
    return { success: false, error: "Twilio não configurado" };
  }

  try {
    let formattedPhone = to.replace(/\D/g, "");
    if (!formattedPhone.startsWith("55")) {
      formattedPhone = "55" + formattedPhone;
    }
    formattedPhone = "+" + formattedPhone;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: twilioPhoneNumber,
        To: formattedPhone,
        Body: message,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[SMS] Twilio error:", data);
      return { success: false, error: data.message || "Erro ao enviar SMS" };
    }

    console.log("[SMS] Sent successfully:", data.sid);
    return { success: true, messageId: data.sid };
  } catch (error: unknown) {
    console.error("[SMS] Error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return { success: false, error: message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { alertaId } = await req.json();

    if (!alertaId) {
      return new Response(JSON.stringify({ error: "alertaId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch alert details
    const { data: alerta, error: alertaError } = await supabase
      .from("alertas")
      .select("*, prefeitura:prefeituras(nome)")
      .eq("id", alertaId)
      .single();

    if (alertaError || !alerta) {
      console.error("Erro ao buscar alerta:", alertaError);
      return new Response(JSON.stringify({ error: "Alert not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch citizens to notify
    let query = supabase
      .from("cidadaos")
      .select("id, nome, telefone, email")
      .eq("prefeitura_id", alerta.prefeitura_id)
      .eq("ativo", true)
      .eq("aceita_alertas", true);

    if (alerta.bairro_id) {
      query = query.eq("bairro_id", alerta.bairro_id);
    }

    const { data: cidadaos, error: cidadaosError } = await query;

    if (cidadaosError) {
      console.error("Erro ao buscar cidadãos:", cidadaosError);
      return new Response(JSON.stringify({ error: "Error fetching citizens" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const totalCidadaos = cidadaos?.length || 0;
    const totalEnviosEsperados = totalCidadaos * (alerta.canais?.length || 1);
    
    // Initialize progress
    await supabase
      .from("alertas")
      .update({
        total_enviados: 0,
        total_erros: totalEnviosEsperados,
      })
      .eq("id", alertaId);

    const prefeituraNome = alerta.prefeitura?.nome || "Prefeitura";
    let totalEnviados = 0;
    let totalErros = 0;

    // Build message
    const mensagemCompleta = `🚨 ALERTA OFICIAL – ${prefeituraNome}\n\n${alerta.titulo}\n\n${alerta.mensagem}\n\nEm caso de emergência ligue 199.\nMensagem oficial da Prefeitura.`;

    console.log(`Iniciando envio de alerta ${alertaId} para ${totalCidadaos} cidadãos via ${alerta.canais.join(", ")}`);

    // Process each citizen
    for (const cidadao of cidadaos || []) {
      for (const canal of alerta.canais) {
        let sendResult: SendResult = { success: false, error: "Canal não suportado" };
        let status: "enviado" | "erro" = "erro";
        let errorMessage: string | null = null;

        // Send based on channel
        switch (canal) {
          case "sms":
            if (!cidadao.telefone) {
              console.log(`[SMS] Cidadão ${cidadao.nome} sem telefone cadastrado`);
              sendResult = { success: false, error: "Telefone não cadastrado" };
            } else {
              sendResult = await sendSMS(cidadao.telefone, mensagemCompleta);
            }
            break;
          case "email":
            if (!cidadao.email) {
              console.log(`[EMAIL] Cidadão ${cidadao.nome} sem email cadastrado`);
              sendResult = { success: false, error: "Email não cadastrado" };
            } else {
              sendResult = await sendEmail(cidadao.email, alerta.titulo, alerta.mensagem, prefeituraNome);
            }
            break;
          case "push":
            console.log(`[PUSH] Push notification for ${cidadao.nome} - not implemented`);
            sendResult = { success: false, error: "Push não implementado" };
            break;
          case "whatsapp":
            console.log(`[WHATSAPP] WhatsApp for ${cidadao.nome} - temporarily disabled`);
            sendResult = { success: false, error: "WhatsApp temporariamente desativado" };
            break;
        }

        // Update status based on result
        if (sendResult.success) {
          status = "enviado";
          totalEnviados++;
        } else {
          status = "erro";
          errorMessage = sendResult.error || "Erro desconhecido";
          totalErros++;
        }

        // Create send record
        try {
          await supabase.from("alerta_envios").insert({
            alerta_id: alertaId,
            cidadao_id: cidadao.id,
            canal: canal,
            status: status,
            enviado_em: status === "enviado" ? new Date().toISOString() : null,
            erro_mensagem: errorMessage,
          });
        } catch (err) {
          console.error("Erro ao registrar envio:", err);
        }

        // Update progress in real-time
        await supabase
          .from("alertas")
          .update({
            total_enviados: totalEnviados,
          })
          .eq("id", alertaId);
      }
    }

    // Final update with actual error count
    await supabase
      .from("alertas")
      .update({
        total_enviados: totalEnviados,
        total_erros: totalErros,
      })
      .eq("id", alertaId);

    console.log(`Alerta ${alertaId} processado: ${totalEnviados} enviados, ${totalErros} erros`);

    return new Response(
      JSON.stringify({ success: true, enviados: totalEnviados, erros: totalErros, total: totalEnviosEsperados }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error processing alert:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
