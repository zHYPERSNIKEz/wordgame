import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Loader2,
  LogOut,
  Home,
  Play,
  History,
  GraduationCap,
  Users,
  Plus,
  Copy,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export function AdminDashboardPage() {
  const [, navigate] = useLocation();
  const { user, loading, logout } = useAuth();
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();

  const isStaff = !!user && (user.role === "admin" || user.role === "moderator");
  const isAdmin = !!user && user.role === "admin";

  const dashboardQuery = trpc.admin.getMetrics.useQuery(undefined, {
    enabled: isStaff,
    retry: false,
  });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login");
    } else if (!isStaff) {
      navigate("/game");
    }
  }, [loading, user, isStaff, navigate]);

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user || !isStaff) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    queryClient.clear();
    utils.auth.me.setData(undefined, null);
    await utils.invalidate();
    navigate("/login");
  };

  const data = dashboardQuery.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-gray-900">
                {isAdmin ? "Dashboard Administrativo" : "Painel do Professor"}
              </h1>
              <Badge
                variant="secondary"
                className={
                  isAdmin
                    ? "bg-purple-100 text-purple-800"
                    : "bg-green-100 text-green-800"
                }
              >
                {isAdmin ? "Administrador" : "Professor (Moderador)"}
              </Badge>
            </div>
            <p className="text-gray-600">
              Análise de uso, desempenho e gestão de turmas
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Início
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/game")}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Jogar
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/history")}
              className="flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              Histórico
            </Button>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>

        {/* Teacher Class Management (visible to moderator & admin) */}
        <TeacherClassesSection isStaff={isStaff} />

        {dashboardQuery.isLoading ? (
          <Card className="p-8 text-center mt-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
            <p className="text-gray-600 mt-2">Carregando métricas...</p>
          </Card>
        ) : !data ? (
          <Card className="p-8 text-center mt-8">
            <p className="text-gray-600">Nenhum dado disponível</p>
          </Card>
        ) : (
          <div className="space-y-8 mt-8">
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
                            {school.avgDuration != null
                              ? `${Math.round(Number(school.avgDuration))}s`
                              : "N/A"}
                          </td>
                          <td className="py-2 px-4 text-center text-gray-600">
                            {school.avgAccuracy != null
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
                            {score.avgScore != null
                              ? Number(score.avgScore).toFixed(0)
                              : "0"}
                          </td>
                          <td className="py-2 px-4 text-center text-green-600">
                            {score.maxScore ?? 0}
                          </td>
                          <td className="py-2 px-4 text-center text-red-600">
                            {score.minScore ?? 0}
                          </td>
                          <td className="py-2 px-4 text-center text-gray-600">
                            {score.avgAccuracy != null
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

            {/* Gerenciamento de Usuários (Somente Admin) */}
            {isAdmin && <UsersManagementSection />}
          </div>
        )}
      </div>
    </div>
  );
}

function TeacherClassesSection({ isStaff }: { isStaff: boolean }) {
  const utils = trpc.useUtils();
  const [className, setClassName] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);

  const myClassesQuery = trpc.teacher.getMyClasses.useQuery(undefined, {
    enabled: isStaff,
    retry: false,
  });

  const classStudentsQuery = trpc.teacher.getClassStudents.useQuery(
    { classId: selectedClassId! },
    {
      enabled: isStaff && selectedClassId !== null,
      retry: false,
    }
  );

  const createClassMutation = trpc.teacher.createClass.useMutation({
    onSuccess: async (result) => {
      setClassName("");
      setSelectedClassId(result.classId);
      await utils.teacher.getMyClasses.invalidate();
      toast.success(`Turma criada! Código de convite: ${result.inviteCode}`);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar turma");
    },
  });

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = className.trim();
    if (trimmed.length < 2) {
      toast.error("Informe um nome com pelo menos 2 caracteres.");
      return;
    }
    try {
      await createClassMutation.mutateAsync({ name: trimmed });
    } catch {
      // Error toast is handled by createClassMutation.onError
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard?.writeText(code);
      toast.success(`Código ${code} copiado!`);
    } catch {
      toast.info(`Código da turma: ${code}`);
    }
  };

  const classesList = myClassesQuery.data ?? [];
  const selectedClass = classesList.find((c) => c.id === selectedClassId) ?? null;

  return (
    <Card className="p-6 border-t-4 border-green-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-green-600" />
            Turmas / Professor
          </h2>
          <p className="text-sm text-gray-600">
            Crie turmas, compartilhe o código de convite e acompanhe os alunos matriculados.
          </p>
        </div>
      </div>

      {/* Create Class Form */}
      <form onSubmit={handleCreateClass} className="flex flex-col sm:flex-row gap-3 mb-6">
        <Input
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          placeholder="Nome da nova turma (ex: Português 7º Ano B)"
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={createClassMutation.isPending}
          className="bg-green-600 hover:bg-green-700 text-white shrink-0"
        >
          {createClassMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Criando...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Criar Turma
            </>
          )}
        </Button>
      </form>

      {/* Classes List */}
      {myClassesQuery.isLoading ? (
        <div className="py-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-green-600" />
        </div>
      ) : classesList.length === 0 ? (
        <p className="text-sm text-gray-600 py-4 text-center bg-gray-50 rounded-lg">
          Você ainda não possui turmas cadastradas. Crie sua primeira turma acima.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {classesList.map((cls) => {
            const isSelected = selectedClassId === cls.id;
            return (
              <div
                key={cls.id}
                className={`p-4 rounded-lg border transition-colors ${
                  isSelected
                    ? "border-green-500 bg-green-50/50"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{cls.name}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-gray-500">Código:</span>
                      <Badge variant="outline" className="font-mono bg-white">
                        {cls.inviteCode}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(cls.inviteCode)}
                        className="text-gray-500 hover:text-gray-800"
                        title="Copiar código"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() =>
                      setSelectedClassId(isSelected ? null : cls.id)
                    }
                  >
                    <Users className="h-4 w-4 mr-1.5" />
                    {isSelected ? "Ocultar Alunos" : "Ver Alunos"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Class Student Roster */}
      {selectedClassId !== null && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Alunos da Turma{selectedClass ? `: ${selectedClass.name}` : ""}
          </h3>
          {classStudentsQuery.isLoading ? (
            <div className="py-4 text-center">
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-indigo-600" />
            </div>
          ) : !classStudentsQuery.data || classStudentsQuery.data.length === 0 ? (
            <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
              Nenhum aluno matriculado nesta turma ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">
                      Nome
                    </th>
                    <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">
                      Email
                    </th>
                    <th className="text-center py-2 px-4 text-sm font-semibold text-gray-700">
                      Idade
                    </th>
                    <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">
                      Escola
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {classStudentsQuery.data.map((student) => (
                    <tr key={student.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-4 text-gray-900 font-medium">
                        {student.name || "Sem Nome"}
                      </td>
                      <td className="py-2 px-4 text-gray-600">
                        {student.email || "-"}
                      </td>
                      <td className="py-2 px-4 text-center text-gray-600">
                        {student.age ?? "-"}
                      </td>
                      <td className="py-2 px-4 text-gray-600">
                        {student.school || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function UsersManagementSection() {
  const utils = trpc.useUtils();
  const usersQuery = trpc.admin.getAllUsers.useQuery(undefined, {
    retry: false,
  });
  const promoteMutation = trpc.admin.promoteToModerator.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.getAllUsers.invalidate(),
        utils.admin.getMetrics.invalidate(),
      ]);
      toast.success("Usuário promovido a Professor com sucesso!");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao promover usuário");
    },
  });

  if (usersQuery.isLoading) return <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600" /></div>;
  if (!usersQuery.data) return null;

  return (
    <Card className="p-6 mt-8 border-t-4 border-indigo-500">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Gerenciar Professores e Usuários
      </h2>
      <p className="text-sm text-gray-600 mb-6">Lista de usuários cadastrados. Promova contas a "Professor" (Moderador) para que eles possam criar turmas.</p>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Nome</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Email / ID</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Escola</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700">Role Atual</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody>
            {usersQuery.data.map((u) => (
              <tr key={u.id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 text-gray-900 font-medium">{u.name || "Sem Nome"}</td>
                <td className="py-3 px-4 text-gray-600">{u.email || u.openId}</td>
                <td className="py-3 px-4 text-gray-600">{u.school || "-"}</td>
                <td className="py-3 px-4 text-center">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                    u.role === 'moderator' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {u.role === 'moderator' ? 'Professor' : u.role}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  {u.role === 'user' && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                      onClick={() => {
                        if (confirm(`Deseja promover ${u.name} a Professor?`)) {
                          promoteMutation.mutate({ userId: u.id });
                        }
                      }}
                      disabled={promoteMutation.isPending}
                    >
                      Promover a Professor
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
