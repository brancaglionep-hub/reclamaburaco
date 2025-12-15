import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Building2, Phone, Mail, FileText, Search, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ComplaintForm from "@/components/ComplaintForm";
import ConsultaProtocolo from "@/components/ConsultaProtocolo";

interface Prefeitura {
  id: string;
  nome: string;
  cidade: string;
  slug: string;
  logo_url: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  texto_institucional: string | null;
  email_contato: string | null;
  telefone_contato: string | null;
}

const CityPage = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const bairroId = searchParams.get("bairro");
  
  const [prefeitura, setPrefeitura] = useState<Prefeitura | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showConsulta, setShowConsulta] = useState(false);

  useEffect(() => {
    const fetchPrefeitura = async () => {
      const { data, error } = await supabase
        .from("prefeituras")
        .select("*")
        .eq("slug", slug)
        .eq("ativo", true)
        .maybeSingle();

      if (!error && data) {
        setPrefeitura(data);
        // Registrar visita
        await supabase.from("visitas").insert({
          prefeitura_id: data.id,
          pagina: "home"
        });
      }
      setLoading(false);
    };

    if (slug) {
      fetchPrefeitura();
    }
  }, [slug]);

  // Aplicar cores da prefeitura
  useEffect(() => {
    if (prefeitura?.cor_primaria) {
      document.documentElement.style.setProperty("--dynamic-primary", prefeitura.cor_primaria);
    }
    return () => {
      document.documentElement.style.removeProperty("--dynamic-primary");
    };
  }, [prefeitura]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!prefeitura) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Cidade não encontrada</h1>
        <p className="text-muted-foreground">Verifique o endereço e tente novamente.</p>
      </div>
    );
  }

  if (showForm) {
    return <ComplaintForm onClose={() => setShowForm(false)} prefeituraId={prefeitura.id} bairroId={bairroId} />;
  }

  if (showConsulta) {
    return <ConsultaProtocolo onClose={() => setShowConsulta(false)} prefeituraId={prefeitura.id} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            {prefeitura.logo_url ? (
              <img src={prefeitura.logo_url} alt={prefeitura.nome} className="w-16 h-16 object-contain" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <Building2 className="w-8 h-8" />
              </div>
            )}
            <div>
              <h1 className="text-xl lg:text-2xl font-bold">{prefeitura.nome}</h1>
              <p className="text-primary-foreground/80">{prefeitura.cidade}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        {/* Texto institucional */}
        {prefeitura.texto_institucional && (
          <div className="bg-card rounded-xl border border-border p-6 mb-8">
            <p className="text-muted-foreground">{prefeitura.texto_institucional}</p>
          </div>
        )}

        {/* Ações principais */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-4 p-6 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity"
          >
            <div className="w-14 h-14 rounded-full bg-primary-foreground/20 flex items-center justify-center shrink-0">
              <FileText className="w-7 h-7" />
            </div>
            <div className="text-left">
              <p className="font-bold text-lg">Registrar Reclamação</p>
              <p className="text-primary-foreground/80 text-sm">Informe um problema na sua rua</p>
            </div>
          </button>

          <button
            onClick={() => setShowConsulta(true)}
            className="flex items-center gap-4 p-6 bg-card border-2 border-border rounded-xl hover:border-primary transition-colors"
          >
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Search className="w-7 h-7 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-bold text-lg text-foreground">Acompanhar Reclamação</p>
              <p className="text-muted-foreground text-sm">Consulte pelo protocolo</p>
            </div>
          </button>
        </div>

        {/* Contatos */}
        {(prefeitura.telefone_contato || prefeitura.email_contato) && (
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="font-semibold text-foreground mb-4">Contato</h2>
            <div className="space-y-3">
              {prefeitura.telefone_contato && (
                <a href={`tel:${prefeitura.telefone_contato}`} className="flex items-center gap-3 text-muted-foreground hover:text-primary">
                  <Phone className="w-5 h-5" />
                  <span>{prefeitura.telefone_contato}</span>
                </a>
              )}
              {prefeitura.email_contato && (
                <a href={`mailto:${prefeitura.email_contato}`} className="flex items-center gap-3 text-muted-foreground hover:text-primary">
                  <Mail className="w-5 h-5" />
                  <span>{prefeitura.email_contato}</span>
                </a>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-muted py-6 px-4 text-center">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} {prefeitura.nome} - Todos os direitos reservados
        </p>
      </footer>
    </div>
  );
};

export default CityPage;
