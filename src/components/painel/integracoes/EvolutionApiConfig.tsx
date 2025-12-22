import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  QrCode, 
  Wifi, 
  WifiOff, 
  Save, 
  RefreshCw, 
  Loader2,
  CheckCircle,
  XCircle,
  Smartphone,
  Settings,
  Link
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EvolutionConfig {
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  evolution_instance_name: string | null;
  evolution_connected: boolean;
  evolution_phone: string | null;
}

interface EvolutionApiConfigProps {
  prefeituraId: string;
  config: EvolutionConfig;
  onConfigUpdate: () => void;
}

interface QrCodeData {
  base64?: string;
  code?: string;
}

interface ConnectionState {
  state: string;
  statusReason?: number;
}

const WEBHOOK_URL = "https://sfsjtljhrelctpxpzody.supabase.co/functions/v1/receive-evolution-webhook";

const EvolutionApiConfig = ({ prefeituraId, config, onConfigUpdate }: EvolutionApiConfigProps) => {
  const [apiUrl, setApiUrl] = useState(config.evolution_api_url || "");
  const [apiKey, setApiKey] = useState(config.evolution_api_key || "");
  const [instanceName, setInstanceName] = useState(config.evolution_instance_name || "");
  const [saving, setSaving] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [configuringWebhook, setConfiguringWebhook] = useState(false);
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [qrCode, setQrCode] = useState<QrCodeData | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState | null>(null);

  const saveConfig = async () => {
    if (!apiUrl.trim() || !apiKey.trim() || !instanceName.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("prefeituras")
        .update({
          evolution_api_url: apiUrl.replace(/\/$/, ""),
          evolution_api_key: apiKey,
          evolution_instance_name: instanceName,
        })
        .eq("id", prefeituraId);

      if (error) throw error;

      toast.success("Configuração salva com sucesso!");
      onConfigUpdate();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const checkConnection = async () => {
    if (!config.evolution_api_url || !config.evolution_api_key || !config.evolution_instance_name) {
      toast.error("Salve a configuração primeiro");
      return;
    }

    setCheckingConnection(true);
    setConnectionState(null);

    try {
      const response = await fetch(
        `${config.evolution_api_url}/instance/connectionState/${config.evolution_instance_name}`,
        {
          headers: {
            "apikey": config.evolution_api_key,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Erro ao verificar conexão");
      }

      const data = await response.json();
      setConnectionState(data.instance || data);

      const isConnected = data.instance?.state === "open" || data.state === "open";
      
      await supabase
        .from("prefeituras")
        .update({ evolution_connected: isConnected })
        .eq("id", prefeituraId);

      if (isConnected) {
        toast.success("WhatsApp conectado!");
      } else {
        toast.info("WhatsApp não conectado. Escaneie o QR Code.");
      }

      onConfigUpdate();
    } catch (error) {
      console.error("Erro ao verificar conexão:", error);
      toast.error("Erro ao verificar conexão. Verifique a URL e API Key.");
    } finally {
      setCheckingConnection(false);
    }
  };

  const fetchQrCode = async () => {
    if (!config.evolution_api_url || !config.evolution_api_key || !config.evolution_instance_name) {
      toast.error("Salve a configuração primeiro");
      return;
    }

    setLoadingQr(true);
    setQrCode(null);

    try {
      // First check if instance exists, if not create it
      const instanceResponse = await fetch(
        `${config.evolution_api_url}/instance/fetchInstances`,
        {
          headers: {
            "apikey": config.evolution_api_key,
          },
        }
      );

      if (instanceResponse.ok) {
        const instances = await instanceResponse.json();
        const instanceExists = instances.some((i: { name: string }) => i.name === config.evolution_instance_name);

        if (!instanceExists) {
          // Create instance
          const createResponse = await fetch(
            `${config.evolution_api_url}/instance/create`,
            {
              method: "POST",
              headers: {
                "apikey": config.evolution_api_key,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                instanceName: config.evolution_instance_name,
                qrcode: true,
              }),
            }
          );

          if (!createResponse.ok) {
            throw new Error("Erro ao criar instância");
          }

          const createData = await createResponse.json();
          if (createData.qrcode?.base64) {
            setQrCode({ base64: createData.qrcode.base64 });
            toast.success("Instância criada! Escaneie o QR Code.");
            setLoadingQr(false);
            return;
          }
        }
      }

      // Connect instance to get QR code
      const connectResponse = await fetch(
        `${config.evolution_api_url}/instance/connect/${config.evolution_instance_name}`,
        {
          headers: {
            "apikey": config.evolution_api_key,
          },
        }
      );

      if (!connectResponse.ok) {
        throw new Error("Erro ao conectar instância");
      }

      const data = await connectResponse.json();
      
      if (data.base64 || data.qrcode?.base64) {
        setQrCode({ base64: data.base64 || data.qrcode?.base64 });
        toast.success("QR Code gerado! Escaneie com seu WhatsApp.");
      } else if (data.instance?.state === "open") {
        toast.success("WhatsApp já está conectado!");
        await supabase
          .from("prefeituras")
          .update({ evolution_connected: true })
          .eq("id", prefeituraId);
        onConfigUpdate();
      } else {
        toast.info("Aguarde um momento e tente novamente.");
      }
    } catch (error) {
      console.error("Erro ao buscar QR Code:", error);
      toast.error("Erro ao gerar QR Code. Verifique as configurações.");
    } finally {
      setLoadingQr(false);
    }
  };

  const configureWebhook = async () => {
    if (!config.evolution_api_url || !config.evolution_api_key || !config.evolution_instance_name) {
      toast.error("Salve a configuração primeiro");
      return;
    }

    setConfiguringWebhook(true);
    setWebhookConfigured(false);

    try {
      // Configure webhook in Evolution API
      const response = await fetch(
        `${config.evolution_api_url}/webhook/set/${config.evolution_instance_name}`,
        {
          method: "POST",
          headers: {
            "apikey": config.evolution_api_key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: WEBHOOK_URL,
            webhook_by_events: true,
            webhook_base64: false,
            events: [
              "MESSAGES_UPSERT",
            ],
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Erro ao configurar webhook");
      }

      setWebhookConfigured(true);
      toast.success("Webhook configurado com sucesso! O sistema agora receberá mensagens automaticamente.");
    } catch (error) {
      console.error("Erro ao configurar webhook:", error);
      toast.error("Erro ao configurar webhook. Verifique as configurações da Evolution API.");
    } finally {
      setConfiguringWebhook(false);
    }
  };

  const isConfigured = config.evolution_api_url && config.evolution_api_key && config.evolution_instance_name;

  return (
    <div className="space-y-4">
      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Configuração da Evolution API
          </CardTitle>
          <CardDescription>
            Configure sua Evolution API para conectar o WhatsApp diretamente ao sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="apiUrl">URL da Evolution API</Label>
              <Input
                id="apiUrl"
                placeholder="https://sua-evolution-api.com"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                URL do servidor onde a Evolution API está hospedada
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Sua chave de API"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Chave de autenticação da Evolution API
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instanceName">Nome da Instância</Label>
              <Input
                id="instanceName"
                placeholder="prefeitura-exemplo"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              />
              <p className="text-xs text-muted-foreground">
                Nome único para a instância do WhatsApp (apenas letras, números e hífens)
              </p>
            </div>

            <div className="flex items-end">
              <Button onClick={saveConfig} disabled={saving} className="w-full">
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar Configuração
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection Status Card */}
      {isConfigured && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                Status da Conexão
              </span>
              <Badge 
                variant={config.evolution_connected ? "default" : "secondary"}
                className="gap-1"
              >
                {config.evolution_connected ? (
                  <>
                    <Wifi className="w-3 h-3" />
                    Conectado
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    Desconectado
                  </>
                )}
              </Badge>
            </CardTitle>
            <CardDescription>
              {config.evolution_connected 
                ? "Seu WhatsApp está conectado e pronto para receber mensagens"
                : "Escaneie o QR Code com seu WhatsApp para conectar"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={checkConnection}
                disabled={checkingConnection}
              >
                {checkingConnection ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Verificar Conexão
              </Button>
              
              {!config.evolution_connected && (
                <Button onClick={fetchQrCode} disabled={loadingQr}>
                  {loadingQr ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <QrCode className="w-4 h-4 mr-2" />
                  )}
                  Gerar QR Code
                </Button>
              )}
            </div>

            {connectionState && (
              <div className="p-3 rounded-lg bg-muted">
                <div className="flex items-center gap-2">
                  {connectionState.state === "open" ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-yellow-500" />
                  )}
                  <span className="font-medium">
                    Estado: {connectionState.state === "open" ? "Conectado" : connectionState.state}
                  </span>
                </div>
              </div>
            )}

            {qrCode?.base64 && !config.evolution_connected && (
              <div className="flex flex-col items-center p-6 bg-white rounded-lg border">
                <img 
                  src={qrCode.base64.startsWith("data:") ? qrCode.base64 : `data:image/png;base64,${qrCode.base64}`}
                  alt="QR Code WhatsApp" 
                  className="w-64 h-64"
                />
                <p className="mt-4 text-sm text-muted-foreground text-center">
                  Abra o WhatsApp no seu celular → Configurações → Dispositivos conectados → Conectar dispositivo
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={fetchQrCode}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar QR Code
                </Button>
              </div>
            )}

            {config.evolution_phone && (
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm">
                  <strong>Telefone conectado:</strong> {config.evolution_phone}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Webhook Configuration Card */}
      {isConfigured && config.evolution_connected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Link className="w-5 h-5" />
                Configuração do Webhook
              </span>
              {webhookConfigured && (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Configurado
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Configure o webhook para receber mensagens automaticamente e processá-las como reclamações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-muted space-y-2">
              <p className="text-sm font-medium">URL do Webhook:</p>
              <code className="text-xs break-all">{WEBHOOK_URL}</code>
            </div>

            <Button
              onClick={configureWebhook}
              disabled={configuringWebhook}
              className="w-full"
            >
              {configuringWebhook ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Settings className="w-4 h-4 mr-2" />
              )}
              Configurar Webhook Automaticamente
            </Button>

            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>Como funciona:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Cidadãos enviam mensagens para o WhatsApp conectado</li>
                <li>Para registrar uma reclamação, devem enviar: <code className="bg-muted px-1 rounded">/reclamar [descrição]</code></li>
                <li>O sistema cria a reclamação e responde com o protocolo</li>
                <li>Mensagens normais recebem instruções de como usar o sistema</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Como Configurar a Evolution API</CardTitle>
          <CardDescription>
            Siga estes passos para configurar a integração com WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h4 className="font-medium">Instale a Evolution API</h4>
                <p className="text-sm text-muted-foreground">
                  Faça o deploy da Evolution API em um servidor VPS ou Docker. 
                  <a 
                    href="https://doc.evolution-api.com/v2/pt/get-started/introduction" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline ml-1"
                  >
                    Ver documentação
                  </a>
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h4 className="font-medium">Configure as credenciais</h4>
                <p className="text-sm text-muted-foreground">
                  Insira a URL, API Key e nome da instância nos campos acima e clique em salvar.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h4 className="font-medium">Escaneie o QR Code</h4>
                <p className="text-sm text-muted-foreground">
                  Clique em "Gerar QR Code" e escaneie com o WhatsApp do celular que receberá as mensagens.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                4
              </div>
              <div>
                <h4 className="font-medium">Configure o Webhook</h4>
                <p className="text-sm text-muted-foreground">
                  Após conectar, clique em "Configurar Webhook Automaticamente" para ativar o recebimento de mensagens.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EvolutionApiConfig;
