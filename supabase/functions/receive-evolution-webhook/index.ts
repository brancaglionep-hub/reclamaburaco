import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvolutionMessage {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text: string;
      };
      imageMessage?: {
        url?: string;
        caption?: string;
        mimetype?: string;
        base64?: string;
      };
      videoMessage?: {
        url?: string;
        caption?: string;
        mimetype?: string;
      };
      audioMessage?: {
        url?: string;
        mimetype?: string;
      };
      documentMessage?: {
        url?: string;
        fileName?: string;
        mimetype?: string;
      };
      locationMessage?: {
        degreesLatitude?: number;
        degreesLongitude?: number;
      };
    };
    messageTimestamp?: number;
  };
  sender?: string;
  apikey?: string;
}

Deno.serve(async (req) => {
  console.log('=== Receive Evolution Webhook ===');
  console.log('Method:', req.method);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: EvolutionMessage = await req.json();
    console.log('Evento recebido:', body.event);
    console.log('Instância:', body.instance);

    // Apenas processar mensagens recebidas (não enviadas)
    if (body.event !== 'messages.upsert' || body.data?.key?.fromMe) {
      console.log('Evento ignorado (não é mensagem recebida)');
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: 'Not an incoming message' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar prefeitura pela instância
    console.log('Buscando prefeitura pela instância:', body.instance);
    
    // Primeiro tentar buscar configuração global
    const { data: globalConfig } = await supabase
      .from('configuracoes_sistema')
      .select('valor')
      .eq('chave', 'evolution_api')
      .single();

    let evolutionUrl = '';
    let evolutionKey = '';

    // Buscar prefeitura
    const { data: prefeitura, error: prefeituraError } = await supabase
      .from('prefeituras')
      .select('id, nome, slug, evolution_api_url, evolution_api_key, evolution_instance_name')
      .eq('evolution_instance_name', body.instance)
      .eq('ativo', true)
      .single();

    if (prefeituraError || !prefeitura) {
      console.error('Prefeitura não encontrada para instância:', body.instance);
      return new Response(
        JSON.stringify({ success: false, error: 'Prefeitura não encontrada para esta instância' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Prefeitura encontrada:', prefeitura.nome);

    // Definir URL e chave da Evolution (priorizar global, depois local)
    if (globalConfig?.valor) {
      const config = globalConfig.valor as { url?: string; api_key?: string };
      evolutionUrl = config.url || '';
      evolutionKey = config.api_key || '';
    }
    if (!evolutionUrl && prefeitura.evolution_api_url) {
      evolutionUrl = prefeitura.evolution_api_url;
    }
    if (!evolutionKey && prefeitura.evolution_api_key) {
      evolutionKey = prefeitura.evolution_api_key;
    }

    // Extrair dados da mensagem
    const phoneNumber = body.data.key.remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
    const senderName = body.data.pushName || 'Cidadão';

    // Extrair texto da mensagem
    let messageText = '';
    if (body.data.message?.conversation) {
      messageText = body.data.message.conversation;
    } else if (body.data.message?.extendedTextMessage?.text) {
      messageText = body.data.message.extendedTextMessage.text;
    } else if (body.data.message?.imageMessage?.caption) {
      messageText = body.data.message.imageMessage.caption;
    } else if (body.data.message?.videoMessage?.caption) {
      messageText = body.data.message.videoMessage.caption;
    }

    // Extrair localização se disponível
    let localizacao: { lat: number; lng: number } | null = null;
    if (body.data.message?.locationMessage) {
      localizacao = {
        lat: body.data.message.locationMessage.degreesLatitude || 0,
        lng: body.data.message.locationMessage.degreesLongitude || 0,
      };
    }

    // Extrair mídia se disponível
    const fotos: string[] = [];
    const videos: string[] = [];

    if (body.data.message?.imageMessage?.url) {
      fotos.push(body.data.message.imageMessage.url);
    }
    if (body.data.message?.videoMessage?.url) {
      videos.push(body.data.message.videoMessage.url);
    }

    console.log('Mensagem recebida:', { phoneNumber, senderName, messageText: messageText.substring(0, 100), localizacao: !!localizacao, fotos: fotos.length, videos: videos.length });

    // Registrar no webhook_logs
    const logPayload = {
      event: body.event,
      instance: body.instance,
      phone: phoneNumber,
      name: senderName,
      message: messageText.substring(0, 500),
      hasLocation: !!localizacao,
      hasMedia: fotos.length > 0 || videos.length > 0,
    };

    await supabase.from('webhook_logs').insert({
      prefeitura_id: prefeitura.id,
      source: 'evolution-ai',
      payload: logPayload,
      status: 'received',
    });

    // Chamar o agente de IA
    console.log('Chamando agente de IA...');
    const agentResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-ai-agent`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prefeitura: {
          id: prefeitura.id,
          nome: prefeitura.nome,
          slug: prefeitura.slug,
          evolution_api_url: evolutionUrl,
          evolution_api_key: evolutionKey,
          evolution_instance_name: prefeitura.evolution_instance_name,
        },
        mensagem: {
          texto: messageText,
          fotos,
          videos,
          localizacao,
          telefone: phoneNumber,
          nome: senderName,
        },
        instanceName: body.instance,
      }),
    });

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      console.error('Erro do agente:', errorText);
      throw new Error(`Erro do agente: ${agentResponse.status}`);
    }

    const agentResult = await agentResponse.json();
    console.log('Resposta do agente:', agentResult.acao, agentResult.protocolo || '');

    // Enviar resposta ao cidadão
    if (evolutionUrl && evolutionKey && agentResult.resposta) {
      try {
        console.log('Enviando resposta via Evolution API...');
        const sendResponse = await fetch(`${evolutionUrl}/message/sendText/${body.instance}`, {
          method: 'POST',
          headers: {
            'apikey': evolutionKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            number: phoneNumber,
            text: agentResult.resposta,
          }),
        });

        if (!sendResponse.ok) {
          const sendError = await sendResponse.text();
          console.error('Erro ao enviar resposta:', sendError);
        } else {
          console.log('Resposta enviada com sucesso');
        }
      } catch (sendError) {
        console.error('Erro ao enviar resposta:', sendError);
      }
    }

    // Atualizar log com resultado
    if (agentResult.protocolo) {
      const { data: recCriada } = await supabase
        .from('reclamacoes')
        .select('id')
        .eq('protocolo', agentResult.protocolo)
        .single();

      await supabase.from('webhook_logs').insert({
        prefeitura_id: prefeitura.id,
        source: 'evolution-ai',
        payload: { ...logPayload, action: 'reclamacao_criada', protocolo: agentResult.protocolo },
        status: 'success',
        reclamacao_id: recCriada?.id || null,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        acao: agentResult.acao,
        protocolo: agentResult.protocolo || null,
        prefeitura: prefeitura.nome,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro não tratado:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
