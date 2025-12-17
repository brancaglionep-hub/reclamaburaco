import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Search, Eye, Clock, CheckCircle2, AlertCircle, Filter, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

interface OutletContext {
  prefeituraId: string;
}

interface Reclamacao {
  id: string;
  protocolo: string;
  status: string;
  rua: string;
  created_at: string;
  bairros: { nome: string } | null;
  categorias: { nome: string } | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  recebida: { label: "Recebida", color: "bg-blue-100 text-blue-700", icon: Clock },
  em_analise: { label: "Em Análise", color: "bg-yellow-100 text-yellow-700", icon: AlertCircle },
  em_andamento: { label: "Em Andamento", color: "bg-orange-100 text-orange-700", icon: Clock },
  resolvida: { label: "Resolvida", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  arquivada: { label: "Arquivada", color: "bg-gray-100 text-gray-700", icon: AlertCircle }
};

const PainelReclamacoes = () => {
  const { prefeituraId } = useOutletContext<OutletContext>();
  const navigate = useNavigate();
  const [reclamacoes, setReclamacoes] = useState<Reclamacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    const fetchReclamacoes = async () => {
      let query = supabase
        .from("reclamacoes")
        .select(`
          id,
          protocolo,
          status,
          rua,
          created_at,
          bairros (nome),
          categorias (nome)
        `)
        .eq("prefeitura_id", prefeituraId)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }

      const { data, error } = await query;

      if (!error && data) {
        setReclamacoes(data as any);
      }
      setLoading(false);
    };

    if (prefeituraId) {
      fetchReclamacoes();
    }
  }, [prefeituraId, statusFilter]);

  const filteredReclamacoes = reclamacoes.filter(r => 
    r.protocolo.toLowerCase().includes(search.toLowerCase()) ||
    r.rua.toLowerCase().includes(search.toLowerCase()) ||
    r.bairros?.nome.toLowerCase().includes(search.toLowerCase())
  );

  const handlePrint = async (reclamacaoId: string) => {
    // Buscar dados completos da reclamação
    const { data, error } = await supabase
      .from("reclamacoes")
      .select(`
        *,
        bairros (nome),
        categorias (nome)
      `)
      .eq("id", reclamacaoId)
      .single();

    if (error || !data) {
      toast({ title: "Erro ao carregar reclamação", variant: "destructive" });
      return;
    }

    const rec = data as any;
    const status = statusConfig[rec.status] || statusConfig.recebida;
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reclamação ${rec.protocolo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          h1 { font-size: 24px; margin-bottom: 8px; }
          h2 { font-size: 18px; margin-top: 24px; margin-bottom: 12px; border-bottom: 2px solid #333; padding-bottom: 4px; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 3px solid #333; padding-bottom: 16px; }
          .protocolo { font-size: 28px; font-weight: bold; }
          .status { padding: 8px 16px; border-radius: 20px; font-weight: bold; background: #e5e5e5; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          .info-item { margin-bottom: 12px; }
          .info-label { font-weight: bold; color: #555; font-size: 12px; text-transform: uppercase; }
          .info-value { font-size: 16px; margin-top: 4px; }
          .descricao { background: #f5f5f5; padding: 16px; border-radius: 8px; margin-top: 8px; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ccc; font-size: 12px; color: #666; text-align: center; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="protocolo">${rec.protocolo}</div>
            <div style="color: #666;">Reclamação de Via Pública</div>
          </div>
          <div class="status">${status.label}</div>
        </div>

        <h2>Dados do Cidadão</h2>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Nome</div>
            <div class="info-value">${rec.nome_cidadao}</div>
          </div>
          <div class="info-item">
            <div class="info-label">E-mail</div>
            <div class="info-value">${rec.email_cidadao}</div>
          </div>
          ${rec.telefone_cidadao ? `
          <div class="info-item">
            <div class="info-label">Telefone</div>
            <div class="info-value">${rec.telefone_cidadao}</div>
          </div>
          ` : ''}
        </div>

        <h2>Informações do Registro</h2>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Data de Registro</div>
            <div class="info-value">${new Date(rec.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Última Atualização</div>
            <div class="info-value">${new Date(rec.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
          </div>
        </div>

        ${rec.resposta_prefeitura ? `
        <h2>Resposta da Prefeitura</h2>
        <div class="descricao">${rec.resposta_prefeitura}</div>
        ` : ''}

        <h2>Problema Relatado</h2>
        <div class="info-item">
          <div class="info-label">Tipo</div>
          <div class="info-value">${rec.categorias?.nome || '-'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Descrição</div>
          <div class="descricao">${rec.descricao || 'Sem descrição'}</div>
        </div>

        ${rec.fotos?.length > 0 ? `
        <h2>Fotos Anexadas</h2>
        <p>${rec.fotos.length} foto(s) anexada(s) - visualizar no sistema</p>
        ` : ''}

        <h2>Localização</h2>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Rua</div>
            <div class="info-value">${rec.rua}${rec.numero ? `, ${rec.numero}` : ''}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Bairro</div>
            <div class="info-value">${rec.bairros?.nome || '-'}</div>
          </div>
          ${rec.referencia ? `
          <div class="info-item">
            <div class="info-label">Ponto de Referência</div>
            <div class="info-value">${rec.referencia}</div>
          </div>
          ` : ''}
        </div>

        <div class="footer">
          Documento gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Reclamações</h1>
        <p className="text-muted-foreground mt-1">Gerencie as reclamações recebidas</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Buscar por protocolo, rua ou bairro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="recebida">Recebidas</SelectItem>
            <SelectItem value="em_analise">Em Análise</SelectItem>
            <SelectItem value="em_andamento">Em Andamento</SelectItem>
            <SelectItem value="resolvida">Resolvidas</SelectItem>
            <SelectItem value="arquivada">Arquivadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Protocolo</TableHead>
              <TableHead>Bairro</TableHead>
              <TableHead>Rua</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReclamacoes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma reclamação encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredReclamacoes.map((reclamacao) => {
                const status = statusConfig[reclamacao.status] || statusConfig.recebida;
                return (
                  <TableRow key={reclamacao.id}>
                    <TableCell className="font-mono text-sm">{reclamacao.protocolo}</TableCell>
                    <TableCell>{reclamacao.bairros?.nome || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{reclamacao.rua}</TableCell>
                    <TableCell>{reclamacao.categorias?.nome || "-"}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(reclamacao.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/painel/${prefeituraId}/reclamacoes/${reclamacao.id}`)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePrint(reclamacao.id)}
                          title="Imprimir"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default PainelReclamacoes;
