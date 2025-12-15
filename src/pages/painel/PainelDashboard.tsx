import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { FileText, Clock, CheckCircle2, AlertCircle, TrendingUp, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

interface OutletContext {
  prefeitura: { id: string; nome: string; cidade: string } | null;
  prefeituraId: string;
}

interface Stats {
  total: number;
  recebidas: number;
  emAndamento: number;
  resolvidas: number;
  doMes: number;
}

const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#6b7280"];

const PainelDashboard = () => {
  const { prefeituraId } = useOutletContext<OutletContext>();
  const [stats, setStats] = useState<Stats>({ total: 0, recebidas: 0, emAndamento: 0, resolvidas: 0, doMes: 0 });
  const [bairroStats, setBairroStats] = useState<{ nome: string; total: number }[]>([]);
  const [categoriaStats, setCategoriaStats] = useState<{ nome: string; total: number }[]>([]);
  const [statusStats, setStatusStats] = useState<{ name: string; value: number }[]>([]);
  const [visitasStats, setVisitasStats] = useState<{ date: string; visitas: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      // Total
      const { count: total } = await supabase
        .from("reclamacoes")
        .select("*", { count: "exact", head: true })
        .eq("prefeitura_id", prefeituraId);

      // Recebidas
      const { count: recebidas } = await supabase
        .from("reclamacoes")
        .select("*", { count: "exact", head: true })
        .eq("prefeitura_id", prefeituraId)
        .eq("status", "recebida");

      // Em andamento
      const { count: emAndamento } = await supabase
        .from("reclamacoes")
        .select("*", { count: "exact", head: true })
        .eq("prefeitura_id", prefeituraId)
        .eq("status", "em_andamento");

      // Resolvidas
      const { count: resolvidas } = await supabase
        .from("reclamacoes")
        .select("*", { count: "exact", head: true })
        .eq("prefeitura_id", prefeituraId)
        .eq("status", "resolvida");

      // Do mês
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { count: doMes } = await supabase
        .from("reclamacoes")
        .select("*", { count: "exact", head: true })
        .eq("prefeitura_id", prefeituraId)
        .gte("created_at", startOfMonth.toISOString());

      setStats({
        total: total || 0,
        recebidas: recebidas || 0,
        emAndamento: emAndamento || 0,
        resolvidas: resolvidas || 0,
        doMes: doMes || 0
      });

      setStatusStats([
        { name: "Recebidas", value: recebidas || 0 },
        { name: "Em andamento", value: emAndamento || 0 },
        { name: "Resolvidas", value: resolvidas || 0 }
      ]);

      // Bairros com mais reclamações
      const { data: bairros } = await supabase
        .from("bairros")
        .select("id, nome")
        .eq("prefeitura_id", prefeituraId);

      if (bairros) {
        const bairroPromises = bairros.map(async (b) => {
          const { count } = await supabase
            .from("reclamacoes")
            .select("*", { count: "exact", head: true })
            .eq("bairro_id", b.id);
          return { nome: b.nome, total: count || 0 };
        });
        const results = await Promise.all(bairroPromises);
        setBairroStats(results.filter(r => r.total > 0).sort((a, b) => b.total - a.total).slice(0, 10));
      }

      // Categorias
      const { data: categorias } = await supabase
        .from("categorias")
        .select("id, nome")
        .or(`prefeitura_id.eq.${prefeituraId},global.eq.true`);

      if (categorias) {
        const catPromises = categorias.map(async (c) => {
          const { count } = await supabase
            .from("reclamacoes")
            .select("*", { count: "exact", head: true })
            .eq("prefeitura_id", prefeituraId)
            .eq("categoria_id", c.id);
          return { nome: c.nome, total: count || 0 };
        });
        const results = await Promise.all(catPromises);
        setCategoriaStats(results.filter(r => r.total > 0).sort((a, b) => b.total - a.total));
      }

      // Visitas nos últimos 7 dias
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const { count } = await supabase
          .from("visitas")
          .select("*", { count: "exact", head: true })
          .eq("prefeitura_id", prefeituraId)
          .gte("created_at", date.toISOString())
          .lt("created_at", nextDate.toISOString());

        last7Days.push({
          date: date.toLocaleDateString("pt-BR", { weekday: "short" }),
          visitas: count || 0
        });
      }
      setVisitasStats(last7Days);

      setLoading(false);
    };

    if (prefeituraId) {
      fetchStats();
    }
  }, [prefeituraId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
