import { useState, useEffect, useRef } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { MessageCircle, Send, User, Clock, Phone, ArrowLeft, RefreshCw, Bot, Headset, Lock, Unlock, Zap, Plus, Trash2, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Conversa {
  id: string;
  telefone: string;
  nome_cidadao: string | null;
  estado: string;
  ultima_mensagem_at: string;
  created_at: string;
  dados_coletados: Record<string, unknown>;
  operador_atendendo_id: string | null;
  operador_atendendo_desde: string | null;
}

interface Mensagem {
  id: string;
  conversa_id: string;
  direcao: string;
  tipo: string;
  conteudo: string;
  midia_url: string | null;
  enviado_por: string | null;
  created_at: string;
}

interface Template {
  id: string;
  titulo: string;
  conteudo: string;
  atalho: string | null;
  ordem: number;
}

const PainelWhatsApp = () => {
  const { prefeituraId } = useOutletContext<{ prefeituraId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const conversaIdParam = searchParams.get("conversa");
  
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaSelecionada, setConversaSelecionada] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [novoTemplate, setNovoTemplate] = useState({ titulo: "", conteudo: "", atalho: "" });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Buscar user atual
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getUser();
  }, []);

  // Carregar templates
  const carregarTemplates = async () => {
    const { data } = await supabase
      .from("whatsapp_templates")
      .select("id, titulo, conteudo, atalho, ordem")
      .eq("prefeitura_id", prefeituraId)
      .eq("ativo", true)
      .order("ordem");
    
    setTemplates((data || []) as Template[]);
  };

  // Carregar conversas
  const carregarConversas = async () => {
    const { data, error } = await supabase
      .from("whatsapp_conversas")
      .select("*")
      .eq("prefeitura_id", prefeituraId)
      .order("ultima_mensagem_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar conversas:", error);
      return;
    }

    setConversas((data || []) as unknown as Conversa[]);
    setLoading(false);

    // Se tiver conversa na URL, selecionar
    if (conversaIdParam && data) {
      const conv = data.find(c => c.id === conversaIdParam);
      if (conv) {
        setConversaSelecionada(conv as unknown as Conversa);
      }
    }
  };

  // Carregar mensagens da conversa selecionada
  const carregarMensagens = async (conversaId: string) => {
    const { data, error } = await supabase
      .from("whatsapp_mensagens")
      .select("*")
      .eq("conversa_id", conversaId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erro ao carregar mensagens:", error);
      return;
    }

    setMensagens(data || []);
    
    // Marcar mensagens como lidas
    await supabase
      .from("whatsapp_mensagens")
      .update({ lida: true })
      .eq("conversa_id", conversaId)
      .eq("lida", false);
  };

  // Scroll para última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (prefeituraId) {
      carregarConversas();
      carregarTemplates();
    }
  }, [prefeituraId]);

  useEffect(() => {
    if (conversaSelecionada) {
      carregarMensagens(conversaSelecionada.id);
      setSearchParams({ conversa: conversaSelecionada.id });
    }
  }, [conversaSelecionada]);

  useEffect(() => {
    scrollToBottom();
  }, [mensagens]);

  // Realtime para novas mensagens
  useEffect(() => {
    if (!prefeituraId) return;

    const channel = supabase
      .channel("whatsapp-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_mensagens",
          filter: `prefeitura_id=eq.${prefeituraId}`,
        },
        (payload) => {
          const novaMensagem = payload.new as Mensagem;
          
          // Se é da conversa selecionada, adicionar
          if (conversaSelecionada && novaMensagem.conversa_id === conversaSelecionada.id) {
            setMensagens(prev => [...prev, novaMensagem]);
          }
          
          // Atualizar lista de conversas
          carregarConversas();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_conversas",
          filter: `prefeitura_id=eq.${prefeituraId}`,
        },
        (payload) => {
          carregarConversas();
          // Atualizar conversa selecionada se foi alterada
          if (conversaSelecionada && payload.new && (payload.new as Conversa).id === conversaSelecionada.id) {
            setConversaSelecionada(payload.new as Conversa);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [prefeituraId, conversaSelecionada]);

  // Assumir atendimento (bloquear conversa)
  const assumirAtendimento = async () => {
    if (!conversaSelecionada || !currentUserId) return;

    const { error } = await supabase
      .from("whatsapp_conversas")
      .update({
        operador_atendendo_id: currentUserId,
        operador_atendendo_desde: new Date().toISOString(),
      })
      .eq("id", conversaSelecionada.id);

    if (error) {
      toast({ title: "Erro ao assumir atendimento", variant: "destructive" });
      return;
    }

    toast({ title: "Atendimento assumido", description: "Você está atendendo esta conversa." });
    carregarConversas();
  };

  // Liberar atendimento
  const liberarAtendimento = async () => {
    if (!conversaSelecionada) return;

    const { error } = await supabase
      .from("whatsapp_conversas")
      .update({
        operador_atendendo_id: null,
        operador_atendendo_desde: null,
      })
      .eq("id", conversaSelecionada.id);

    if (error) {
      toast({ title: "Erro ao liberar atendimento", variant: "destructive" });
      return;
    }

    toast({ title: "Atendimento liberado" });
    carregarConversas();
  };

  // Verificar se pode enviar mensagem
  const podeEnviar = () => {
    if (!conversaSelecionada) return false;
    if (!conversaSelecionada.operador_atendendo_id) return true; // Ninguém atendendo
    return conversaSelecionada.operador_atendendo_id === currentUserId; // Eu estou atendendo
  };

  // Enviar mensagem
  const enviarMensagem = async (texto?: string) => {
    const mensagemFinal = texto || novaMensagem.trim();
    if (!mensagemFinal || !conversaSelecionada || enviando) return;

    if (!podeEnviar()) {
      toast({
        title: "Conversa em atendimento",
        description: "Outro operador está atendendo esta conversa.",
        variant: "destructive",
      });
      return;
    }

    setEnviando(true);
    
    try {
      // Chamar edge function para enviar via Evolution API
      const { data, error } = await supabase.functions.invoke("send-whatsapp-message", {
        body: {
          prefeitura_id: prefeituraId,
          conversa_id: conversaSelecionada.id,
          telefone: conversaSelecionada.telefone,
          mensagem: mensagemFinal,
        },
      });

      if (error) throw error;

      setNovaMensagem("");
      setShowTemplates(false);
      toast({
        title: "Mensagem enviada",
        description: "A mensagem foi enviada com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível enviar a mensagem. Verifique a conexão do WhatsApp.",
        variant: "destructive",
      });
    } finally {
      setEnviando(false);
    }
  };

  // Criar template
  const criarTemplate = async () => {
    if (!novoTemplate.titulo.trim() || !novoTemplate.conteudo.trim()) {
      toast({ title: "Preencha título e conteúdo", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("whatsapp_templates").insert({
      prefeitura_id: prefeituraId,
      titulo: novoTemplate.titulo.trim(),
      conteudo: novoTemplate.conteudo.trim(),
      atalho: novoTemplate.atalho.trim() || null,
      ordem: templates.length,
    });

    if (error) {
      toast({ title: "Erro ao criar template", variant: "destructive" });
      return;
    }

    toast({ title: "Template criado!" });
    setNovoTemplate({ titulo: "", conteudo: "", atalho: "" });
    setTemplateDialogOpen(false);
    carregarTemplates();
  };

  // Excluir template
  const excluirTemplate = async (id: string) => {
    const { error } = await supabase
      .from("whatsapp_templates")
      .update({ ativo: false })
      .eq("id", id);

    if (!error) {
      carregarTemplates();
      toast({ title: "Template removido" });
    }
  };

  // Usar template
  const usarTemplate = (template: Template) => {
    setNovaMensagem(template.conteudo);
    setShowTemplates(false);
  };

  const formatarTelefone = (telefone: string) => {
    const limpo = telefone.replace("@s.whatsapp.net", "").replace(/\D/g, "");
    if (limpo.length === 13) {
      return `+${limpo.slice(0, 2)} (${limpo.slice(2, 4)}) ${limpo.slice(4, 9)}-${limpo.slice(9)}`;
    }
    return telefone;
  };

  const getEstadoBadge = (estado: string) => {
    const cores: Record<string, string> = {
      inicio: "bg-muted text-muted-foreground",
      coletando_dados: "bg-blue-500/20 text-blue-700",
      confirmando: "bg-yellow-500/20 text-yellow-700",
      finalizado: "bg-green-500/20 text-green-700",
    };
    
    const labels: Record<string, string> = {
      inicio: "Início",
      coletando_dados: "Coletando dados",
      confirmando: "Confirmando",
      finalizado: "Finalizado",
    };

    return (
      <Badge variant="outline" className={cores[estado] || "bg-muted"}>
        {labels[estado] || estado}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const conversaEmAtendimentoPorOutro = conversaSelecionada?.operador_atendendo_id && 
    conversaSelecionada.operador_atendendo_id !== currentUserId;

  return (
    <div className="h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" />
            Conversas WhatsApp
          </h1>
          <p className="text-muted-foreground">Atenda os cidadãos em tempo real</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="w-4 h-4 mr-2" />
                Templates
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Gerenciar Templates</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Lista de templates existentes */}
                {templates.length > 0 && (
                  <div className="space-y-2">
                    <Label>Templates existentes</Label>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {templates.map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{t.titulo}</p>
                            <p className="text-xs text-muted-foreground truncate">{t.conteudo}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => excluirTemplate(t.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Criar novo template */}
                <div className="space-y-3 pt-4 border-t">
                  <Label>Novo template</Label>
                  <Input
                    placeholder="Título (ex: Boas-vindas)"
                    value={novoTemplate.titulo}
                    onChange={(e) => setNovoTemplate(prev => ({ ...prev, titulo: e.target.value }))}
                  />
                  <Textarea
                    placeholder="Conteúdo da mensagem..."
                    value={novoTemplate.conteudo}
                    onChange={(e) => setNovoTemplate(prev => ({ ...prev, conteudo: e.target.value }))}
                    rows={3}
                  />
                  <Input
                    placeholder="Atalho (ex: /bv) - opcional"
                    value={novoTemplate.atalho}
                    onChange={(e) => setNovoTemplate(prev => ({ ...prev, atalho: e.target.value }))}
                  />
                  <Button onClick={criarTemplate} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Template
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" size="sm" onClick={carregarConversas}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100%-5rem)]">
        {/* Lista de Conversas */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Conversas Ativas</h2>
            <p className="text-xs text-muted-foreground">{conversas.length} conversa(s)</p>
          </div>
          
          <ScrollArea className="h-[calc(100%-4rem)]">
            {conversas.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma conversa ainda</p>
                <p className="text-sm">As conversas aparecerão quando os cidadãos entrarem em contato</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {conversas.map((conversa) => (
                  <button
                    key={conversa.id}
                    onClick={() => setConversaSelecionada(conversa)}
                    className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                      conversaSelecionada?.id === conversa.id ? "bg-primary/10" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 relative">
                        <User className="w-5 h-5 text-primary" />
                        {conversa.operador_atendendo_id && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                            <Lock className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground truncate">
                            {conversa.nome_cidadao || "Cidadão"}
                          </span>
                          {getEstadoBadge(conversa.estado)}
                        </div>
                        <p className="text-sm text-muted-foreground truncate flex items-center gap-1 mt-1">
                          <Phone className="w-3 h-3" />
                          {formatarTelefone(conversa.telefone)}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(conversa.ultima_mensagem_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Área de Chat */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border overflow-hidden flex flex-col">
          {conversaSelecionada ? (
            <>
              {/* Header do Chat */}
              <div className="p-4 border-b border-border bg-muted/30">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={() => setConversaSelecionada(null)}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">
                      {conversaSelecionada.nome_cidadao || "Cidadão"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {formatarTelefone(conversaSelecionada.telefone)}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {getEstadoBadge(conversaSelecionada.estado)}
                    
                    {/* Botão de assumir/liberar atendimento */}
                    {conversaSelecionada.operador_atendendo_id === currentUserId ? (
                      <Button variant="outline" size="sm" onClick={liberarAtendimento}>
                        <Unlock className="w-4 h-4 mr-1" />
                        Liberar
                      </Button>
                    ) : !conversaSelecionada.operador_atendendo_id ? (
                      <Button variant="default" size="sm" onClick={assumirAtendimento}>
                        <Lock className="w-4 h-4 mr-1" />
                        Assumir
                      </Button>
                    ) : (
                      <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700">
                        <Lock className="w-3 h-3 mr-1" />
                        Em atendimento
                      </Badge>
                    )}
                  </div>
                </div>
                
                {/* Dados coletados */}
                {Object.keys(conversaSelecionada.dados_coletados || {}).length > 0 && (
                  <div className="mt-3 p-3 bg-background rounded-lg text-sm">
                    <p className="font-medium text-foreground mb-2">Dados coletados:</p>
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      {Object.entries(conversaSelecionada.dados_coletados).map(([key, value]) => (
                        <p key={key}>
                          <span className="font-medium">{key}:</span> {String(value)}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Mensagens */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {mensagens.length === 0 ? (
                    <div className="text-center text-muted-foreground py-12">
                      <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma mensagem ainda</p>
                    </div>
                  ) : (
                    mensagens.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direcao === "saida" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                            msg.direcao === "saida"
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted text-foreground rounded-bl-sm"
                          }`}
                        >
                          {msg.enviado_por && (
                            <p className={`text-xs mb-1 flex items-center gap-1 ${
                              msg.direcao === "saida" ? "text-primary-foreground/70" : "text-muted-foreground"
                            }`}>
                              {msg.enviado_por === "agente_ia" && <Bot className="w-3 h-3" />}
                              {msg.enviado_por === "operador" && <Headset className="w-3 h-3" />}
                              {msg.enviado_por === "agente_ia" ? "Agente IA" : 
                               msg.enviado_por === "operador" ? "Operador" : "Cidadão"}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>
                          <p className={`text-xs mt-1 ${
                            msg.direcao === "saida" ? "text-primary-foreground/70" : "text-muted-foreground"
                          }`}>
                            {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Aviso de conversa em atendimento por outro */}
              {conversaEmAtendimentoPorOutro && (
                <div className="px-4 py-2 bg-yellow-500/10 border-t border-yellow-500/20">
                  <p className="text-sm text-yellow-700 flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Esta conversa está sendo atendida por outro operador.
                  </p>
                </div>
              )}

              {/* Templates rápidos */}
              {showTemplates && templates.length > 0 && (
                <div className="px-4 py-2 border-t border-border bg-muted/30">
                  <div className="flex flex-wrap gap-2">
                    {templates.map((template) => (
                      <Button
                        key={template.id}
                        variant="secondary"
                        size="sm"
                        onClick={() => usarTemplate(template)}
                        className="text-xs"
                      >
                        <Zap className="w-3 h-3 mr-1" />
                        {template.titulo}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input de Mensagem */}
              <div className="p-4 border-t border-border">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    enviarMensagem();
                  }}
                  className="flex gap-2"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowTemplates(!showTemplates)}
                    disabled={templates.length === 0}
                    title="Templates rápidos"
                  >
                    <Zap className={`w-5 h-5 ${showTemplates ? "text-primary" : "text-muted-foreground"}`} />
                  </Button>
                  <Input
                    placeholder={conversaEmAtendimentoPorOutro ? "Conversa em atendimento..." : "Digite sua mensagem..."}
                    value={novaMensagem}
                    onChange={(e) => setNovaMensagem(e.target.value)}
                    className="flex-1"
                    disabled={enviando || conversaEmAtendimentoPorOutro}
                  />
                  <Button type="submit" disabled={!novaMensagem.trim() || enviando || conversaEmAtendimentoPorOutro}>
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Selecione uma conversa</p>
                <p className="text-sm">Escolha uma conversa na lista ao lado para visualizar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PainelWhatsApp;
