import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import CityPage from "./pages/CityPage";
import Auth from "./pages/Auth";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminPrefeituras from "./pages/admin/AdminPrefeituras";
import AdminUsuarios from "./pages/admin/AdminUsuarios";
import PainelLayout from "./components/painel/PainelLayout";
import PainelDashboard from "./pages/painel/PainelDashboard";
import PainelReclamacoes from "./pages/painel/PainelReclamacoes";
import PainelReclamacaoDetalhe from "./pages/painel/PainelReclamacaoDetalhe";
import PainelBairros from "./pages/painel/PainelBairros";
import PainelCategorias from "./pages/painel/PainelCategorias";
import PainelConfiguracoes from "./pages/painel/PainelConfiguracoes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          
          {/* Super Admin Routes - MUST come before /:slug */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="prefeituras" element={<AdminPrefeituras />} />
            <Route path="usuarios" element={<AdminUsuarios />} />
          </Route>
          
          {/* Painel Prefeitura Routes */}
          <Route path="/painel/:prefeituraId" element={<PainelLayout />}>
            <Route index element={<PainelDashboard />} />
            <Route path="reclamacoes" element={<PainelReclamacoes />} />
            <Route path="reclamacoes/:id" element={<PainelReclamacaoDetalhe />} />
            <Route path="bairros" element={<PainelBairros />} />
            <Route path="categorias" element={<PainelCategorias />} />
            <Route path="configuracoes" element={<PainelConfiguracoes />} />
          </Route>
          
          {/* City page - must be LAST among dynamic routes */}
          <Route path="/:slug" element={<CityPage />} />
          
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
