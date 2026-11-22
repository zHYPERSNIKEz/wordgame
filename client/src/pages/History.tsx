import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  LogOut,
  Play,
  Home,
  Eye,
  LayoutDashboard,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export function HistoryPage() {
  const [, navigate] = useLocation();
  const { user, loading, logout } = useAuth();
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  const historyQuery = trpc.game.getHistory.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  const sessionDetailsQuery = trpc.game.getSessionDetails.useQuery(
    { sessionId: selectedSessionId! },
    {
      enabled: selectedSessionId !== null && !!user,
      retry: false,
    }
  );

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [loading, user, navigate]);

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isStaff = user.role === "admin" || user.role === "moderator";

  const handleLogout = async () => {
    await logout();
    queryClient.clear();
    utils.auth.me.setData(undefined, null);
    await utils.invalidate();
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

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "Fácil";
      case "medium":
        return "Médio";
      case "hard":
        return "Difícil";
      default:
        return difficulty;
    }
  };

  const getDifficultyBadgeClass = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "bg-green-100 text-green-800 border-green-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "hard":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getOptionText = (
    ans: {
      option1: string | null;
      option2: string | null;
      option3: string | null;
      option4: string | null;
    },
    optNum: number | null
  ) => {
    switch (optNum) {
      case 1:
        return ans.option1 ?? "-";
      case 2:
        return ans.option2 ?? "-";
      case 3:
        return ans.option3 ?? "-";
      case 4:
        return ans.option4 ?? "-";
      default:
        return "-";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Histórico de Jogo</h1>
            <p className="text-gray-600">Seu desempenho e estatísticas</p>
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
            {isStaff && (
              <Button
                variant="outline"
                onClick={() => navigate("/admin")}
                className="flex items-center gap-2"
              >
                <LayoutDashboard className="h-4 w-4" />
                {user.role === "admin" ? "Admin" : "Painel"}
              </Button>
            )}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 items-center">
                  <div>
                    <p className="text-sm text-gray-600">Data</p>
                    <p className="font-medium text-gray-900">
                      {formatDate(session.startedAt)}
                    </p>
                    <Badge
                      variant="outline"
                      className={`mt-1 ${getDifficultyBadgeClass(session.difficulty)}`}
                    >
                      {getDifficultyLabel(session.difficulty)}
                    </Badge>
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
                  <div className="flex md:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedSessionId(session.id)}
                      className="flex items-center gap-1.5"
                    >
                      <Eye className="h-4 w-4" />
                      Ver Detalhes
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Session Details Dialog */}
        <Dialog
          open={selectedSessionId !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedSessionId(null);
          }}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes da Sessão</DialogTitle>
              <DialogDescription>
                {sessionDetailsQuery.data?.session
                  ? `Dificuldade: ${getDifficultyLabel(
                      sessionDetailsQuery.data.session.difficulty
                    )} • Pontuação: ${
                      sessionDetailsQuery.data.session.totalScore
                    } • Duração: ${formatDuration(
                      sessionDetailsQuery.data.session.durationSeconds
                    )}`
                  : "Resumo das respostas desta partida"}
              </DialogDescription>
            </DialogHeader>

            {sessionDetailsQuery.isLoading ? (
              <div className="py-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600" />
                <p className="text-sm text-gray-600 mt-2">Carregando respostas...</p>
              </div>
            ) : !sessionDetailsQuery.data ||
              sessionDetailsQuery.data.answers.length === 0 ? (
              <p className="text-sm text-gray-600 py-4 text-center">
                Nenhuma resposta registrada nesta sessão.
              </p>
            ) : (
              <div className="space-y-3 mt-2">
                {sessionDetailsQuery.data.answers.map((ans, index) => (
                  <div
                    key={ans.id}
                    className={`p-4 rounded-lg border ${
                      ans.isCorrect
                        ? "bg-green-50/60 border-green-200"
                        : "bg-red-50/60 border-red-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        {ans.isCorrect ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                        )}
                        <span className="font-semibold text-gray-900">
                          {index + 1}. {ans.word}
                        </span>
                      </div>
                      <Badge variant="secondary">
                        +{ans.pointsEarned} pts • {ans.timeSpentSeconds}s
                      </Badge>
                    </div>
                    {ans.question && (
                      <p className="text-sm text-gray-700 mb-2">{ans.question}</p>
                    )}
                    <div className="text-xs text-gray-600 space-y-0.5">
                      <p>
                        <span className="font-medium">Sua resposta:</span>{" "}
                        {getOptionText(ans, ans.userSelectedOption)}
                      </p>
                      {!ans.isCorrect && (
                        <p className="text-green-700">
                          <span className="font-medium">Resposta correta:</span>{" "}
                          {getOptionText(ans, ans.correctOption)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
