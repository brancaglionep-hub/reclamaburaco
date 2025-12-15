import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Building2, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

interface Bairro {
  id: string;
  nome: string;
  prefeitura_id: string;
  prefeitura?: {
    id: string;
    nome: string;
    cidade: string;
    slug: string;
  };
}

const Home = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBairros = async () => {
      const { data, error } = await supabase
        .from("bairros")
        .select(`
          id,
          nome,
          prefeitura_id,
          prefeituras (
            id,
            nome,
            cidade,
            slug
          )
        `)
        .eq("ativo", true)
        .order("nome");

      if (!error && data) {
        setBairros(data.map(b => ({
          ...b,
          prefeitura: b.prefeituras as any
        })));
      }
      setLoading(false);
    };

    fetchBairros();
  }, []);

  const filteredBairros = bairros.filter(b => 
    b.nome.toLowerCase().includes(search.toLowerCase()) ||
    b.prefeitura?.cidade.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectBairro = (bairro: Bairro) => {
    if (bairro.prefeitura) {
      navigate(`/${bairro.prefeitura.slug}?bairro=${bairro.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-6 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Building2 className="w-10 h-10" />
            <h1 className="text-2xl lg:text-3xl font-bold">Reclamações de Ruas</h1>
          </div>
          <p className="text-primary-foreground/80">Sistema Municipal de Atendimento ao Cidadão</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 lg:py-12">
        <div className="text-center mb-8">
          <h2 className="text-xl lg:text-2xl font-semibold text-foreground mb-2">
            Selecione seu bairro
          </h2>
          <p className="text-muted-foreground">
            Para registrar ou acompanhar reclamações sobre problemas na sua rua
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md mx-auto mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar bairro ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12 h-14 text-lg rounded-xl border-2 border-border focus:border-primary"
          />
        </div>

        {/* Bairros List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Carregando bairros...</p>
            </div>
          ) : filteredBairros.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">
                {search ? "Nenhum bairro encontrado" : "Nenhum bairro cadastrado"}
              </p>
            </div>
          ) : (
            filteredBairros.map((bairro) => (
              <button
                key={bairro.id}
                onClick={() => handleSelectBairro(bairro)}
                className="w-full flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {bairro.nome}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {bairro.prefeitura?.cidade}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Sistema de Reclamações de Ruas</p>
      </footer>
    </div>
  );
};

export default Home;
