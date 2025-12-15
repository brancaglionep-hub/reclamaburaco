import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Save, Upload, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

interface OutletContext {
  prefeitura: { id: string; nome: string; cidade: string } | null;
  prefeituraId: string;
}

interface Prefeitura {
  id: string;
  nome: string;
  cidade: string;
  logo_url: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  texto_institucional: string | null;
  email_contato: string | null;
  telefone_contato: string | null;
}

const PainelConfiguracoes = () => {
  const { prefeituraId } = useOutletContext<OutletContext>();
  const [prefeitura, setPrefeitura] = useState<Prefeitura | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    cidade: "",
    logo_url: "",
    cor_primaria: "#1e40af",
    cor_secundaria: "#3b82f6",
    texto_institucional: "",
    email_contato: "",
    telefone_contato: ""
  });

  useEffect(() => {
    const fetchPrefeitura = async () => {
      const { data, error } = await supabase
        .from("prefeituras")
        .select("*")
        .eq("id", prefeituraId)
        .single();

      if (!error && data) {
        setPrefeitura(data);
        setFormData({
          nome: data.nome,
          cidade: data.cidade,
          logo_url: data.logo_url || "",
          cor_primaria: data.cor_primaria || "#1e40af",
          cor_secundaria: data.cor_secundaria || "#3b82f6",
          texto_institucional: data.texto_institucional || "",
          email_contato: data.email_contato || "",
          telefone_contato: data.telefone_contato || ""
        });
      }
      setLoading(false);
    };

    if (prefeituraId) {
      fetchPrefeitura();
    }
  }, [prefeituraId]);

  const handleSave = async () => {
    setSaving(true);

    const { error } = await supabase
      .from("prefeituras")
      .update({
        nome: formData.nome,
        cidade: formData.cidade,
        logo_url: formData.logo_url || null,
        cor_primaria: formData.cor_primaria,
        cor_secundaria: formData.cor_secundaria,
        texto_institucional: formData.texto_institucional || null,
        email_contato: formData.email_contato || null,
        telefone_contato: formData.telefone_contato || null
      })
      .eq("id", prefeituraId);

    if (error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } else {
      toast({ title: "Configurações salvas!" });
    }

    setSaving(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split(".").pop();
    const filePath = `logos/${prefeituraId}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("reclamacoes-media")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Erro ao fazer upload", variant: "destructive" });
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("reclamacoes-media")
      .getPublicUrl(filePath);

    setFormData({ ...formData, logo_url: publicUrl });
    toast({ title: "Logo enviado! Clique em Salvar para aplicar." });
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
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">Personalize sua prefeitura</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Info básica */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Informações Básicas</h2>
          
          <div>
            <label className="text-sm font-medium mb-2 block">Nome da Prefeitura</label>
            <Input
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Cidade</label>
            <Input
              value={formData.cidade}
              onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Texto Institucional</label>
            <Textarea
              placeholder="Texto que aparecerá no site público..."
              value={formData.texto_institucional}
              onChange={(e) => setFormData({ ...formData, texto_institucional: e.target.value })}
              rows={4}
            />
          </div>
        </div>

        {/* Logo e Cores */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Logo e Cores</h2>

          <div>
            <label className="text-sm font-medium mb-2 block">Logo</label>
            <div className="flex items-center gap-4">
              {formData.logo_url ? (
                <img src={formData.logo_url} alt="Logo" className="w-16 h-16 object-contain rounded-lg border border-border" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <label className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm">Enviar Logo</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Cor Primária</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.cor_primaria}
                  onChange={(e) => setFormData({ ...formData, cor_primaria: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <Input
                  value={formData.cor_primaria}
                  onChange={(e) => setFormData({ ...formData, cor_primaria: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Cor Secundária</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.cor_secundaria}
                  onChange={(e) => setFormData({ ...formData, cor_secundaria: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <Input
                  value={formData.cor_secundaria}
                  onChange={(e) => setFormData({ ...formData, cor_secundaria: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground mb-2">Preview</p>
            <div className="flex gap-2">
              <div
                className="w-16 h-8 rounded"
                style={{ backgroundColor: formData.cor_primaria }}
              />
              <div
                className="w-16 h-8 rounded"
                style={{ backgroundColor: formData.cor_secundaria }}
              />
            </div>
          </div>
        </div>

        {/* Contato */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-4 lg:col-span-2">
          <h2 className="font-semibold text-foreground">Contato</h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">E-mail de Contato</label>
              <Input
                type="email"
                placeholder="contato@prefeitura.gov.br"
                value={formData.email_contato}
                onChange={(e) => setFormData({ ...formData, email_contato: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Telefone de Contato</label>
              <Input
                placeholder="(48) 3333-3333"
                value={formData.telefone_contato}
                onChange={(e) => setFormData({ ...formData, telefone_contato: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PainelConfiguracoes;
