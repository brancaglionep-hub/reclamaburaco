import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Vonage credentials
const vonageApiKey = Deno.env.get("VONAGE_API_KEY");
const vonageApiSecret = Deno.env.get("VONAGE_API_SECRET");

// Resend for email
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = resendApiKey ? new Resend(resendApiKey) : null;

interface SendResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
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

// Send SMS via Vonage
async function sendSMS(to: string, message: string): Promise<SendResult> {
  if (!vonageApiKey || !vonageApiSecret) {
    console.log("[SMS] Vonage not configured, skipping...");
    return { success: false, error: "Vonage não configurado" };
  }

  try {
    // Format phone number: ensure it starts with country code
    let formattedPhone = to.replace(/\D/g, "");
    if (!formattedPhone.startsWith("55")) {
      formattedPhone = "55" + formattedPhone;
    }

    console.log(`[SMS] Sending to ${formattedPhone} via Vonage`);

    const response = await fetch("https://rest.nexmo.com/sms/json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: vonageApiKey,
        api_secret: vonageApiSecret,
        to: formattedPhone,
        from: "Prefeitura",
        text: message,
        type: "unicode",
      }),
    });

    const data = await response.json();
    console.log("[SMS] Vonage response:", JSON.stringify(data));

    // Vonage returns an array of messages, check the first one
    if (data.messages && data.messages.length > 0) {
      const firstMessage = data.messages[0];
      if (firstMessage.status === "0") {
        console.log("[SMS] Sent successfully:", firstMessage["message-id"]);
        return { success: true, messageId: firstMessage["message-id"] };
      } else {
        console.error("[SMS] Vonage error:", firstMessage["error-text"]);
        return { success: false, error: firstMessage["error-text"] || "Erro ao enviar SMS" };
      }
    }

    return { success: false, error: "Resposta inesperada da Vonage" };
  } catch (error: unknown) {
    console.error("[SMS] Error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return { success: false, error: message };
  }
}

// Send WhatsApp via Evolution API
async function sendWhatsAppEvolution(to: string, message: string, config: EvolutionConfig): Promise<SendResult> {
  try {
    // Format phone number
    let formattedPhone = to.replace(/\D/g, "");
    if (!formattedPhone.startsWith("55")) {
      formattedPhone = "55" + formattedPhone;
    }

    console.log(`[WHATSAPP] Sending to ${formattedPhone} via Evolution API`);

    const apiUrl = config.apiUrl.replace(/\/$/, "");
    const url = `${apiUrl}/message/sendText/${config.instanceName}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": config.apiKey,
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message,
      }),
    });

    const data = await response.json();
    console.log("[WHATSAPP] Evolution response:", JSON.stringify(data));

    if (response.ok && data.key?.id) {
      console.log("[WHATSAPP] Sent successfully:", data.key.id);
      return { success: true, messageId: data.key.id };
    } else {
      const errorMessage = data.message || data.error || "Erro ao enviar WhatsApp";
      console.error("[WHATSAPP] Evolution error:", errorMessage);
      return { success: false, error: errorMessage };
    }
  } catch (error: unknown) {
    console.error("[WHATSAPP] Error:", error);
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

    // Fetch alert details with prefeitura info including Evolution API config
    const { data: alerta, error: alertaError } = await supabase
      .from("alertas")
      .select("*, prefeitura:prefeituras(nome, evolution_api_url, evolution_api_key, evolution_instance_name, evolution_connected)")
      .eq("id", alertaId)
      .single();

    if (alertaError || !alerta) {
      console.error("Erro ao buscar alerta:", alertaError);
      return new Response(JSON.stringify({ error: "Alert not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check Evolution API configuration if WhatsApp is selected
    let evolutionConfig: EvolutionConfig | null = null;
    if (alerta.canais.includes("whatsapp")) {
      const prefeitura = alerta.prefeitura;
      
      // First, check global config (same priority as send-whatsapp-message)
      const { data: globalConfig } = await supabase
        .from("configuracoes_sistema")
        .select("valor")
        .eq("chave", "evolution_api")
        .single();

      let evolutionUrl = '';
      let evolutionKey = '';

      // Prioritize global config, then local (same as send-whatsapp-message)
      if (globalConfig?.valor) {
        const config = globalConfig.valor as { url?: string; api_key?: string };
        evolutionUrl = config.url || '';
        evolutionKey = config.api_key || '';
      }
      if (!evolutionUrl && prefeitura?.evolution_api_url) {
        evolutionUrl = prefeitura.evolution_api_url;
      }
      if (!evolutionKey && prefeitura?.evolution_api_key) {
        evolutionKey = prefeitura.evolution_api_key;
      }

      const instanceName = prefeitura?.evolution_instance_name;

      if (evolutionUrl && evolutionKey && instanceName && prefeitura?.evolution_connected) {
        evolutionConfig = {
          apiUrl: evolutionUrl,
          apiKey: evolutionKey,
          instanceName: instanceName,
        };
        console.log("[WHATSAPP] Using Evolution API config");
        console.log("[WHATSAPP] URL:", evolutionUrl);
        console.log("[WHATSAPP] Instance:", instanceName);
        console.log("[WHATSAPP] API Key (first 8 chars):", evolutionKey?.substring(0, 8) + "...");
      } else {
        console.warn("[WHATSAPP] Evolution API not properly configured");
        console.log("[WHATSAPP] URL:", evolutionUrl);
        console.log("[WHATSAPP] Key exists:", !!evolutionKey);
        console.log("[WHATSAPP] Instance:", instanceName);
        console.log("[WHATSAPP] Connected:", prefeitura?.evolution_connected);
      }
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
    const mensagemCompleta = `🚨 *ALERTA OFICIAL – ${prefeituraNome}*\n\n*${alerta.titulo}*\n\n${alerta.mensagem}\n\n_Em caso de emergência ligue 199._\n_Mensagem oficial da Prefeitura._`;

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
            if (!cidadao.telefone) {
              console.log(`[WHATSAPP] Cidadão ${cidadao.nome} sem telefone cadastrado`);
              sendResult = { success: false, error: "Telefone não cadastrado" };
            } else if (!evolutionConfig) {
              console.log(`[WHATSAPP] Evolution API não configurada`);
              sendResult = { success: false, error: "WhatsApp não configurado para esta prefeitura" };
            } else {
              sendResult = await sendWhatsAppEvolution(cidadao.telefone, mensagemCompleta, evolutionConfig);
            }
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
