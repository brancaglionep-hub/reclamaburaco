import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Building2, Phone, Mail, AlertTriangle, ArrowRight, Clock, MapPin, Shield, CircleDot, Construction, Droplets, AlertCircle, Car } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ComplaintForm from "@/components/ComplaintForm";
import ConsultaProtocolo from "@/components/ConsultaProtocolo";
import heroImage from "@/assets/hero-street.png";

interface Prefeitura {
  id: string;
  nome: string;
  cidade: string;
  slug: string;
  estado: string;
  logo_url: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  texto_institucional: string | null;
  email_contato: string | null;
  telefone_contato: string | null;
}

const problemTypes = [
  { icon: CircleDot, label: "Buracos", color: "bg-gray-100" },
  { icon: Construction, label: "Rua danificada", color: "bg-orange-50" },
  { icon: Droplets, label: "Alagamento", color: "bg-blue-50" },
  { icon: AlertCircle, label: "Desnível", color: "bg-yellow-50" },
  { icon: Car, label: "Tráfego difícil", color: "bg-red-50" },
];

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!prefeitura) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-white">
        <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Cidade não encontrada</h1>
        <p className="text-gray-500">Verifique o endereço e tente novamente.</p>
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
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {prefeitura.logo_url ? (
              <img src={prefeitura.logo_url} alt={prefeitura.nome} className="w-10 h-10 object-contain" />
            ) : (
              <Building2 className="w-8 h-8" />
            )}
            <div>
              <p className="font-semibold">{prefeitura.nome}</p>
              <p className="text-xs text-white/70">{prefeitura.estado || "Santa Catarina"}</p>
            </div>
          </div>
          {prefeitura.telefone_contato && (
            <a href={`tel:${prefeitura.telefone_contato}`} className="hidden sm:flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4" />
              {prefeitura.telefone_contato}
            </a>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-6xl mx-auto px-4 py-12 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium mb-6">
                Serviço Municipal
              </span>
              <h1 className="text-3xl lg:text-5xl font-bold text-gray-900 mb-4">
                Reclamações de Ruas
              </h1>
              <p className="text-xl text-gray-600 mb-2">
                Encontrou um problema na sua rua?
              </p>
              <p className="text-gray-500 mb-8">
                Avise a {prefeitura.nome} de forma rápida e fácil. Sua participação ajuda a melhorar nossa cidade.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
                >
                  Informar problema na rua
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowConsulta(true)}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-gray-700 font-semibold rounded-xl border-2 border-gray-200 hover:border-primary hover:text-primary transition-colors"
                >
                  Consultar protocolo
                </button>
              </div>

              {/* Features */}
              <div className="flex flex-wrap gap-8 mt-10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-gray-600">Rápido e fácil</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-gray-600">Com localização</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-gray-600">Dados protegidos</span>
                </div>
              </div>
            </div>

            {/* Hero Image */}
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent rounded-3xl" />
              <img
                src={heroImage}
                alt="Trabalhadores consertando rua"
                className="w-full h-auto rounded-3xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Problem Types */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">
            Tipos de problemas que você pode informar
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {problemTypes.map((type, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-6 py-3 ${type.color} rounded-full border border-gray-200`}
              >
                <type.icon className="w-5 h-5 text-gray-700" />
                <span className="font-medium text-gray-700">{type.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
              <p className="text-4xl font-bold text-primary mb-2">24h</p>
              <p className="text-gray-500">Tempo médio de resposta</p>
            </div>
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
              <p className="text-4xl font-bold text-primary mb-2">100%</p>
              <p className="text-gray-500">Reclamações analisadas</p>
            </div>
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
              <p className="text-4xl font-bold text-primary mb-2">Grátis</p>
              <p className="text-gray-500">Serviço para o cidadão</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-[#1e3a5f] text-white py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <p className="font-semibold">{prefeitura.nome}</p>
              <p className="text-sm text-white/70">Trabalhando por uma cidade melhor</p>
            </div>
            <div className="text-center md:text-right text-sm text-white/70">
              <p>Seus dados são protegidos conforme a LGPD</p>
              <p>© {new Date().getFullYear()} {prefeitura.nome} - Todos os direitos reservados</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CityPage;
