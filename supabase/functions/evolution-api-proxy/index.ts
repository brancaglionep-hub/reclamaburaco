import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { prefeituraId, endpoint, method = "GET", body } = await req.json();

    if (!prefeituraId || !endpoint) {
      return new Response(
        JSON.stringify({ error: "prefeituraId e endpoint são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch Evolution API config from prefeitura
    const { data: prefeitura, error: prefError } = await supabaseClient
      .from("prefeituras")
      .select("evolution_api_url, evolution_api_key, evolution_instance_name")
      .eq("id", prefeituraId)
      .single();

    if (prefError || !prefeitura) {
      return new Response(
        JSON.stringify({ error: "Prefeitura não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { evolution_api_url, evolution_api_key, evolution_instance_name } = prefeitura;

    if (!evolution_api_url || !evolution_api_key) {
      return new Response(
        JSON.stringify({ error: "Evolution API não configurada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Replace placeholders in endpoint
    const finalEndpoint = endpoint.replace("{instanceName}", evolution_instance_name || "");
    const url = `${evolution_api_url.replace(/\/$/, "")}${finalEndpoint}`;

    console.log(`Proxying request to: ${url}`);

    // Make request to Evolution API
    const fetchOptions: RequestInit = {
      method,
      headers: {
        "apikey": evolution_api_key,
        "Content-Type": "application/json",
      },
    };

    if (body && method !== "GET") {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    const responseData = await response.json().catch(() => ({}));

    console.log(`Evolution API response status: ${response.status}`);

    // Update connection status if checking connection state
    if (endpoint.includes("connectionState")) {
      const isConnected = responseData.instance?.state === "open" || responseData.state === "open";
      await supabaseClient
        .from("prefeituras")
        .update({ evolution_connected: isConnected })
        .eq("id", prefeituraId);
    }

    return new Response(
      JSON.stringify(responseData),
      { 
        status: response.status, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error: unknown) {
    console.error("Proxy error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
