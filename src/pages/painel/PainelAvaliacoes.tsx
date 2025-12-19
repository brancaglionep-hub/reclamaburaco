import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Star, MessageSquare, Calendar, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 10;

interface OutletContext {
  prefeituraId: string;
}

interface Avaliacao {
  id: string;
  estrelas: number;
  comentario: string | null;
  avaliado_em: string;
  reclamacoes: {
    protocolo: string;
    rua: string;
    nome_cidadao: string;
    bairros: { nome: string } | null;
  };
}

const PainelAvaliacoes = () => {
  const { prefeituraId } = useOutletContext<OutletContext>();
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstrelas, setFiltroEstrelas] = useState<string>("todas");
  const [currentPage, setCurrentPage] = useState(1);
  const [stats, setStats] = useState({
    total: 0,
    media: 0,
    distribuicao: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  });

  useEffect(() => {
    const fetchAvaliacoes = async () => {
      setLoading(true);

      let query = supabase
        .from("avaliacoes")
        .select(`
          id,
          estrelas,
          comentario,
          avaliado_em,
          reclamacoes (
            protocolo,
            rua,
            nome_cidadao,
            bairros (nome)
          )
        `)
        .eq("prefeitura_id", prefeituraId)
        .not("avaliado_em", "is", null)
        .order("avaliado_em", { ascending: false });

      if (filtroEstrelas !== "todas") {
        query = query.eq("estrelas", parseInt(filtroEstrelas));
      }

      const { data, error } = await query;

      if (!error && data) {
        setAvaliacoes(data as any);
      }

      // Fetch stats
      const { data: allData } = await supabase
        .from("avaliacoes")
        .select("estrelas")
        .eq("prefeitura_id", prefeituraId)
        .not("avaliado_em", "is", null);

      if (allData) {
        const total = allData.length;
        const soma = allData.reduce((acc, a) => acc + a.estrelas, 0);
        const media = total > 0 ? soma / total : 0;
        const distribuicao = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        allData.forEach((a) => {
          distribuicao[a.estrelas as 1 | 2 | 3 | 4 | 5]++;
        });
        setStats({ total, media, distribuicao });
      }

      setLoading(false);
    };

    if (prefeituraId) {
      fetchAvaliacoes();
    }
  }, [prefeituraId, filtroEstrelas]);

  const renderStars = (count: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= count
              ? "text-yellow-400 fill-yellow-400"
              : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );

  // Pagination logic
  const totalPages = Math.ceil(avaliacoes.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedAvaliacoes = avaliacoes.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleFiltroChange = (value: string) => {
    setFiltroEstrelas(value);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Avaliações</h1>
        <p className="text-muted-foreground">Feedback dos cidadãos sobre os serviços</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-6">
          <p className="text-sm text-muted-foreground mb-1">Total de Avaliações</p>
          <p className="text-3xl font-bold text-foreground">{stats.total}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-6">
          <p className="text-sm text-muted-foreground mb-1">Média Geral</p>
          <div className="flex items-center gap-2">
            <p className="text-3xl font-bold text-foreground">
              {stats.media.toFixed(1)}
            </p>
            <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-6">
          <p className="text-sm text-muted-foreground mb-2">Distribuição</p>
          <div className="space-y-1">
            {[5, 4, 3, 2, 1].map((star) => (
              <div key={star} className="flex items-center gap-2 text-sm">
                <span className="w-4 text-muted-foreground">{star}</span>
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full"
                    style={{
                      width: stats.total > 0
                        ? `${(stats.distribuicao[star as 1 | 2 | 3 | 4 | 5] / stats.total) * 100}%`
                        : "0%"
                    }}
                  />
                </div>
                <span className="w-8 text-right text-muted-foreground">
                  {stats.distribuicao[star as 1 | 2 | 3 | 4 | 5]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filtrar por:</span>
        </div>
        <Select value={filtroEstrelas} onValueChange={handleFiltroChange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as avaliações</SelectItem>
            <SelectItem value="5">⭐⭐⭐⭐⭐ 5 estrelas</SelectItem>
            <SelectItem value="4">⭐⭐⭐⭐ 4 estrelas</SelectItem>
            <SelectItem value="3">⭐⭐⭐ 3 estrelas</SelectItem>
            <SelectItem value="2">⭐⭐ 2 estrelas</SelectItem>
            <SelectItem value="1">⭐ 1 estrela</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Avaliacoes List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : avaliacoes.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {filtroEstrelas === "todas"
              ? "Nenhuma avaliação recebida ainda"
              : `Nenhuma avaliação com ${filtroEstrelas} estrela(s)`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedAvaliacoes.map((avaliacao) => (
            <div
              key={avaliacao.id}
              className="bg-card rounded-xl border border-border p-6"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {renderStars(avaliacao.estrelas)}
                    <span className="text-sm font-medium text-foreground">
                      {avaliacao.estrelas}/5
                    </span>
                  </div>
                  
                  {avaliacao.comentario && (
                    <div className="flex items-start gap-2 mb-3">
                      <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <p className="text-foreground">{avaliacao.comentario}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="font-medium text-primary">
                      {avaliacao.reclamacoes?.protocolo}
                    </span>
                    <span>{avaliacao.reclamacoes?.rua}</span>
                    {avaliacao.reclamacoes?.bairros?.nome && (
                      <span>{avaliacao.reclamacoes.bairros.nome}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {new Date(avaliacao.avaliado_em).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric"
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {startIndex + 1} a {Math.min(startIndex + ITEMS_PER_PAGE, avaliacoes.length)} de {avaliacoes.length} avaliações
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => handlePageChange(currentPage - 1)}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={() => handlePageChange(page)}
                    isActive={currentPage === page}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext 
                  onClick={() => handlePageChange(currentPage + 1)}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default PainelAvaliacoes;