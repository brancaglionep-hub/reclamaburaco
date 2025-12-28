import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConversaData {
  id: string;
  prefeitura_id: string;
  telefone: string;
  nome_cidadao: string | null;
  estado: string;
  dados_coletados: {
    nome?: string;
    email?: string;
    rua?: string;
    numero?: string;
    bairro?: string;
    bairro_id?: string;
    categoria?: string;
    categoria_id?: string;
    descricao?: string;
    referencia?: string;
  };
  midias_coletadas: {
    fotos: string[];
    videos: string[];
  };
  localizacao: { lat: number; lng: number } | null;
}

interface PrefeituraData {
  id: string;
  nome: string;
  slug: string;
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  evolution_instance_name: string | null;
}

interface MensagemRecebida {
  texto: string;
  fotos: string[];
  videos: string[];
  localizacao: { lat: number; lng: number } | null;
  telefone: string;
  nome: string;
}

// Campos obrigatórios para criar uma reclamação
const CAMPOS_OBRIGATORIOS = ['nome', 'email', 'rua', 'bairro', 'descricao'];

Deno.serve(async (req) => {
  console.log('=== WhatsApp AI Agent ===');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { prefeitura, mensagem, instanceName } = await req.json() as {
      prefeitura: PrefeituraData;
      mensagem: MensagemRecebida;
      instanceName: string;
    };

    console.log('Processando mensagem de:', mensagem.telefone);
    console.log('Prefeitura:', prefeitura.nome);

    // Buscar ou criar conversa
    let { data: conversa, error: conversaError } = await supabase
      .from('whatsapp_conversas')
      .select('*')
      .eq('prefeitura_id', prefeitura.id)
      .eq('telefone', mensagem.telefone)
      .single();

    if (conversaError && conversaError.code === 'PGRST116') {
      // Criar nova conversa
      const { data: novaConversa, error: createError } = await supabase
        .from('whatsapp_conversas')
        .insert({
          prefeitura_id: prefeitura.id,
          telefone: mensagem.telefone,
          nome_cidadao: mensagem.nome,
          estado: 'inicio',
          dados_coletados: {},
          midias_coletadas: { fotos: [], videos: [] },
        })
        .select()
        .single();

      if (createError) {
        console.error('Erro ao criar conversa:', createError);
        throw new Error('Erro ao criar conversa');
      }
      conversa = novaConversa;
    } else if (conversaError) {
      console.error('Erro ao buscar conversa:', conversaError);
      throw new Error('Erro ao buscar conversa');
    }

    const conversaData = conversa as ConversaData;

    // Atualizar mídias se recebidas
    let midiasAtualizadas = { ...conversaData.midias_coletadas };
    if (mensagem.fotos.length > 0) {
      midiasAtualizadas.fotos = [...midiasAtualizadas.fotos, ...mensagem.fotos];
    }
    if (mensagem.videos.length > 0) {
      midiasAtualizadas.videos = [...midiasAtualizadas.videos, ...mensagem.videos];
    }

    // Atualizar localização se recebida
    let localizacaoAtualizada = conversaData.localizacao;
    if (mensagem.localizacao) {
      localizacaoAtualizada = mensagem.localizacao;
    }

    // Buscar bairros e categorias para contexto
    const [bairrosResult, categoriasResult] = await Promise.all([
      supabase
        .from('bairros')
        .select('id, nome')
        .eq('prefeitura_id', prefeitura.id)
        .eq('ativo', true)
        .order('nome'),
      supabase
        .from('categorias')
        .select('id, nome')
        .or(`prefeitura_id.eq.${prefeitura.id},global.eq.true`)
        .eq('ativo', true)
        .order('nome'),
    ]);

    const bairros = bairrosResult.data || [];
    const categorias = categoriasResult.data || [];

    // Verificar comando de consulta
    const textoLower = mensagem.texto.toLowerCase().trim();
    if (textoLower.startsWith('/consultar ') || textoLower.startsWith('/status ')) {
      const protocolo = mensagem.texto.substring(mensagem.texto.indexOf(' ') + 1).trim().toUpperCase();
      
      const { data: consultaResult } = await supabase
        .rpc('consultar_protocolo', {
          _protocolo: protocolo,
          _prefeitura_id: prefeitura.id,
        });

      let respostaConsulta = '';
      if (!consultaResult || consultaResult.length === 0) {
        respostaConsulta = `❌ Protocolo *${protocolo}* não encontrado. Verifique se digitou corretamente.`;
      } else {
        const rec = consultaResult[0];
        const statusMap: Record<string, string> = {
          recebida: '📥 Recebida',
          em_andamento: '🔄 Em Andamento',
          resolvida: '✅ Resolvida',
          arquivada: '📁 Arquivada',
        };
        respostaConsulta = `📋 *Protocolo:* ${rec.protocolo}\n` +
          `${statusMap[rec.status] || rec.status}\n` +
          `📍 ${rec.rua}${rec.bairro_nome ? `, ${rec.bairro_nome}` : ''}\n` +
          `📅 ${new Date(rec.created_at).toLocaleDateString('pt-BR')}\n`;
        if (rec.resposta_prefeitura) {
          respostaConsulta += `\n💬 *Resposta:* ${rec.resposta_prefeitura}`;
        }
      }

      return new Response(
        JSON.stringify({ resposta: respostaConsulta, acao: 'consulta' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar comando de cancelamento
    if (textoLower === '/cancelar' || textoLower === 'cancelar') {
      await supabase
        .from('whatsapp_conversas')
        .update({
          estado: 'inicio',
          dados_coletados: {},
          midias_coletadas: { fotos: [], videos: [] },
          localizacao: null,
          ultima_mensagem_at: new Date().toISOString(),
        })
        .eq('id', conversaData.id);

      return new Response(
        JSON.stringify({
          resposta: '❌ Reclamação cancelada.\n\nSe precisar registrar uma nova reclamação, é só me descrever o problema!',
          acao: 'cancelar',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construir prompt para a IA
    const camposFaltantes = CAMPOS_OBRIGATORIOS.filter(
      (campo) => !conversaData.dados_coletados[campo as keyof typeof conversaData.dados_coletados]
    );

    const systemPrompt = `Você é um assistente virtual da ${prefeitura.nome} que ajuda cidadãos a registrar reclamações sobre problemas na cidade.

CONTEXTO DA CONVERSA:
- Estado atual: ${conversaData.estado}
- Dados já coletados: ${JSON.stringify(conversaData.dados_coletados)}
- Campos que faltam: ${camposFaltantes.join(', ') || 'nenhum'}
- Mídias recebidas: ${midiasAtualizadas.fotos.length} foto(s), ${midiasAtualizadas.videos.length} vídeo(s)
- Localização: ${localizacaoAtualizada ? 'Sim' : 'Não'}

BAIRROS DISPONÍVEIS:
${bairros.map((b) => b.nome).join(', ') || 'Nenhum cadastrado'}

CATEGORIAS DE PROBLEMAS:
${categorias.map((c) => c.nome).join(', ') || 'Buraco, Iluminação, Lixo, Esgoto, Outros'}

REGRAS:
1. Seja educado, breve e objetivo
2. Tente EXTRAIR informações do texto do cidadão (nome, endereço, problema, etc)
3. Só pergunte o que ainda não foi informado
4. Se o cidadão fornecer informações parciais (ex: "rua das flores"), extraia mesmo sem número
5. Se identificar um bairro no texto, associe ao bairro da lista mais próximo
6. Se identificar uma categoria no texto, associe à categoria mais próxima
7. Sempre confirme as informações antes de finalizar
8. Quando tiver TODOS os campos obrigatórios, pergunte se deseja confirmar
9. Use emojis para tornar a conversa amigável

FORMATO DE RESPOSTA (JSON):
{
  "resposta": "mensagem para o cidadão",
  "dados_extraidos": {
    "nome": "se identificou nome",
    "email": "se identificou email",
    "rua": "se identificou rua",
    "numero": "se identificou número",
    "bairro": "nome do bairro identificado",
    "bairro_id": "id do bairro se encontrou correspondência",
    "categoria": "categoria identificada",
    "categoria_id": "id da categoria se encontrou correspondência",
    "descricao": "descrição do problema",
    "referencia": "ponto de referência se mencionado"
  },
  "novo_estado": "coletando_dados" | "confirmando" | "finalizado",
  "pronto_para_criar": true/false
}

IMPORTANTE: Responda APENAS com o JSON válido, sem texto adicional.`;

    const userMessage = mensagem.texto || 
      (midiasAtualizadas.fotos.length > 0 ? '[Cidadão enviou foto(s)]' : '') +
      (midiasAtualizadas.videos.length > 0 ? '[Cidadão enviou vídeo(s)]' : '') +
      (localizacaoAtualizada ? '[Cidadão enviou localização]' : '') ||
      '[Mensagem vazia]';

    // Chamar Lovable AI
    console.log('Chamando Lovable AI...');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Erro da AI:', errorText);
      throw new Error(`Erro da AI: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0]?.message?.content || '';
    console.log('Resposta da AI:', aiContent);

    // Tentar parsear JSON da resposta
    let aiResult: {
      resposta: string;
      dados_extraidos?: Record<string, string>;
      novo_estado?: string;
      pronto_para_criar?: boolean;
    };

    try {
      // Limpar possível markdown
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]);
      } else {
        aiResult = { resposta: aiContent };
      }
    } catch {
      console.error('Erro ao parsear JSON da AI, usando texto direto');
      aiResult = { resposta: aiContent };
    }

    // Atualizar dados coletados
    const dadosAtualizados = {
      ...conversaData.dados_coletados,
      ...aiResult.dados_extraidos,
    };

    // Se nome veio da mensagem e não temos, usar
    if (!dadosAtualizados.nome && mensagem.nome) {
      dadosAtualizados.nome = mensagem.nome;
    }

    // Verificar se está pronto para criar
    let reclamacaoCriada = null;
    const todosObrigatorios = CAMPOS_OBRIGATORIOS.every((campo) => dadosAtualizados[campo as keyof typeof dadosAtualizados]);
    
    if (aiResult.pronto_para_criar && todosObrigatorios) {
      console.log('Criando reclamação...');
      
      // Criar reclamação
      const { data: reclamacao, error: recError } = await supabase.rpc('criar_reclamacao_publica', {
        _prefeitura_id: prefeitura.id,
        _nome_cidadao: dadosAtualizados.nome || mensagem.nome,
        _email_cidadao: dadosAtualizados.email || `${mensagem.telefone}@whatsapp.ai`,
        _telefone_cidadao: mensagem.telefone,
        _rua: dadosAtualizados.rua,
        _numero: dadosAtualizados.numero || null,
        _bairro_id: dadosAtualizados.bairro_id || null,
        _categoria_id: dadosAtualizados.categoria_id || null,
        _referencia: dadosAtualizados.referencia || null,
        _descricao: `[Via WhatsApp IA] ${dadosAtualizados.descricao}`,
        _localizacao: localizacaoAtualizada,
        _fotos: midiasAtualizadas.fotos,
        _videos: midiasAtualizadas.videos,
      });

      if (recError) {
        console.error('Erro ao criar reclamação:', recError);
        aiResult.resposta = `❌ Desculpe, ocorreu um erro ao registrar sua reclamação. Por favor, tente novamente.`;
      } else {
        reclamacaoCriada = reclamacao[0];
        console.log('Reclamação criada:', reclamacaoCriada);

        // Buscar ID da reclamação
        const { data: recCriada } = await supabase
          .from('reclamacoes')
          .select('id')
          .eq('protocolo', reclamacaoCriada.protocolo)
          .single();

        // Resetar conversa
        await supabase
          .from('whatsapp_conversas')
          .update({
            estado: 'inicio',
            dados_coletados: {},
            midias_coletadas: { fotos: [], videos: [] },
            localizacao: null,
            ultima_mensagem_at: new Date().toISOString(),
            reclamacao_id: recCriada?.id || null,
          })
          .eq('id', conversaData.id);

        aiResult.resposta = `✅ *Reclamação Registrada com Sucesso!*\n\n` +
          `📋 *Protocolo:* ${reclamacaoCriada.protocolo}\n` +
          `📍 *Local:* ${dadosAtualizados.rua}${dadosAtualizados.bairro ? `, ${dadosAtualizados.bairro}` : ''}\n` +
          `📝 *Problema:* ${dadosAtualizados.descricao?.substring(0, 80)}...\n\n` +
          `Guarde este protocolo para acompanhar o status.\n` +
          `Use */consultar ${reclamacaoCriada.protocolo}* para verificar.\n\n` +
          `_${prefeitura.nome}_`;
      }
    } else {
      // Atualizar conversa com novos dados
      await supabase
        .from('whatsapp_conversas')
        .update({
          estado: aiResult.novo_estado || 'coletando_dados',
          dados_coletados: dadosAtualizados,
          midias_coletadas: midiasAtualizadas,
          localizacao: localizacaoAtualizada,
          ultima_mensagem_at: new Date().toISOString(),
          nome_cidadao: dadosAtualizados.nome || mensagem.nome || conversaData.nome_cidadao,
        })
        .eq('id', conversaData.id);
    }

    return new Response(
      JSON.stringify({
        resposta: aiResult.resposta,
        acao: reclamacaoCriada ? 'reclamacao_criada' : 'continuar',
        protocolo: reclamacaoCriada?.protocolo || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no agente:', error);
    return new Response(
      JSON.stringify({
        resposta: 'Desculpe, ocorreu um erro. Por favor, tente novamente.',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
