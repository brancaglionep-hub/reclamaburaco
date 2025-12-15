import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Building2, ChevronRight, Map } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

interface Prefeitura {
  id: string;
  nome: string;
  cidade: string;
  slug: string;
  logo_url: string | null;
}

const Home = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [prefeituras, setPrefeituras] = useState<Prefeitura[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrefeituras = async () => {
      const { data, error } = await supabase
        .from("prefeituras")
        .select("id, nome, cidade, slug, logo_url")
        .eq("ativo", true)
        .order("cidade");

      if (!error && data) {
        setPrefeituras(data);
      }
      setLoading(false);
    };

    fetchPrefeituras();
  }, []);

  const filteredPrefeituras = prefeituras.filter(p => 
    p.cidade.toLowerCase().includes(search.toLowerCase()) ||
    p.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Reclamações de Ruas</h1>
            <p className="text-xs text-gray-500">Sistema Municipal</p>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 py-12 lg:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
            Serviço Público
          </span>
          <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 mb-4">
            Selecione sua cidade
          </h2>
          <p className="text-lg text-gray-600">
            Escolha sua cidade para registrar ou acompanhar reclamações sobre problemas nas ruas
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-xl mx-auto mb-10">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Buscar cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12 h-14 text-lg rounded-2xl border-2 border-gray-200 focus:border-primary shadow-sm"
          />
        </div>

        {/* Cities Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {loading ? (
            <div className="col-span-full text-center py-16">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Carregando cidades...</p>
            </div>
          ) : filteredPrefeituras.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <Map className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                {search ? "Nenhuma cidade encontrada" : "Nenhuma cidade cadastrada"}
              </p>
            </div>
          ) : (
            filteredPrefeituras.map((prefeitura) => (
              <button
                key={prefeitura.id}
                onClick={() => navigate(`/${prefeitura.slug}`)}
                className="group relative bg-white rounded-2xl border-2 border-gray-100 p-6 text-left hover:border-primary hover:shadow-lg transition-all duration-300 overflow-hidden"
              >
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-bl-full -mr-8 -mt-8 group-hover:from-primary/10 transition-colors" />
                
                <div className="relative flex items-center gap-4">
                  {prefeitura.logo_url ? (
                    <img 
                      src={prefeitura.logo_url} 
                      alt={prefeitura.cidade} 
                      className="w-14 h-14 object-contain rounded-xl"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shrink-0">
                      <MapPin className="w-7 h-7 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-lg group-hover:text-primary transition-colors truncate">
                      {prefeitura.cidade}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">
                      {prefeitura.nome}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      {/* Features */}
      <section className="bg-white border-t border-gray-100 py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Rápido e fácil</h3>
              <p className="text-gray-500 text-sm">Registre sua reclamação em poucos minutos</p>
            </div>
            <div>
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Com localização</h3>
              <p className="text-gray-500 text-sm">Use GPS para marcar o local exato</p>
            </div>
            <div>
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Dados protegidos</h3>
              <p className="text-gray-500 text-sm">Suas informações estão seguras</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} Sistema de Reclamações de Ruas
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Seus dados são protegidos conforme a LGPD
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
