import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, LogOut, Play, BarChart3 } from "lucide-react";

export function HistoryPage() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const historyQuery = trpc.game.getHistory.useQuery(undefined, {
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const sessions = historyQuery.data || [];
  const totalSessions = sessions.length;
  const totalScore = sessions.reduce((sum, s) => sum + s.totalScore, 0);
  const totalAnswers = sessions.reduce((sum, s) => sum + s.totalAnswers, 0);
  const totalCorrect = sessions.reduce((sum, s) => sum + s.correctAnswers, 0);
  const accuracy = totalAnswers > 0 ? ((totalCorrect / totalAnswers) * 100).toFixed(1) : "0";

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Histórico de Jogo</h1>
            <p className="text-gray-600">Seu desempenho e estatísticas</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => navigate("/game")}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Play className="h-4 w-4" />
              Jogar Novamente
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

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4 text-center">
            <p className="text-gray-600 text-sm">Sessões</p>
            <p className="text-3xl font-bold text-indigo-600">{totalSessions}</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-gray-600 text-sm">Pontuação Total</p>
            <p className="text-3xl font-bold text-blue-600">{totalScore}</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-gray-600 text-sm">Acurácia</p>
            <p className="text-3xl font-bold text-green-600">{accuracy}%</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-gray-600 text-sm">Respostas</p>
            <p className="text-3xl font-bold text-purple-600">{totalAnswers}</p>
          </Card>
        </div>

        {/* Sessions List */}
        {historyQuery.isLoading ? (
          <Card className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
            <p className="text-gray-600 mt-2">Carregando histórico...</p>
          </Card>
        ) : sessions.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-600 mb-4">Você ainda não jogou nenhuma sessão.</p>
            <Button
              onClick={() => navigate("/game")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Começar Jogo
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <Card key={session.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                  <div>
                    <p className="text-sm text-gray-600">Data</p>
                    <p className="font-medium text-gray-900">
                      {formatDate(session.startedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Duração</p>
                    <p className="font-medium text-gray-900">
                      {formatDuration(session.durationSeconds)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Acertos</p>
                    <p className="font-medium text-green-600">
                      {session.correctAnswers}/{session.totalAnswers}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Pontuação</p>
                    <p className="font-medium text-indigo-600 text-lg">
                      {session.totalScore}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Acurácia</p>
                    <p className="font-medium text-blue-600">
                      {session.totalAnswers > 0
                        ? ((session.correctAnswers / session.totalAnswers) * 100).toFixed(0)
                        : "0"}
                      %
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
