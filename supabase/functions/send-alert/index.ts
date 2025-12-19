import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Twilio credentials
const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
const twilioWhatsAppNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

interface SendResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

// Send SMS via Twilio
async function sendSMS(to: string, message: string): Promise<SendResult> {
  if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
    console.log("[SMS] Twilio not configured, skipping...");
    return { success: false, error: "Twilio não configurado" };
  }

  try {
    // Format phone number - ensure it has country code
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

// Send WhatsApp via Twilio
async function sendWhatsApp(to: string, message: string): Promise<SendResult> {
  if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppNumber) {
    console.log("[WhatsApp] Twilio not configured, skipping...");
    return { success: false, error: "Twilio WhatsApp não configurado" };
  }

  try {
    // Format phone number - ensure it has country code
    let formattedPhone = to.replace(/\D/g, "");
    if (!formattedPhone.startsWith("55")) {
      formattedPhone = "55" + formattedPhone;
    }
    formattedPhone = "whatsapp:+" + formattedPhone;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    // Format WhatsApp from number
    const fromWhatsApp = twilioWhatsAppNumber.startsWith("whatsapp:") 
      ? twilioWhatsAppNumber 
      : `whatsapp:${twilioWhatsAppNumber}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: fromWhatsApp,
        To: formattedPhone,
        Body: message,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[WhatsApp] Twilio error:", data);
      return { success: false, error: data.message || "Erro ao enviar WhatsApp" };
    }

    console.log("[WhatsApp] Sent successfully:", data.sid);
    return { success: true, messageId: data.sid };
  } catch (error: unknown) {
    console.error("[WhatsApp] Error:", error);
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

        // Check if citizen has phone number
        if (!cidadao.telefone) {
          console.log(`[${canal.toUpperCase()}] Cidadão ${cidadao.nome} sem telefone cadastrado`);
          sendResult = { success: false, error: "Telefone não cadastrado" };
        } else {
          // Send based on channel
          switch (canal) {
            case "sms":
              sendResult = await sendSMS(cidadao.telefone, mensagemCompleta);
              break;
            case "whatsapp":
              sendResult = await sendWhatsApp(cidadao.telefone, mensagemCompleta);
              break;
            case "push":
              // Push notifications not implemented yet
              console.log(`[PUSH] Push notification for ${cidadao.nome} - not implemented`);
              sendResult = { success: false, error: "Push não implementado" };
              break;
          }
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
