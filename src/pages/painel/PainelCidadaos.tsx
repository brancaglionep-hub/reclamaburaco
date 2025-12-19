import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Users, Plus, Pencil, Trash2, Bell, BellOff, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface OutletContext {
  prefeituraId: string;
}

interface Bairro {
  id: string;
  nome: string;
}

interface Cidadao {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  bairro_id: string | null;
  aceita_alertas: boolean;
  ativo: boolean;
  bairro: { nome: string } | null;
}

const PainelCidadaos = () => {
  const { prefeituraId } = useOutletContext<OutletContext>();
  const [loading, setLoading] = useState(true);
  const [cidadaos, setCidadaos] = useState<Cidadao[]>([]);
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCidadao, setEditingCidadao] = useState<Cidadao | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [bairroId, setBairroId] = useState<string>("none");
  const [aceitaAlertas, setAceitaAlertas] = useState(true);

  const fetchData = async () => {
    try {
      const [cidadaosRes, bairrosRes] = await Promise.all([
        supabase
          .from("cidadaos")
          .select(`
            id,
            nome,
            email,
            telefone,
            bairro_id,
            aceita_alertas,
            ativo,
            bairro:bairros(nome)
          `)
          .eq("prefeitura_id", prefeituraId)
          .eq("ativo", true)
          .order("nome"),
        supabase
          .from("bairros")
          .select("id, nome")
          .eq("prefeitura_id", prefeituraId)
          .eq("ativo", true)
          .order("nome"),
      ]);

      if (cidadaosRes.data) {
        setCidadaos(cidadaosRes.data as unknown as Cidadao[]);
      }
      if (bairrosRes.data) {
        setBairros(bairrosRes.data);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (prefeituraId) fetchData();
  }, [prefeituraId]);

  const handleOpenDialog = (cidadao?: Cidadao) => {
    if (cidadao) {
      setEditingCidadao(cidadao);
      setNome(cidadao.nome);
      setEmail(cidadao.email || "");
      setTelefone(cidadao.telefone || "");
      setBairroId(cidadao.bairro_id || "none");
      setAceitaAlertas(cidadao.aceita_alertas);
    } else {
      setEditingCidadao(null);
      setNome("");
      setEmail("");
      setTelefone("");
      setBairroId("none");
      setAceitaAlertas(true);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast({ title: "Erro", description: "Informe o nome do cidadão", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const data = {
        nome: nome.trim(),
        email: email.trim() || null,
        telefone: telefone.trim() || null,
        bairro_id: bairroId === "none" ? null : bairroId,
        aceita_alertas: aceitaAlertas,
        prefeitura_id: prefeituraId,
      };

      if (editingCidadao) {
        const { error } = await supabase
          .from("cidadaos")
          .update(data)
          .eq("id", editingCidadao.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Cidadão atualizado com sucesso" });
      } else {
        const { error } = await supabase.from("cidadaos").insert(data);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Cidadão cadastrado com sucesso" });
      }

      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast({ title: "Erro", description: "Não foi possível salvar o cidadão", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAlertas = async (cidadao: Cidadao) => {
    try {
      const { error } = await supabase
        .from("cidadaos")
        .update({ aceita_alertas: !cidadao.aceita_alertas })
        .eq("id", cidadao.id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      toast({ title: "Erro", description: "Não foi possível atualizar", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    
    try {
      const { error } = await supabase
        .from("cidadaos")
        .update({ ativo: false })
        .eq("id", deletingId);
      if (error) throw error;
      
      toast({ title: "Sucesso", description: "Cidadão removido com sucesso" });
      setDeleteDialogOpen(false);
      setDeletingId(null);
      fetchData();
    } catch (error) {
      console.error("Erro ao remover:", error);
      toast({ title: "Erro", description: "Não foi possível remover", variant: "destructive" });
    }
  };

  const filteredCidadaos = cidadaos.filter(
    (c) =>
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.telefone?.includes(search)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cidadãos Cadastrados</h1>
            <p className="text-muted-foreground">
              Gerencie os cidadãos que receberão alertas
            </p>
          </div>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Cidadão
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Cidadãos</CardTitle>
          <CardDescription>
            {filteredCidadaos.length} cidadão(s) cadastrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCidadaos.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">Nenhum cidadão encontrado</h3>
              <p className="text-muted-foreground">
                {search ? "Tente outro termo de busca" : "Cadastre o primeiro cidadão"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Bairro</TableHead>
                    <TableHead className="text-center">Alertas</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCidadaos.map((cidadao) => (
                    <TableRow key={cidadao.id}>
                      <TableCell className="font-medium">{cidadao.nome}</TableCell>
                      <TableCell>{cidadao.email || "-"}</TableCell>
                      <TableCell>{cidadao.telefone || "-"}</TableCell>
                      <TableCell>{cidadao.bairro?.nome || "-"}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleAlertas(cidadao)}
                          className={cidadao.aceita_alertas ? "text-green-600" : "text-muted-foreground"}
                        >
                          {cidadao.aceita_alertas ? (
                            <Bell className="w-4 h-4" />
                          ) : (
                            <BellOff className="w-4 h-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(cidadao)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeletingId(cidadao.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCidadao ? "Editar Cidadão" : "Novo Cidadão"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do cidadão
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Select value={bairroId} onValueChange={setBairroId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o bairro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {bairros.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="aceita-alertas">Aceita receber alertas (LGPD)</Label>
              <Switch
                id="aceita-alertas"
                checked={aceitaAlertas}
                onCheckedChange={setAceitaAlertas}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar remoção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este cidadão? Ele não receberá mais alertas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PainelCidadaos;
