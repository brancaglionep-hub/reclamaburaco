import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

interface OutletContext {
  prefeituraId: string;
}

interface Categoria {
  id: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
  ativo: boolean;
  global: boolean;
}

const PainelCategorias = () => {
  const { prefeituraId } = useOutletContext<OutletContext>();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [formData, setFormData] = useState({ nome: "", descricao: "" });

  const fetchCategorias = async () => {
    const { data, error } = await supabase
      .from("categorias")
      .select("*")
      .or(`prefeitura_id.eq.${prefeituraId},global.eq.true`)
      .order("nome");

    if (!error && data) {
      setCategorias(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (prefeituraId) {
      fetchCategorias();
    }
  }, [prefeituraId]);

  const handleOpenDialog = (categoria?: Categoria) => {
    if (categoria && !categoria.global) {
      setEditingCategoria(categoria);
      setFormData({ nome: categoria.nome, descricao: categoria.descricao || "" });
    } else {
      setEditingCategoria(null);
      setFormData({ nome: "", descricao: "" });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      toast({ title: "Digite o nome da categoria", variant: "destructive" });
      return;
    }

    if (editingCategoria) {
      const { error } = await supabase
        .from("categorias")
        .update({ nome: formData.nome.trim(), descricao: formData.descricao || null })
        .eq("id", editingCategoria.id);

      if (error) {
        toast({ title: "Erro ao atualizar", variant: "destructive" });
      } else {
        toast({ title: "Categoria atualizada!" });
        setDialogOpen(false);
        fetchCategorias();
      }
    } else {
      const { error } = await supabase
        .from("categorias")
        .insert({
          nome: formData.nome.trim(),
          descricao: formData.descricao || null,
          prefeitura_id: prefeituraId
        });

      if (error) {
        toast({ title: "Erro ao criar", variant: "destructive" });
      } else {
        toast({ title: "Categoria criada!" });
        setDialogOpen(false);
        fetchCategorias();
      }
    }
  };

  const handleToggleAtivo = async (categoria: Categoria) => {
    if (categoria.global) {
      toast({ title: "Categorias globais não podem ser alteradas", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("categorias")
      .update({ ativo: !categoria.ativo })
      .eq("id", categoria.id);

    if (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    } else {
      toast({ title: categoria.ativo ? "Categoria desativada" : "Categoria ativada" });
      fetchCategorias();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;

    const { error } = await supabase
      .from("categorias")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao excluir", description: "Pode haver reclamações vinculadas", variant: "destructive" });
    } else {
      toast({ title: "Categoria excluída!" });
      fetchCategorias();
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
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Categorias</h1>
          <p className="text-muted-foreground mt-1">Gerencie os tipos de reclamações</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Categoria
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categorias.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Nenhuma categoria cadastrada
                </TableCell>
              </TableRow>
            ) : (
              categorias.map((categoria) => (
                <TableRow key={categoria.id}>
                  <TableCell className="font-medium">{categoria.nome}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      categoria.global ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {categoria.global ? "Global" : "Local"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      categoria.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                    }`}>
                      {categoria.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {!categoria.global && (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleAtivo(categoria)}
                        >
                          {categoria.ativo ? (
                            <ToggleRight className="w-5 h-5 text-green-600" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-gray-400" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(categoria)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(categoria.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategoria ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Nome da Categoria</label>
              <Input
                placeholder="Ex: Buraco na rua"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Descrição (opcional)</label>
              <Textarea
                placeholder="Descreva esta categoria..."
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingCategoria ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PainelCategorias;
