import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, RefreshCw, MessageCircle, Webhook, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WebhookLog {
  id: string;
  source: string;
  status: string;
  error_message: string | null;
  created_at: string;
  reclamacao_id: string | null;
}

interface OutletContextType {
  prefeitura: { id: string; nome: string } | null;
  prefeituraId: string;
}

const PainelIntegracoes = () => {
  const { prefeituraId } = useOutletContext<OutletContextType>();
  const [webhookSecret, setWebhookSecret] = useState<string>("");
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const webhookUrl = `https://sfsjtljhrelctpxpzody.supabase.co/functions/v1/receive-whatsapp-complaint`;

  useEffect(() => {
    if (prefeituraId) {
      fetchData();
    }
  }, [prefeituraId]);

  const fetchData = async () => {
    try {
      // Buscar webhook secret
      const { data: prefeitura } = await supabase
        .from("prefeituras")
        .select("webhook_secret")
        .eq("id", prefeituraId)
        .single();

      if (prefeitura?.webhook_secret) {
        setWebhookSecret(prefeitura.webhook_secret);
      }

      // Buscar logs de webhook
      const { data: logs } = await supabase
        .from("webhook_logs")
        .select("*")
        .eq("prefeitura_id", prefeituraId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (logs) {
        setWebhookLogs(logs);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const regenerateSecret = async () => {
    if (!prefeituraId) return;
    
    if (!confirm("Tem certeza que deseja regenerar o webhook secret? Todas as integrações existentes irão parar de funcionar até que você atualize o novo secret.")) {
      return;
    }

    setRegenerating(true);
    try {
      const { data, error } = await supabase
        .from("prefeituras")
        .update({ webhook_secret: crypto.randomUUID() })
        .eq("id", prefeituraId)
        .select("webhook_secret")
        .single();

      if (error) throw error;

      if (data?.webhook_secret) {
        setWebhookSecret(data.webhook_secret);
        toast.success("Webhook secret regenerado com sucesso!");
      }
    } catch (error) {
      console.error("Erro ao regenerar secret:", error);
      toast.error("Erro ao regenerar webhook secret");
    } finally {
      setRegenerating(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copiado para a área de transferência!");
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const examplePayload = `{
  "nome": "João Silva",
  "telefone": "+5547999999999",
  "email": "joao@email.com",
  "rua": "Rua das Flores",
  "numero": "123",
  "bairro": "Centro",
  "referencia": "Próximo ao mercado",
  "descricao": "Buraco na rua causando acidentes",
  "categoria": "Buracos",
  "latitude": -26.9186,
  "longitude": -49.0661,
  "fotos": ["https://exemplo.com/foto1.jpg"],
  "videos": []
}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
        <p className="text-muted-foreground">
          Configure integrações externas para receber reclamações via WhatsApp e outros canais
        </p>
      </div>

      <Tabs defaultValue="whatsapp" className="space-y-4">
        <TabsList>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircle className="w-4 h-4" />
            WhatsApp / n8n
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Webhook className="w-4 h-4" />
            Logs de Webhook
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="space-y-4">
          {/* Credenciais */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="w-5 h-5" />
                Credenciais do Webhook
              </CardTitle>
              <CardDescription>
                Use estas credenciais para configurar o n8n e receber reclamações via WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">URL do Webhook</label>
                <div className="flex gap-2">
                  <Input 
                    value={webhookUrl} 
                    readOnly 
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(webhookUrl, "url")}
                  >
                    {copied === "url" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Webhook Secret (Token de Autenticação)</label>
                <div className="flex gap-2">
                  <Input 
                    value={webhookSecret} 
                    readOnly 
                    className="font-mono text-sm"
                    type="password"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(webhookSecret, "secret")}
                  >
                    {copied === "secret" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={regenerateSecret}
                    disabled={regenerating}
                  >
                    <RefreshCw className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Envie o secret via header <code className="bg-muted px-1 rounded">x-webhook-secret</code> ou query param <code className="bg-muted px-1 rounded">?secret=</code>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Instruções */}
          <Card>
            <CardHeader>
              <CardTitle>Como Configurar no n8n</CardTitle>
              <CardDescription>
                Siga os passos abaixo para integrar o WhatsApp com o sistema de reclamações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium">Configure o WhatsApp Business no n8n</h4>
                    <p className="text-sm text-muted-foreground">
                      Use o nó "WhatsApp Business" ou "Twilio" para receber mensagens do WhatsApp. 
                      Configure um número de telefone para a sua prefeitura.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium">Processe a mensagem com AI (opcional)</h4>
                    <p className="text-sm text-muted-foreground">
                      Use um nó de AI (OpenAI, Claude, etc.) para extrair as informações da mensagem 
                      do cidadão e estruturar no formato JSON esperado.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium">Envie para o Webhook</h4>
                    <p className="text-sm text-muted-foreground">
                      Use o nó "HTTP Request" para enviar os dados para o webhook. 
                      Configure o método POST e adicione o header de autenticação.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    4
                  </div>
                  <div>
                    <h4 className="font-medium">Responda ao cidadão</h4>
                    <p className="text-sm text-muted-foreground">
                      Use a resposta do webhook (que inclui o protocolo) para enviar uma confirmação 
                      ao cidadão via WhatsApp.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <a href="https://docs.n8n.io/" target="_blank" rel="noopener noreferrer" className="gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Documentação do n8n
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Exemplo de Payload */}
          <Card>
            <CardHeader>
              <CardTitle>Estrutura do Payload (JSON)</CardTitle>
              <CardDescription>
                Envie os dados neste formato para o webhook criar uma reclamação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{examplePayload}</code>
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(examplePayload, "payload")}
                >
                  {copied === "payload" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <p><strong>Campos obrigatórios:</strong> nome, telefone, rua, descricao</p>
                <p><strong>Campos opcionais:</strong> email, numero, bairro, referencia, categoria, latitude, longitude, fotos, videos</p>
              </div>
            </CardContent>
          </Card>

          {/* Resposta do Webhook */}
          <Card>
            <CardHeader>
              <CardTitle>Resposta do Webhook</CardTitle>
              <CardDescription>
                Exemplo de resposta de sucesso que você receberá
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                <code>{`{
  "success": true,
  "protocolo": "ABC123",
  "mensagem": "Reclamação registrada com sucesso! Seu protocolo é: ABC123",
  "prefeitura": "Prefeitura de Exemplo",
  "data": {
    "protocolo": "ABC123",
    "nome": "João Silva",
    "rua": "Rua das Flores",
    "bairro": "Centro",
    "categoria": "Buracos"
  }
}`}</code>
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Logs de Webhook</span>
                <Button variant="outline" size="sm" onClick={fetchData}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar
                </Button>
              </CardTitle>
              <CardDescription>
                Histórico das últimas 50 requisições recebidas via webhook
              </CardDescription>
            </CardHeader>
            <CardContent>
              {webhookLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Webhook className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum log de webhook encontrado</p>
                  <p className="text-sm">Os logs aparecerão aqui quando você começar a receber requisições</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Protocolo</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhookLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {log.source}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={log.status === "success" ? "default" : "destructive"}
                          >
                            {log.status === "success" ? "Sucesso" : "Erro"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.reclamacao_id ? (
                            <span className="font-mono text-sm">Criada</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {log.error_message || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PainelIntegracoes;
