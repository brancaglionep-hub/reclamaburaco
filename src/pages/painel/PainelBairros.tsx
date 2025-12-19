import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface OutletContext {
  prefeituraId: string;
}

interface Bairro {
  id: string;
  nome: string;
  ativo: boolean;
}

const ITEMS_PER_PAGE = 10;

const PainelBairros = () => {
  const { prefeituraId } = useOutletContext<OutletContext>();
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBairro, setEditingBairro] = useState<Bairro | null>(null);
  const [nome, setNome] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchBairros = async () => {
    const { data, error } = await supabase
      .from("bairros")
      .select("*")
      .eq("prefeitura_id", prefeituraId)
      .order("nome");

    if (!error && data) {
      setBairros(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (prefeituraId) {
      fetchBairros();
    }
  }, [prefeituraId]);

  // Filter and pagination logic
  const filteredBairros = bairros.filter((bairro) =>
    bairro.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.ceil(filteredBairros.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedBairros = filteredBairros.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleOpenDialog = (bairro?: Bairro) => {
    if (bairro) {
      setEditingBairro(bairro);
      setNome(bairro.nome);
    } else {
      setEditingBairro(null);
      setNome("");
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast({ title: "Digite o nome do bairro", variant: "destructive" });
      return;
    }

    if (editingBairro) {
      const { error } = await supabase
        .from("bairros")
        .update({ nome: nome.trim() })
        .eq("id", editingBairro.id);

      if (error) {
        toast({ title: "Erro ao atualizar", variant: "destructive" });
      } else {
        toast({ title: "Bairro atualizado!" });
        setDialogOpen(false);
        fetchBairros();
      }
    } else {
      const { error } = await supabase
        .from("bairros")
        .insert({
          nome: nome.trim(),
          prefeitura_id: prefeituraId
        });

      if (error) {
        toast({ title: "Erro ao criar", variant: "destructive" });
      } else {
        toast({ title: "Bairro criado!" });
        setDialogOpen(false);
        fetchBairros();
      }
    }
  };

  const handleToggleAtivo = async (bairro: Bairro) => {
    const { error } = await supabase
      .from("bairros")
      .update({ ativo: !bairro.ativo })
      .eq("id", bairro.id);

    if (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    } else {
      toast({ title: bairro.ativo ? "Bairro desativado" : "Bairro ativado" });
      fetchBairros();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este bairro?")) return;

    const { error } = await supabase
      .from("bairros")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao excluir", description: "Pode haver reclamações vinculadas", variant: "destructive" });
    } else {
      toast({ title: "Bairro excluído!" });
      fetchBairros();
      // Adjust current page if needed
      if (paginatedBairros.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Bairros</h1>
          <p className="text-muted-foreground mt-1">Gerencie os bairros da cidade</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Bairro
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar bairro..."
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedBairros.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "Nenhum bairro encontrado" : "Nenhum bairro cadastrado"}
                </TableCell>
              </TableRow>
            ) : (
              paginatedBairros.map((bairro) => (
                <TableRow key={bairro.id}>
                  <TableCell className="font-medium">{bairro.nome}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      bairro.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                    }`}>
                      {bairro.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleAtivo(bairro)}
                      >
                        {bairro.ativo ? (
                          <ToggleRight className="w-5 h-5 text-green-600" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-gray-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(bairro)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(bairro.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {startIndex + 1} a {Math.min(startIndex + ITEMS_PER_PAGE, filteredBairros.length)} de {filteredBairros.length} bairros
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBairro ? "Editar Bairro" : "Novo Bairro"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Nome do Bairro</label>
              <Input
                placeholder="Ex: Centro"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingBairro ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PainelBairros;
