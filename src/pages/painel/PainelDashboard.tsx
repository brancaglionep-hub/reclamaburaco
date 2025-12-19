import { useOutletContext } from "react-router-dom";
import { FileText, Clock, CheckCircle2, AlertCircle, TrendingUp, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { useQuery } from "@tanstack/react-query";

interface OutletContext {
  prefeitura: { id: string; nome: string; cidade: string } | null;
  prefeituraId: string;
}

const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#6b7280"];

const PainelDashboard = () => {
  const { prefeituraId } = useOutletContext<OutletContext>();

  // Fetch all stats in a single optimized query
  const { data, isLoading } = useQuery({
    queryKey: ["painel-dashboard", prefeituraId],
    queryFn: async () => {
      // Run all count queries in parallel
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [
        totalRes,
        recebidasRes,
        emAndamentoRes,
        resolvidasRes,
        doMesRes,
        reclamacoesRes,
        bairrosRes,
        categoriasRes,
        visitasRes
      ] = await Promise.all([
        supabase.from("reclamacoes").select("*", { count: "exact", head: true }).eq("prefeitura_id", prefeituraId),
        supabase.from("reclamacoes").select("*", { count: "exact", head: true }).eq("prefeitura_id", prefeituraId).eq("status", "recebida"),
        supabase.from("reclamacoes").select("*", { count: "exact", head: true }).eq("prefeitura_id", prefeituraId).eq("status", "em_andamento"),
        supabase.from("reclamacoes").select("*", { count: "exact", head: true }).eq("prefeitura_id", prefeituraId).eq("status", "resolvida"),
        supabase.from("reclamacoes").select("*", { count: "exact", head: true }).eq("prefeitura_id", prefeituraId).gte("created_at", startOfMonth.toISOString()),
        supabase.from("reclamacoes").select("bairro_id, categoria_id, created_at").eq("prefeitura_id", prefeituraId),
        supabase.from("bairros").select("id, nome").eq("prefeitura_id", prefeituraId),
        supabase.from("categorias").select("id, nome").or(`prefeitura_id.eq.${prefeituraId},global.eq.true`),
        supabase.from("visitas").select("created_at").eq("prefeitura_id", prefeituraId).gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      ]);

      // Process stats
      const stats = {
        total: totalRes.count || 0,
        recebidas: recebidasRes.count || 0,
        emAndamento: emAndamentoRes.count || 0,
        resolvidas: resolvidasRes.count || 0,
        doMes: doMesRes.count || 0
      };

      const statusStats = [
        { name: "Recebidas", value: stats.recebidas },
        { name: "Em andamento", value: stats.emAndamento },
        { name: "Resolvidas", value: stats.resolvidas }
      ];

      // Process bairro stats from reclamacoes data
      const reclamacoes = reclamacoesRes.data || [];
      const bairros = bairrosRes.data || [];
      
      const bairroCountMap = new Map<string, number>();
      reclamacoes.forEach(r => {
        if (r.bairro_id) {
          bairroCountMap.set(r.bairro_id, (bairroCountMap.get(r.bairro_id) || 0) + 1);
        }
      });
      
      const bairroStats = bairros
        .map(b => ({ nome: b.nome, total: bairroCountMap.get(b.id) || 0 }))
        .filter(r => r.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      // Process categoria stats
      const categorias = categoriasRes.data || [];
      const categoriaCountMap = new Map<string, number>();
      reclamacoes.forEach(r => {
        if (r.categoria_id) {
          categoriaCountMap.set(r.categoria_id, (categoriaCountMap.get(r.categoria_id) || 0) + 1);
        }
      });
      
      const categoriaStats = categorias
        .map(c => ({ nome: c.nome, total: categoriaCountMap.get(c.id) || 0 }))
        .filter(r => r.total > 0)
        .sort((a, b) => b.total - a.total);

      // Process visitas stats - group by day
      const visitas = visitasRes.data || [];
      const visitasByDay = new Map<string, number>();
      
      // Initialize last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        visitasByDay.set(dateKey, 0);
      }
      
      visitas.forEach(v => {
        const dateKey = v.created_at.split('T')[0];
        if (visitasByDay.has(dateKey)) {
          visitasByDay.set(dateKey, (visitasByDay.get(dateKey) || 0) + 1);
        }
      });

      const visitasStats = Array.from(visitasByDay.entries()).map(([dateStr, count]) => ({
        date: new Date(dateStr).toLocaleDateString("pt-BR", { weekday: "short" }),
        visitas: count
      }));

      return { stats, statusStats, bairroStats, categoriaStats, visitasStats };
    },
    enabled: !!prefeituraId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { stats, statusStats, bairroStats, categoriaStats, visitasStats } = data || {
    stats: { total: 0, recebidas: 0, emAndamento: 0, resolvidas: 0, doMes: 0 },
    statusStats: [],
    bairroStats: [],
    categoriaStats: [],
    visitasStats: []
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral das reclamações</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recebidas</CardTitle>
            <Clock className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{stats.recebidas}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Andamento</CardTitle>
            <AlertCircle className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{stats.emAndamento}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolvidas</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats.resolvidas}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Este Mês</CardTitle>
            <TrendingUp className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.doMes}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Bairros com mais reclamações</CardTitle>
          </CardHeader>
          <CardContent>
            {bairroStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={bairroStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="nome" width={100} />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhuma reclamação registrada
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reclamações por tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {categoriaStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoriaStats}
                    dataKey="total"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ nome }) => nome}
                  >
                    {categoriaStats.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhuma reclamação registrada
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Reclamações por status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusStats}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {statusStats.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Visitas no site (últimos 7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={visitasStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="visitas" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PainelDashboard;