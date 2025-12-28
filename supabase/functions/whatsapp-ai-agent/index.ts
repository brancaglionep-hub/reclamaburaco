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
    telefone?: string;
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

interface CidadaoData {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  bairro_id: string | null;
  total_reclamacoes?: number;
  bairro?: { nome: string }[] | null;
}

interface ReclamacaoHistorico {
  id: string;
  protocolo: string;
  status: string;
  rua: string;
  created_at: string;
  categoria?: { nome: string }[] | null;
}

interface PrefeituraData {
  id: string;
  nome: string;
  slug: string;
  cidade: string;
  estado: string;
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

// Fluxo de etapas igual ao do site
const ETAPAS_FLUXO = [
  'dados_pessoais',    // Etapa 1: Nome, Email, Telefone
  'localizacao',       // Etapa 2: Bairro, Rua, Número, Referência
  'tipo_problema',     // Etapa 3: Categoria do problema
  'descricao',         // Etapa 4: Descrição detalhada
  'midia',             // Etapa 5: Fotos/Vídeos
  'confirmacao',       // Etapa 6: Confirmar e enviar
];

// Tipos de problema (igual ao ProblemTypeSelector)
const TIPOS_PROBLEMA = [
  { id: 'buraco', label: 'Buraco na rua', emoji: '🕳️' },
  { id: 'danificada', label: 'Rua danificada', emoji: '🚧' },
  { id: 'alagada', label: 'Rua alagada', emoji: '🌧️' },
  { id: 'desnivel', label: 'Desnível na pista', emoji: '⚠️' },
  { id: 'dificil', label: 'Rua difícil de trafegar', emoji: '🚗' },
  { id: 'outro', label: 'Outro problema', emoji: '❓' },
];

Deno.serve(async (req) => {
  console.log('=== WhatsApp AI Agent v2 - Fluxo Guiado ===');

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
    console.log('Prefeitura:', prefeitura.nome, '-', prefeitura.cidade, '/', prefeitura.estado);

    // Limpar telefone (remover @s.whatsapp.net e caracteres especiais)
    const telefoneLimpo = mensagem.telefone.replace('@s.whatsapp.net', '').replace(/\D/g, '');
    
    // Buscar cidadão existente pelo telefone
    const { data: cidadaoExistente } = await supabase
      .from('cidadaos')
      .select(`
        id,
        nome,
        email,
        telefone,
        bairro_id,
        bairro:bairros(nome)
      `)
      .eq('prefeitura_id', prefeitura.id)
      .eq('telefone', telefoneLimpo)
      .maybeSingle();

    // Contar reclamações anteriores
    let totalReclamacoes = 0;
    let reclamacoesAnteriores: ReclamacaoHistorico[] = [];
    
    if (cidadaoExistente) {
      const { count } = await supabase
        .from('reclamacoes')
        .select('*', { count: 'exact', head: true })
        .eq('prefeitura_id', prefeitura.id)
        .eq('telefone_cidadao', telefoneLimpo);
      
      totalReclamacoes = count || 0;

      // Buscar últimas 3 reclamações
      const { data: ultimas } = await supabase
        .from('reclamacoes')
        .select('id, protocolo, status, rua, created_at, categoria:categorias(nome)')
        .eq('prefeitura_id', prefeitura.id)
        .eq('telefone_cidadao', telefoneLimpo)
        .order('created_at', { ascending: false })
        .limit(3);

      reclamacoesAnteriores = ultimas || [];
    }

    const usuarioRecorrente = totalReclamacoes > 0;
    console.log('Usuário recorrente:', usuarioRecorrente, '- Total reclamações:', totalReclamacoes);

    // Buscar ou criar conversa
    let { data: conversa, error: conversaError } = await supabase
      .from('whatsapp_conversas')
      .select('*')
      .eq('prefeitura_id', prefeitura.id)
      .eq('telefone', mensagem.telefone)
      .single();

    if (conversaError && conversaError.code === 'PGRST116') {
      // Criar nova conversa - já preencher dados se usuário existente
      const dadosIniciais: Record<string, string> = {};
      
      if (cidadaoExistente) {
        if (cidadaoExistente.nome) dadosIniciais.nome = cidadaoExistente.nome;
        if (cidadaoExistente.email) dadosIniciais.email = cidadaoExistente.email;
        if (cidadaoExistente.telefone) dadosIniciais.telefone = cidadaoExistente.telefone;
        if (cidadaoExistente.bairro_id) dadosIniciais.bairro_id = cidadaoExistente.bairro_id;
        if (cidadaoExistente.bairro?.[0]?.nome) dadosIniciais.bairro = cidadaoExistente.bairro[0].nome;
      }

      const { data: novaConversa, error: createError } = await supabase
        .from('whatsapp_conversas')
        .insert({
          prefeitura_id: prefeitura.id,
          telefone: mensagem.telefone,
          nome_cidadao: cidadaoExistente?.nome || mensagem.nome,
          estado: 'inicio',
          dados_coletados: dadosIniciais,
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
    if (textoLower.startsWith('/consultar ') || textoLower.startsWith('/status ') || textoLower.startsWith('consultar ')) {
      const protocolo = mensagem.texto.substring(mensagem.texto.indexOf(' ') + 1).trim().toUpperCase();
      
      const { data: consultaResult } = await supabase
        .rpc('consultar_protocolo', {
          _protocolo: protocolo,
          _prefeitura_id: prefeitura.id,
        });

      let respostaConsulta = '';
      if (!consultaResult || consultaResult.length === 0) {
        respostaConsulta = `❌ Protocolo *${protocolo}* não encontrado.\n\nVerifique se digitou corretamente ou entre em contato com a ${prefeitura.nome}.`;
      } else {
        const rec = consultaResult[0];
        const statusMap: Record<string, string> = {
          recebida: '📥 Recebida - Aguardando análise',
          em_andamento: '🔄 Em Andamento - Equipe trabalhando',
          resolvida: '✅ Resolvida',
          arquivada: '📁 Arquivada',
        };
        respostaConsulta = `📋 *Consulta de Protocolo*\n\n` +
          `*Protocolo:* ${rec.protocolo}\n` +
          `*Status:* ${statusMap[rec.status] || rec.status}\n` +
          `*Local:* ${rec.rua}${rec.bairro_nome ? `, ${rec.bairro_nome}` : ''}\n` +
          `*Data:* ${new Date(rec.created_at).toLocaleDateString('pt-BR')}\n`;
        if (rec.resposta_prefeitura) {
          respostaConsulta += `\n💬 *Resposta da Prefeitura:*\n${rec.resposta_prefeitura}`;
        }
        respostaConsulta += `\n\n_${prefeitura.nome}_`;
      }

      return new Response(
        JSON.stringify({ resposta: respostaConsulta, acao: 'consulta' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar comando de minhas reclamações
    if (textoLower === '/minhas' || textoLower === 'minhas reclamações' || textoLower === 'minhas reclamacoes') {
      if (reclamacoesAnteriores.length === 0) {
        return new Response(
          JSON.stringify({
            resposta: `📋 Você ainda não tem reclamações registradas com este número.\n\nPara registrar uma nova, me conte qual o problema!`,
            acao: 'listar',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const statusEmoji: Record<string, string> = {
        recebida: '📥',
        em_andamento: '🔄',
        resolvida: '✅',
        arquivada: '📁',
      };

      let lista = `📋 *Suas Reclamações* (${totalReclamacoes} total)\n\n`;
      reclamacoesAnteriores.forEach((rec, i) => {
        lista += `${i + 1}. ${statusEmoji[rec.status] || '📌'} *${rec.protocolo}*\n`;
        lista += `   ${rec.categoria?.[0]?.nome || 'Problema'} - ${rec.rua}\n`;
        lista += `   ${new Date(rec.created_at).toLocaleDateString('pt-BR')}\n\n`;
      });
      lista += `Para consultar uma, digite:\n*consultar PROTOCOLO*`;

      return new Response(
        JSON.stringify({ resposta: lista, acao: 'listar' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar comando de cancelamento
    if (textoLower === '/cancelar' || textoLower === 'cancelar') {
      await supabase
        .from('whatsapp_conversas')
        .update({
          estado: 'inicio',
          dados_coletados: cidadaoExistente ? {
            nome: cidadaoExistente.nome,
            email: cidadaoExistente.email,
            telefone: cidadaoExistente.telefone,
            bairro_id: cidadaoExistente.bairro_id,
            bairro: cidadaoExistente.bairro?.[0]?.nome,
          } : {},
          midias_coletadas: { fotos: [], videos: [] },
          localizacao: null,
          ultima_mensagem_at: new Date().toISOString(),
        })
        .eq('id', conversaData.id);

      return new Response(
        JSON.stringify({
          resposta: `❌ Reclamação cancelada.\n\nSe precisar registrar uma nova reclamação, é só me descrever o problema! 😊`,
          acao: 'cancelar',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construir prompt para a IA seguindo o fluxo do site
    const dadosAtuais = conversaData.dados_coletados;
    
    // Determinar etapa atual baseado nos dados coletados
    let etapaAtual = 'dados_pessoais';
    if (dadosAtuais.nome && dadosAtuais.email) {
      etapaAtual = 'localizacao';
    }
    if (dadosAtuais.nome && dadosAtuais.email && dadosAtuais.rua && dadosAtuais.bairro) {
      etapaAtual = 'tipo_problema';
    }
    if (dadosAtuais.nome && dadosAtuais.email && dadosAtuais.rua && dadosAtuais.bairro && dadosAtuais.categoria) {
      etapaAtual = 'descricao';
    }
    if (dadosAtuais.nome && dadosAtuais.email && dadosAtuais.rua && dadosAtuais.bairro && dadosAtuais.categoria && dadosAtuais.descricao) {
      etapaAtual = 'midia';
    }
    if (conversaData.estado === 'confirmando') {
      etapaAtual = 'confirmacao';
    }

    const tiposProblemaTexto = TIPOS_PROBLEMA.map(t => `${t.emoji} ${t.label}`).join('\n');

    const systemPrompt = `Você é a assistente virtual da ${prefeitura.nome} (${prefeitura.cidade}/${prefeitura.estado}).
Você ajuda os cidadãos a registrar reclamações sobre problemas na cidade.

${usuarioRecorrente ? `
🎉 USUÁRIO RECORRENTE DETECTADO!
- Nome: ${cidadaoExistente?.nome}
- Já fez ${totalReclamacoes} reclamação(ões) anteriormente
- Trate-o de forma mais pessoal, reconhecendo que ele já é conhecido
- Pode pular dados já conhecidos como nome/email/bairro se ainda válidos
- Ofereça consultar suas reclamações anteriores quando apropriado
` : `
👋 NOVO USUÁRIO
- Seja acolhedor na primeira interação
- Explique brevemente como funciona o processo
`}

📝 FLUXO DE ETAPAS (igual ao site):
1. DADOS PESSOAIS: Nome completo, E-mail, Telefone (opcional)
2. LOCALIZAÇÃO: Bairro, Rua, Número (opcional), Ponto de referência (opcional)
3. TIPO DO PROBLEMA: Escolher categoria
4. DESCRIÇÃO: Detalhes do problema
5. MÍDIA: Fotos/vídeos (opcional mas incentivado)
6. CONFIRMAÇÃO: Revisar e confirmar envio

🔄 ESTADO ATUAL DA CONVERSA:
- Etapa: ${etapaAtual}
- Estado: ${conversaData.estado}
- Dados coletados: ${JSON.stringify(dadosAtuais)}
- Fotos: ${midiasAtualizadas.fotos.length} | Vídeos: ${midiasAtualizadas.videos.length}
- Localização GPS: ${localizacaoAtualizada ? 'Sim' : 'Não'}

📍 BAIRROS DA CIDADE:
${bairros.map(b => `- ${b.nome} (id: ${b.id})`).join('\n') || 'Nenhum cadastrado - aceitar qualquer nome'}

🏷️ TIPOS DE PROBLEMA:
${TIPOS_PROBLEMA.map(t => `- ${t.emoji} ${t.label} (id: ${t.id})`).join('\n')}

📂 CATEGORIAS DO SISTEMA:
${categorias.map(c => `- ${c.nome} (id: ${c.id})`).join('\n')}

🎯 REGRAS IMPORTANTES:
1. Seja educado, breve e objetivo - mensagens curtas funcionam melhor no WhatsApp
2. Use emojis para tornar a conversa amigável 😊
3. Siga o fluxo de etapas - não pule etapas sem ter os dados
4. Para usuários recorrentes, seja mais direto e pessoal
5. Extraia informações do texto naturalmente - não precisa perguntar tudo separado
6. Se o usuário mandar tudo de uma vez, extraia todos os dados
7. Quando pedir categoria, mostre as opções de forma clara
8. Valide emails (precisa ter @ e .)
9. Aceite variações de bairros (associe ao mais próximo da lista)
10. Incentive envio de fotos mas não exija
11. Antes de criar, SEMPRE mostre resumo e peça confirmação
12. Use markdown do WhatsApp: *negrito* _itálico_

📲 COMANDOS DISPONÍVEIS (informe quando apropriado):
- *consultar PROTOCOLO* - Ver status de uma reclamação
- *minhas reclamações* - Listar reclamações anteriores
- *cancelar* - Cancelar reclamação atual

📋 FORMATO DE RESPOSTA (JSON):
{
  "resposta": "mensagem para o cidadão",
  "dados_extraidos": {
    "nome": "se identificou",
    "email": "se identificou",
    "telefone": "se identificou",
    "rua": "se identificou",
    "numero": "se identificou",
    "bairro": "nome do bairro",
    "bairro_id": "id do bairro se corresponde à lista",
    "categoria": "tipo do problema (buraco/danificada/alagada/desnivel/dificil/outro)",
    "categoria_id": "id da categoria do sistema",
    "descricao": "descrição do problema",
    "referencia": "ponto de referência"
  },
  "nova_etapa": "dados_pessoais|localizacao|tipo_problema|descricao|midia|confirmacao",
  "pronto_para_confirmar": true/false,
  "criar_reclamacao": true/false
}

⚠️ IMPORTANTE: Responda APENAS com o JSON válido, sem texto adicional.`;

    const userMessage = mensagem.texto || 
      (midiasAtualizadas.fotos.length > 0 ? '[Cidadão enviou foto(s)]' : '') +
      (midiasAtualizadas.videos.length > 0 ? '[Cidadão enviou vídeo(s)]' : '') +
      (localizacaoAtualizada ? '[Cidadão enviou localização GPS]' : '') ||
      '[Mensagem vazia]';

    // Chamar Lovable AI
    console.log('Chamando Lovable AI...');
    console.log('Etapa atual:', etapaAtual);
    
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
        max_tokens: 1500,
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

    // Parsear JSON da resposta
    let aiResult: {
      resposta: string;
      dados_extraidos?: Record<string, string>;
      nova_etapa?: string;
      pronto_para_confirmar?: boolean;
      criar_reclamacao?: boolean;
    };

    try {
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
    
    // Telefone do WhatsApp
    if (!dadosAtualizados.telefone) {
      dadosAtualizados.telefone = telefoneLimpo;
    }

    // Verificar se deve criar reclamação
    let reclamacaoCriada = null;
    const camposObrigatorios = ['nome', 'email', 'rua', 'bairro', 'descricao'];
    const todosObrigatorios = camposObrigatorios.every(campo => dadosAtualizados[campo as keyof typeof dadosAtualizados]);
    
    if (aiResult.criar_reclamacao && todosObrigatorios) {
      console.log('Criando reclamação...');
      
      // Criar reclamação usando a função do banco
      const { data: reclamacao, error: recError } = await supabase.rpc('criar_reclamacao_publica', {
        _prefeitura_id: prefeitura.id,
        _nome_cidadao: dadosAtualizados.nome || mensagem.nome,
        _email_cidadao: dadosAtualizados.email || `${telefoneLimpo}@whatsapp.temp`,
        _telefone_cidadao: telefoneLimpo,
        _rua: dadosAtualizados.rua,
        _numero: dadosAtualizados.numero || null,
        _bairro_id: dadosAtualizados.bairro_id || null,
        _categoria_id: dadosAtualizados.categoria_id || null,
        _referencia: dadosAtualizados.referencia || null,
        _descricao: dadosAtualizados.descricao,
        _localizacao: localizacaoAtualizada,
        _fotos: midiasAtualizadas.fotos,
        _videos: midiasAtualizadas.videos,
      });

      if (recError) {
        console.error('Erro ao criar reclamação:', recError);
        aiResult.resposta = `❌ Desculpe, ocorreu um erro ao registrar sua reclamação.\n\nPor favor, tente novamente em alguns instantes.`;
      } else {
        reclamacaoCriada = reclamacao[0];
        console.log('Reclamação criada:', reclamacaoCriada);

        // Buscar ID da reclamação
        const { data: recCriada } = await supabase
          .from('reclamacoes')
          .select('id')
          .eq('protocolo', reclamacaoCriada.protocolo)
          .single();

        // Resetar conversa mas manter dados do cidadão para próxima
        await supabase
          .from('whatsapp_conversas')
          .update({
            estado: 'inicio',
            dados_coletados: {
              nome: dadosAtualizados.nome,
              email: dadosAtualizados.email,
              telefone: telefoneLimpo,
              bairro: dadosAtualizados.bairro,
              bairro_id: dadosAtualizados.bairro_id,
            },
            midias_coletadas: { fotos: [], videos: [] },
            localizacao: null,
            ultima_mensagem_at: new Date().toISOString(),
            reclamacao_id: recCriada?.id || null,
          })
          .eq('id', conversaData.id);

        aiResult.resposta = `✅ *Reclamação Registrada!*\n\n` +
          `📋 *Protocolo:* ${reclamacaoCriada.protocolo}\n\n` +
          `📍 *Local:* ${dadosAtualizados.rua}${dadosAtualizados.numero ? ', ' + dadosAtualizados.numero : ''}${dadosAtualizados.bairro ? ' - ' + dadosAtualizados.bairro : ''}\n` +
          `🏷️ *Problema:* ${dadosAtualizados.categoria || dadosAtualizados.descricao?.substring(0, 50)}\n` +
          `📷 *Mídia:* ${midiasAtualizadas.fotos.length} foto(s), ${midiasAtualizadas.videos.length} vídeo(s)\n\n` +
          `Guarde este protocolo! Para acompanhar:\n` +
          `👉 *consultar ${reclamacaoCriada.protocolo}*\n\n` +
          `Obrigado por ajudar a melhorar nossa cidade! 🌆\n\n` +
          `_${prefeitura.nome}_`;
      }
    } else {
      // Atualizar conversa com novos dados
      let novoEstado = 'coletando_dados';
      if (aiResult.pronto_para_confirmar) {
        novoEstado = 'confirmando';
      }

      await supabase
        .from('whatsapp_conversas')
        .update({
          estado: novoEstado,
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
        resposta: 'Desculpe, ocorreu um erro. Por favor, tente novamente em alguns instantes.',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
