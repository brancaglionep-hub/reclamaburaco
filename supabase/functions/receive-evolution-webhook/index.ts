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

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse do body
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
    const { data: prefeitura, error: prefeituraError } = await supabase
      .from('prefeituras')
      .select('id, nome, slug, evolution_api_url, evolution_api_key')
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

    console.log('Mensagem recebida:', { phoneNumber, senderName, messageText, localizacao, fotos, videos });

    // Registrar no webhook_logs
    const logPayload = {
      event: body.event,
      instance: body.instance,
      phone: phoneNumber,
      name: senderName,
      message: messageText,
      hasLocation: !!localizacao,
      hasMedia: fotos.length > 0 || videos.length > 0,
    };

    // Verificar comandos especiais
    const messageLower = messageText.toLowerCase().trim();
    
    // Comando: /consultar [protocolo]
    const isConsultCommand = messageLower.startsWith('/consultar ') || messageLower.startsWith('/status ');
    
    if (isConsultCommand) {
      const protocolo = messageText.substring(messageText.indexOf(' ') + 1).trim().toUpperCase();
      
      console.log('Consulta de protocolo:', protocolo);
      
      // Registrar consulta no log
      await supabase.from('webhook_logs').insert({
        prefeitura_id: prefeitura.id,
        source: 'evolution',
        payload: { ...logPayload, action: 'consulta', protocolo },
        status: 'info',
        error_message: null
      });

      // Buscar reclamação pelo protocolo
      const { data: consultaResult, error: consultaError } = await supabase
        .rpc('consultar_protocolo', {
          _protocolo: protocolo,
          _prefeitura_id: prefeitura.id
        });

      let responseText = '';
      
      if (consultaError || !consultaResult || consultaResult.length === 0) {
        responseText = `❌ *Protocolo não encontrado*\n\n` +
          `Não encontramos nenhuma reclamação com o protocolo *${protocolo}*.\n\n` +
          `Verifique se digitou corretamente e tente novamente.`;
      } else {
        const rec = consultaResult[0];
        
        // Mapear status para texto amigável
        const statusMap: Record<string, { emoji: string; texto: string }> = {
          'recebida': { emoji: '📥', texto: 'Recebida' },
          'em_andamento': { emoji: '🔄', texto: 'Em Andamento' },
          'resolvida': { emoji: '✅', texto: 'Resolvida' },
          'arquivada': { emoji: '📁', texto: 'Arquivada' }
        };
        
        const statusInfo = statusMap[rec.status] || { emoji: '❓', texto: rec.status };
        
        // Formatar datas
        const dataAbertura = new Date(rec.created_at).toLocaleDateString('pt-BR');
        const dataAtualizacao = new Date(rec.updated_at).toLocaleDateString('pt-BR');
        
        responseText = `📋 *Consulta de Protocolo*\n\n` +
          `🔖 *Protocolo:* ${rec.protocolo}\n` +
          `${statusInfo.emoji} *Status:* ${statusInfo.texto}\n` +
          `📍 *Local:* ${rec.rua}${rec.bairro_nome ? `, ${rec.bairro_nome}` : ''}\n` +
          `🏷️ *Categoria:* ${rec.categoria_nome || 'Não especificada'}\n` +
          `📅 *Abertura:* ${dataAbertura}\n` +
          `🔄 *Atualização:* ${dataAtualizacao}\n`;
        
        if (rec.resposta_prefeitura) {
          responseText += `\n💬 *Resposta da Prefeitura:*\n${rec.resposta_prefeitura}`;
        }
        
        responseText += `\n\n_${prefeitura.nome}_`;
      }

      // Enviar resposta
      if (prefeitura.evolution_api_url && prefeitura.evolution_api_key) {
        try {
          await fetch(`${prefeitura.evolution_api_url}/message/sendText/${body.instance}`, {
            method: 'POST',
            headers: {
              'apikey': prefeitura.evolution_api_key,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              number: phoneNumber,
              text: responseText
            }),
          });
        } catch (sendError) {
          console.error('Erro ao enviar resposta de consulta:', sendError);
        }
      }

      return new Response(
        JSON.stringify({ success: true, action: 'consulta', protocolo }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Comando: /reclamar ou reclamação:
    const isComplaintCommand = messageLower.startsWith('/reclamar ') || 
                                messageLower.startsWith('reclamação:') ||
                                messageLower.startsWith('reclamacao:');

    if (!isComplaintCommand) {
      // Mensagem comum - apenas registrar e responder com instruções
      await supabase.from('webhook_logs').insert({
        prefeitura_id: prefeitura.id,
        source: 'evolution',
        payload: logPayload,
        status: 'info',
        error_message: 'Mensagem recebida mas não é uma reclamação formatada'
      });

      // Enviar resposta automática com instruções
      if (prefeitura.evolution_api_url && prefeitura.evolution_api_key) {
        try {
          await fetch(`${prefeitura.evolution_api_url}/message/sendText/${body.instance}`, {
            method: 'POST',
            headers: {
              'apikey': prefeitura.evolution_api_key,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              number: phoneNumber,
              text: `👋 Olá ${senderName}! Bem-vindo ao sistema de reclamações da ${prefeitura.nome}.\n\n` +
                    `📝 *Para registrar uma reclamação:*\n` +
                    `*/reclamar [sua reclamação aqui]*\n\n` +
                    `🔍 *Para consultar o status:*\n` +
                    `*/consultar [número do protocolo]*\n\n` +
                    `Exemplo:\n` +
                    `*/reclamar Buraco na rua das Flores, 123, Centro*\n` +
                    `*/consultar REC-20250625-1234*\n\n` +
                    `Você também pode enviar fotos junto com a reclamação!`
            }),
          });
        } catch (sendError) {
          console.error('Erro ao enviar resposta:', sendError);
        }
      }

      return new Response(
        JSON.stringify({ success: true, action: 'instructions_sent' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extrair descrição da reclamação
    let descricao = messageText;
    if (messageText.toLowerCase().startsWith('/reclamar ')) {
      descricao = messageText.substring(10).trim();
    } else if (messageText.toLowerCase().startsWith('reclamação:') || messageText.toLowerCase().startsWith('reclamacao:')) {
      descricao = messageText.substring(11).trim();
    }

    // Tentar extrair endereço da descrição (formato simples)
    let rua = 'Endereço não informado';
    let bairro = '';
    
    // Tentar encontrar padrões de endereço na mensagem
    const ruaMatch = descricao.match(/(?:rua|av\.?|avenida|travessa)[:\s]+([^,|]+)/i);
    if (ruaMatch) {
      rua = ruaMatch[1].trim();
    }
    
    const bairroMatch = descricao.match(/(?:bairro)[:\s]+([^,|]+)/i);
    if (bairroMatch) {
      bairro = bairroMatch[1].trim();
    }

    // Buscar bairro no banco se encontrado
    let bairroId: string | null = null;
    if (bairro) {
      const { data: bairroData } = await supabase
        .from('bairros')
        .select('id')
        .eq('prefeitura_id', prefeitura.id)
        .ilike('nome', `%${bairro}%`)
        .eq('ativo', true)
        .single();
      
      if (bairroData) {
        bairroId = bairroData.id;
      }
    }

    // Criar reclamação
    console.log('Criando reclamação via Evolution...');
    const { data: reclamacao, error: reclamacaoError } = await supabase.rpc('criar_reclamacao_publica', {
      _prefeitura_id: prefeitura.id,
      _nome_cidadao: senderName,
      _email_cidadao: `${phoneNumber}@whatsapp.evolution`,
      _telefone_cidadao: phoneNumber,
      _rua: rua,
      _bairro_id: bairroId,
      _descricao: `[Via WhatsApp Evolution] ${descricao}`,
      _localizacao: localizacao,
      _fotos: fotos,
      _videos: videos,
    });

    if (reclamacaoError) {
      console.error('Erro ao criar reclamação:', reclamacaoError);
      
      await supabase.from('webhook_logs').insert({
        prefeitura_id: prefeitura.id,
        source: 'evolution',
        payload: logPayload,
        status: 'error',
        error_message: reclamacaoError.message
      });

      // Enviar resposta de erro
      if (prefeitura.evolution_api_url && prefeitura.evolution_api_key) {
        try {
          await fetch(`${prefeitura.evolution_api_url}/message/sendText/${body.instance}`, {
            method: 'POST',
            headers: {
              'apikey': prefeitura.evolution_api_key,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              number: phoneNumber,
              text: `❌ Desculpe ${senderName}, ocorreu um erro ao registrar sua reclamação. Por favor, tente novamente.`
            }),
          });
        } catch (sendError) {
          console.error('Erro ao enviar resposta de erro:', sendError);
        }
      }

      return new Response(
        JSON.stringify({ success: false, error: reclamacaoError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Reclamação criada:', reclamacao);

    // Buscar ID da reclamação
    const { data: reclamacaoCriada } = await supabase
      .from('reclamacoes')
      .select('id')
      .eq('protocolo', reclamacao[0].protocolo)
      .single();

    // Registrar sucesso no log
    await supabase.from('webhook_logs').insert({
      prefeitura_id: prefeitura.id,
      source: 'evolution',
      payload: logPayload,
      status: 'success',
      reclamacao_id: reclamacaoCriada?.id || null
    });

    // Enviar confirmação ao cidadão
    if (prefeitura.evolution_api_url && prefeitura.evolution_api_key) {
      try {
        await fetch(`${prefeitura.evolution_api_url}/message/sendText/${body.instance}`, {
          method: 'POST',
          headers: {
            'apikey': prefeitura.evolution_api_key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            number: phoneNumber,
            text: `✅ *Reclamação Registrada com Sucesso!*\n\n` +
                  `📋 *Protocolo:* ${reclamacao[0].protocolo}\n` +
                  `📍 *Local:* ${rua}\n` +
                  `📝 *Descrição:* ${descricao.substring(0, 100)}${descricao.length > 100 ? '...' : ''}\n\n` +
                  `Guarde este protocolo para acompanhar o status da sua reclamação.\n\n` +
                  `_${prefeitura.nome}_`
          }),
        });
      } catch (sendError) {
        console.error('Erro ao enviar confirmação:', sendError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        protocolo: reclamacao[0].protocolo,
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
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
