import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Search, Eye, Clock, CheckCircle2, AlertCircle, Filter } from "lucide-react";
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/painel/${prefeituraId}/reclamacoes/${reclamacao.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver
                      </Button>
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
