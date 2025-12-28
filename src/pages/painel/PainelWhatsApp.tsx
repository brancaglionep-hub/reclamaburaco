import { useState, useEffect, useRef } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { MessageCircle, Send, User, Clock, Phone, ArrowLeft, RefreshCw, Bot, Headset } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        () => {
          carregarConversas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [prefeituraId, conversaSelecionada]);

  // Enviar mensagem
  const enviarMensagem = async () => {
    if (!novaMensagem.trim() || !conversaSelecionada || enviando) return;

    setEnviando(true);
    
    try {
      // Chamar edge function para enviar via Evolution API
      const { data, error } = await supabase.functions.invoke("send-whatsapp-message", {
        body: {
          prefeitura_id: prefeituraId,
          conversa_id: conversaSelecionada.id,
          telefone: conversaSelecionada.telefone,
          mensagem: novaMensagem.trim(),
        },
      });

      if (error) throw error;

      setNovaMensagem("");
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
        <Button variant="outline" size="sm" onClick={carregarConversas}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
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
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-primary" />
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
                  {getEstadoBadge(conversaSelecionada.estado)}
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

              {/* Input de Mensagem */}
              <div className="p-4 border-t border-border">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    enviarMensagem();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={novaMensagem}
                    onChange={(e) => setNovaMensagem(e.target.value)}
                    className="flex-1"
                    disabled={enviando}
                  />
                  <Button type="submit" disabled={!novaMensagem.trim() || enviando}>
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
