import { useEffect, useState } from "react";
import { Outlet, useNavigate, Link, useLocation, useParams } from "react-router-dom";
import { Building2, LayoutDashboard, FileText, MapPin, Tag, Settings, LogOut, Menu, X, Star, AlertTriangle, Users, Plug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Prefeitura {
  id: string;
  nome: string;
  cidade: string;
  logo_url: string | null;
}

const PainelLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { prefeituraId } = useParams();
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prefeitura, setPrefeitura] = useState<Prefeitura | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if user is super_admin or admin_prefeitura for this prefeitura
      const { data: role } = await supabase
        .from("user_roles")
        .select("role, prefeitura_id")
        .eq("user_id", session.user.id)
        .or(`role.eq.super_admin,and(role.eq.admin_prefeitura,prefeitura_id.eq.${prefeituraId})`)
        .maybeSingle();

      if (!role) {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para acessar esta área.",
          variant: "destructive"
        });
        navigate("/auth");
        return;
      }

      // Fetch prefeitura data
      const { data: prefData } = await supabase
        .from("prefeituras")
        .select("id, nome, cidade, logo_url")
        .eq("id", prefeituraId)
        .single();

      if (prefData) {
        setPrefeitura(prefData);
      }

      setLoading(false);
    };

    if (prefeituraId) {
      checkAuth();
    }
  }, [navigate, prefeituraId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const basePath = `/painel/${prefeituraId}`;
  
  const navItems = [
    { path: basePath, label: "Dashboard", icon: LayoutDashboard },
    { path: `${basePath}/reclamacoes`, label: "Reclamações", icon: FileText },
    { path: `${basePath}/avaliacoes`, label: "Avaliações", icon: Star },
    { path: `${basePath}/alertas`, label: "Central de Alertas", icon: AlertTriangle },
    { path: `${basePath}/cidadaos`, label: "Cidadãos", icon: Users },
    { path: `${basePath}/bairros`, label: "Bairros", icon: MapPin },
    { path: `${basePath}/categorias`, label: "Categorias", icon: Tag },
    { path: `${basePath}/integracoes`, label: "Integrações", icon: Plug },
    { path: `${basePath}/configuracoes`, label: "Configurações", icon: Settings },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-card rounded-lg shadow-md border border-border"
      >
        {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transform transition-transform lg:transform-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-3">
              {prefeitura?.logo_url ? (
                <img src={prefeitura.logo_url} alt="" className="w-10 h-10 object-contain" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-foreground truncate">{prefeitura?.cidade || "Painel"}</p>
                <p className="text-xs text-muted-foreground truncate">{prefeitura?.nome}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-border">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen">
        <div className="p-4 lg:p-8 pt-16 lg:pt-8">
          <Outlet context={{ prefeitura, prefeituraId }} />
        </div>
      </main>
    </div>
  );
};

export default PainelLayout;
