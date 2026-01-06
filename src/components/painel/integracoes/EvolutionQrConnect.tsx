import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  QrCode, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Loader2,
  CheckCircle,
  XCircle,
  Smartphone,
  Settings,
  Link as LinkIcon,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EvolutionQrConnectProps {
  prefeituraId: string;
  prefeituraSlug: string;
  evolutionConnected: boolean;
  evolutionPhone: string | null;
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

interface EvolutionGlobalConfig {
  url: string | null;
  api_key: string | null;
}

const WEBHOOK_URL = "https://sfsjtljhrelctpxpzody.supabase.co/functions/v1/receive-evolution-webhook";
const PROXY_URL = "https://sfsjtljhrelctpxpzody.supabase.co/functions/v1/evolution-api-proxy";

const EvolutionQrConnect = ({ 
  prefeituraId, 
  prefeituraSlug, 
  evolutionConnected, 
  evolutionPhone,
  onConfigUpdate 
}: EvolutionQrConnectProps) => {
  const [loading, setLoading] = useState(true);
  const [globalConfig, setGlobalConfig] = useState<EvolutionGlobalConfig | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [configuringWebhook, setConfiguringWebhook] = useState(false);
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [qrCode, setQrCode] = useState<QrCodeData | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState | null>(null);
  const [awaitingScan, setAwaitingScan] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const instanceName = `prefeitura-${prefeituraSlug}`;
  
  useEffect(() => {
    fetchGlobalConfig();
  }, []);

  const fetchGlobalConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("configuracoes_sistema")
        .select("valor")
        .eq("chave", "evolution_api")
        .single();

      if (error) throw error;

      if (data?.valor) {
        const valor = data.valor as Record<string, unknown>;
        const config: EvolutionGlobalConfig = {
          url: typeof valor.url === "string" ? valor.url : null,
          api_key: typeof valor.api_key === "string" ? valor.api_key : null,
        };
        console.log("Evolution config loaded:", { url: config.url ? "SET" : "NOT SET", api_key: config.api_key ? "SET" : "NOT SET" });
        setGlobalConfig(config);
      }
    } catch (error) {
      console.error("Erro ao carregar configuração global:", error);
    } finally {
      setLoading(false);
    }
  };

  const isGlobalConfigured = globalConfig?.url && globalConfig?.api_key;

  const callEvolutionProxy = async (endpoint: string, method = "GET", body?: object) => {
    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prefeituraId,
        endpoint,
        method,
        body,
        useGlobalConfig: true,
        instanceName,
      }),
    });
    return response;
  };

  const checkConnectionSilent = useCallback(async () => {
    if (!isGlobalConfigured) return false;

    try {
      const response = await callEvolutionProxy(
        `/instance/connectionState/${instanceName}`
      );

      const data = await response.json();
      
      if (!response.ok) return false;

      const isConnected = data.instance?.state === "open" || data.state === "open";

      if (isConnected) {
        setQrCode(null);
        setAwaitingScan(false);
        setJustConnected(true);
        setConnectionState(data.instance || data);
        toast.success("🎉 WhatsApp CONECTADO com sucesso!");
        
        // Atualizar dados e recarregar página após 2 segundos
        setTimeout(() => {
          onConfigUpdate();
          window.location.reload();
        }, 2000);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Erro ao verificar conexão:", error);
      return false;
    }
  }, [isGlobalConfigured, instanceName, onConfigUpdate]);

  // Auto-check connection every 5 seconds when QR code is displayed (more frequent for better UX)
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (qrCode?.base64 && !evolutionConnected && !justConnected) {
      setAwaitingScan(true);
      setCountdown(3); // Initial check after 3 seconds
      
      // Countdown timer
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            return 5; // Reset to 5 seconds after each check
          }
          return prev - 1;
        });
      }, 1000);
      
      // Check immediately after 3 seconds
      const initialCheck = setTimeout(() => {
        checkConnectionSilent();
        setCountdown(5);
      }, 3000);
      
      // Then check every 5 seconds
      pollingRef.current = setInterval(async () => {
        const connected = await checkConnectionSilent();
        if (connected) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
        }
        setCountdown(5);
      }, 5000);

      return () => {
        clearTimeout(initialCheck);
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      };
    }
  }, [qrCode?.base64, evolutionConnected, justConnected, checkConnectionSilent]);

  const checkConnection = async () => {
    if (!isGlobalConfigured) {
      toast.error("Evolution API não configurada pelo administrador");
      return;
    }

    setCheckingConnection(true);
    setConnectionState(null);

    try {
      const response = await callEvolutionProxy(
        `/instance/connectionState/${instanceName}`
      );

      const data = await response.json();
      
      if (!response.ok) {
        // Instance might not exist yet, that's ok
        if (response.status === 404) {
          toast.info("Clique em 'Conectar WhatsApp' para iniciar.");
          return;
        }
        throw new Error(data.error || "Erro ao verificar conexão");
      }

      setConnectionState(data.instance || data);

      const isConnected = data.instance?.state === "open" || data.state === "open";

      if (isConnected) {
        setQrCode(null);
        toast.success("WhatsApp conectado!");
      } else {
        toast.info("WhatsApp não conectado. Clique em 'Conectar WhatsApp'.");
      }

      onConfigUpdate();
    } catch (error) {
      console.error("Erro ao verificar conexão:", error);
      toast.info("Instância ainda não criada. Clique em 'Conectar WhatsApp'.");
    } finally {
      setCheckingConnection(false);
    }
  };

  const connectWhatsApp = async () => {
    if (!isGlobalConfigured) {
      toast.error("Evolution API não configurada pelo administrador");
      return;
    }

    setLoadingQr(true);
    setQrCode(null);

    try {
      // First check if instance exists
      const instanceResponse = await callEvolutionProxy(`/instance/fetchInstances`);

      if (instanceResponse.ok) {
        const instances = await instanceResponse.json();
        const instanceExists = Array.isArray(instances) && instances.some((i: { name: string }) => i.name === instanceName);

        if (!instanceExists) {
          // Create instance with auto webhook configuration
          toast.info("Criando instância...");
          const createResponse = await callEvolutionProxy(
            `/instance/create`,
            "POST",
            {
              instanceName: instanceName,
              qrcode: true,
              integration: "WHATSAPP-BAILEYS",
              webhook: {
                url: WEBHOOK_URL,
                webhook_by_events: true,
                webhook_base64: false,
                events: ["MESSAGES_UPSERT"]
              }
            }
          );

          const createData = await createResponse.json();
          
          if (!createResponse.ok) {
            throw new Error(createData.error || "Erro ao criar instância");
          }

          // Save instance name to prefeitura
          await supabase
            .from("prefeituras")
            .update({ evolution_instance_name: instanceName })
            .eq("id", prefeituraId);

          if (createData.qrcode?.base64) {
            setQrCode({ base64: createData.qrcode.base64 });
            setWebhookConfigured(true);
            setAwaitingScan(true);
            toast.success("Instância criada! Escaneie o QR Code.");
            setLoadingQr(false);
            return;
          }
        }
      }

      // Connect instance to get QR code
      const connectResponse = await callEvolutionProxy(`/instance/connect/${instanceName}`);
      const data = await connectResponse.json();

      if (!connectResponse.ok) {
        throw new Error(data.error || "Erro ao conectar instância");
      }
      
      if (data.base64 || data.qrcode?.base64) {
        setQrCode({ base64: data.base64 || data.qrcode?.base64 });
        setAwaitingScan(true);
        toast.success("QR Code gerado! Escaneie com seu WhatsApp.");
      } else if (data.instance?.state === "open") {
        toast.success("WhatsApp já está conectado!");
        onConfigUpdate();
      } else {
        toast.info("Aguarde um momento e tente novamente.");
      }
    } catch (error) {
      console.error("Erro ao conectar:", error);
      toast.error("Erro ao gerar QR Code. Tente novamente.");
    } finally {
      setLoadingQr(false);
    }
  };

  const configureWebhook = async () => {
    if (!isGlobalConfigured) {
      toast.error("Evolution API não configurada");
      return;
    }

    setConfiguringWebhook(true);
    setWebhookConfigured(false);

    try {
      const response = await callEvolutionProxy(
        `/webhook/set/${instanceName}`,
        "POST",
        {
          url: WEBHOOK_URL,
          webhook_by_events: true,
          webhook_base64: false,
          events: ["MESSAGES_UPSERT"],
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao configurar webhook");
      }

      setWebhookConfigured(true);
      toast.success("Webhook configurado! O sistema receberá mensagens automaticamente.");
    } catch (error) {
      console.error("Erro ao configurar webhook:", error);
      toast.error("Erro ao configurar webhook.");
    } finally {
      setConfiguringWebhook(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!isGlobalConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Evolution API não configurada
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Solicite ao administrador do sistema para configurar a Evolution API nas configurações globais.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Conexão WhatsApp
          </span>
          <Badge 
            variant={evolutionConnected ? "default" : "secondary"}
            className="gap-1"
          >
            {evolutionConnected ? (
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
          {evolutionConnected 
            ? "Seu WhatsApp está conectado e pronto para receber reclamações"
            : "Conecte seu WhatsApp para receber reclamações automaticamente"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Instance Info */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Nome da instância:</strong> {instanceName}
          </p>
          {evolutionPhone && (
            <p className="text-sm text-muted-foreground">
              <strong>Telefone:</strong> {evolutionPhone}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
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
          
          {!evolutionConnected && (
            <Button onClick={connectWhatsApp} disabled={loadingQr}>
              {loadingQr ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4 mr-2" />
              )}
              Conectar WhatsApp
            </Button>
          )}

          {evolutionConnected && !webhookConfigured && (
            <Button 
              variant="outline" 
              onClick={configureWebhook}
              disabled={configuringWebhook}
            >
              {configuringWebhook ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Settings className="w-4 h-4 mr-2" />
              )}
              Configurar Webhook
            </Button>
          )}
        </div>

        {/* Just Connected Success Message */}
        {justConnected && (
          <div className="flex flex-col items-center gap-4 p-8 bg-green-50 dark:bg-green-950/30 border-2 border-green-500 rounded-lg animate-pulse">
            <CheckCircle className="w-16 h-16 text-green-600" />
            <div className="text-center">
              <h3 className="text-2xl font-bold text-green-700 dark:text-green-400">
                CONECTADO!
              </h3>
              <p className="text-green-600 dark:text-green-500 mt-2">
                WhatsApp conectado com sucesso!
              </p>
              <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Atualizando página...
              </div>
            </div>
          </div>
        )}

        {/* QR Code Display */}
        {qrCode?.base64 && !justConnected && (
          <div className="flex flex-col items-center gap-4 p-6 bg-white dark:bg-gray-900 rounded-lg border">
            <p className="text-sm text-muted-foreground text-center">
              Escaneie o QR Code abaixo com o WhatsApp do celular que será usado para receber reclamações
            </p>
            <div className="p-4 bg-white rounded-lg shadow-sm relative">
              <img 
                src={qrCode.base64.startsWith("data:") ? qrCode.base64 : `data:image/png;base64,${qrCode.base64}`} 
                alt="QR Code WhatsApp" 
                className="w-64 h-64"
              />
            </div>
            
            {/* Awaiting Scan Indicator */}
            {awaitingScan && (
              <div className="flex flex-col items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg w-full">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </span>
                  </div>
                  <span className="font-medium text-blue-700 dark:text-blue-300">
                    Aguardando leitura do QR Code...
                  </span>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 text-center">
                  Abra o WhatsApp no celular → Menu (⋮) → Dispositivos conectados → Conectar dispositivo
                </p>
                <div className="flex items-center justify-center gap-3 p-2 bg-blue-100 dark:bg-blue-900/50 rounded-md">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Próxima verificação em
                  </span>
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-lg">
                    {countdown}
                  </span>
                  <span className="text-sm text-blue-600 dark:text-blue-400">
                    segundo{countdown !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Connection State */}
        {connectionState && !justConnected && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              {connectionState.state === "open" ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-amber-600" />
              )}
              <span className="font-medium">
                {connectionState.state === "open" ? "Conectado" : "Desconectado"}
              </span>
            </div>
          </div>
        )}

        {/* Webhook Status */}
        {webhookConfigured && (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg">
            <LinkIcon className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-800 dark:text-green-200">
              Webhook configurado - mensagens serão recebidas automaticamente
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EvolutionQrConnect;
