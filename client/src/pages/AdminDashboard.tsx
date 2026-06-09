import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, LogOut, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

export function AdminDashboardPage() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const dashboardQuery = trpc.admin.getMetrics.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });

  useEffect(() => {
    if (!user) {
      navigate("/login");
    } else if (user.role !== "admin") {
      navigate("/game");
    }
  }, [user, navigate]);

  if (!user || user.role !== "admin") {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const data = dashboardQuery.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard Administrativo</h1>
            <p className="text-gray-600">Análise de uso e desempenho</p>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>

        {dashboardQuery.isLoading ? (
          <Card className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
            <p className="text-gray-600 mt-2">Carregando dados...</p>
          </Card>
        ) : !data ? (
          <Card className="p-8 text-center">
            <p className="text-gray-600">Nenhum dado disponível</p>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Age Group Metrics */}
            <Card className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Atividade por Faixa Etária
              </h2>
              {data.ageGroupMetrics && Array.isArray(data.ageGroupMetrics) && data.ageGroupMetrics.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.ageGroupMetrics as any}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ageGroup" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="userCount" fill="#8b5cf6" name="Usuários" />
                    <Bar dataKey="sessionCount" fill="#3b82f6" name="Sessões" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-600">Sem dados disponíveis</p>
              )}
            </Card>

            {/* School Metrics */}
            <Card className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Escolas Mais Ativas
              </h2>
              {data.schoolMetrics && Array.isArray(data.schoolMetrics) && data.schoolMetrics.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4 text-gray-600">Escola</th>
                        <th className="text-center py-2 px-4 text-gray-600">Usuários</th>
                        <th className="text-center py-2 px-4 text-gray-600">Sessões</th>
                        <th className="text-center py-2 px-4 text-gray-600">Duração Média</th>
                        <th className="text-center py-2 px-4 text-gray-600">Acurácia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.schoolMetrics as any[]).map((school: any, idx: number) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-4 text-gray-900">{school.school || "N/A"}</td>
                          <td className="py-2 px-4 text-center text-gray-600">
                            {school.userCount}
                          </td>
                          <td className="py-2 px-4 text-center text-gray-600">
                            {school.sessionCount}
                          </td>
                          <td className="py-2 px-4 text-center text-gray-600">
                            {school.avgDuration
                              ? `${Math.round(school.avgDuration)}s`
                              : "N/A"}
                          </td>
                          <td className="py-2 px-4 text-center text-gray-600">
                            {school.avgAccuracy
                              ? `${Number(school.avgAccuracy).toFixed(1)}%`
                              : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-600">Sem dados disponíveis</p>
              )}
            </Card>

            {/* Score Performance by Age */}
            <Card className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Desempenho de Pontuação por Faixa Etária
              </h2>
              {data.scorePerformance && Array.isArray(data.scorePerformance) && data.scorePerformance.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4 text-gray-600">Faixa Etária</th>
                        <th className="text-center py-2 px-4 text-gray-600">Usuários</th>
                        <th className="text-center py-2 px-4 text-gray-600">Pontuação Média</th>
                        <th className="text-center py-2 px-4 text-gray-600">Máxima</th>
                        <th className="text-center py-2 px-4 text-gray-600">Mínima</th>
                        <th className="text-center py-2 px-4 text-gray-600">Acurácia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.scorePerformance as any[]).map((score: any, idx: number) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-4 text-gray-900">{score.ageGroup}</td>
                          <td className="py-2 px-4 text-center text-gray-600">
                            {score.userCount}
                          </td>
                          <td className="py-2 px-4 text-center text-indigo-600 font-medium">
                            {score.avgScore
                              ? Number(score.avgScore).toFixed(0)
                              : "0"}
                          </td>
                          <td className="py-2 px-4 text-center text-green-600">
                            {score.maxScore || "0"}
                          </td>
                          <td className="py-2 px-4 text-center text-red-600">
                            {score.minScore || "0"}
                          </td>
                          <td className="py-2 px-4 text-center text-gray-600">
                            {score.avgAccuracy
                              ? `${Number(score.avgAccuracy).toFixed(1)}%`
                              : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-600">Sem dados disponíveis</p>
              )}
            </Card>

            {/* Last Updated */}
            <div className="text-center text-gray-600 text-sm">
              Última atualização:{" "}
              {new Date().toLocaleString("pt-BR")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
