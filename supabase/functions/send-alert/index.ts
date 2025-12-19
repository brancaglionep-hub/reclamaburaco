import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const prefeituraNome = alerta.prefeitura?.nome || "Prefeitura";
    let totalEnviados = 0;
    let totalErros = 0;

    // Process each citizen
    for (const cidadao of cidadaos || []) {
      for (const canal of alerta.canais) {
        try {
          // Create send record
          const { error: envioError } = await supabase.from("alerta_envios").insert({
            alerta_id: alertaId,
            cidadao_id: cidadao.id,
            canal: canal,
            status: "enviado",
            enviado_em: new Date().toISOString(),
          });

          if (envioError) {
            console.error("Erro ao registrar envio:", envioError);
            totalErros++;
          } else {
            totalEnviados++;
          }

          // TODO: Integrate with actual messaging APIs (WhatsApp, SMS, Push)
          // For now, we just log the message that would be sent
          console.log(`[${canal.toUpperCase()}] Sending to ${cidadao.nome}:`, {
            message: `🚨 ALERTA OFICIAL – ${prefeituraNome}\n\n${alerta.titulo}\n\n${alerta.mensagem}\n\nEm caso de emergência ligue 199.\nMensagem oficial da Prefeitura.`,
          });
        } catch (err) {
          console.error("Erro ao processar envio:", err);
          totalErros++;
        }
      }
    }

    // Update alert totals
    await supabase
      .from("alertas")
      .update({
        total_enviados: totalEnviados,
        total_erros: totalErros,
      })
      .eq("id", alertaId);

    console.log(`Alerta ${alertaId} processado: ${totalEnviados} enviados, ${totalErros} erros`);

    return new Response(
      JSON.stringify({ success: true, enviados: totalEnviados, erros: totalErros }),
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
