import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, LogOut, BarChart3, Home, LayoutDashboard } from "lucide-react";

type Difficulty = "easy" | "medium" | "hard";

interface GameState {
  sessionId: number | null;
  difficulty: Difficulty | null;
  isActive: boolean;
  word: string;
  question: string;
  questionType: string;
  options: [string, string, string, string];
  correctOption: number;
  selectedOption: number | null;
  score: number;
  correctAnswers: number;
  totalAnswers: number;
  timeStarted: number;
  isLoading: boolean;
}

export default function GamePage() {
  const [, navigate] = useLocation();
  const { user, loading, logout } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/login" });
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();
  const nextQuestionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEndingRef = useRef(false);

  const [gameState, setGameState] = useState<GameState>({
    sessionId: null,
    difficulty: null,
    isActive: false,
    word: "",
    question: "",
    questionType: "",
    options: ["", "", "", ""],
    correctOption: 0,
    selectedOption: null,
    score: 0,
    correctAnswers: 0,
    totalAnswers: 0,
    timeStarted: Date.now(),
    isLoading: false,
  });
  const [sessionTime, setSessionTime] = useState(0);
  const [showDifficultySelector, setShowDifficultySelector] = useState(false);

  const startSessionMutation = trpc.game.startSession.useMutation();
  const getQuestionMutation = trpc.game.getQuestion.useMutation();
  const submitAnswerMutation = trpc.game.submitAnswer.useMutation();
  const endSessionMutation = trpc.game.endSession.useMutation();

  const clearPendingNextQuestion = () => {
    if (nextQuestionTimeoutRef.current !== null) {
      clearTimeout(nextQuestionTimeoutRef.current);
      nextQuestionTimeoutRef.current = null;
    }
  };

  // Cleanup any pending question timer on unmount
  useEffect(() => {
    return () => {
      isEndingRef.current = true;
      clearPendingNextQuestion();
    };
  }, []);

  // Timer for session duration
  useEffect(() => {
    if (!gameState.isActive) return;

    const interval = setInterval(() => {
      setSessionTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.isActive]);

  const loadNextQuestion = async (sessionId: number) => {
    if (isEndingRef.current) return;
    setGameState((prev) => ({ ...prev, isLoading: true, selectedOption: null }));
    try {
      const questionData = await getQuestionMutation.mutateAsync({
        sessionId,
      });

      if (isEndingRef.current) return;

      setGameState((prev) => ({
        ...prev,
        word: questionData.word,
        question: questionData.question,
        questionType: questionData.questionType,
        options: questionData.options,
        correctOption: questionData.correctOption,
        selectedOption: null,
        timeStarted: Date.now(),
        isLoading: false,
      }));
    } catch (error) {
      if (!isEndingRef.current) {
        toast.error("Erro ao carregar questão");
      }
      setGameState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const startGame = async (difficulty: Difficulty) => {
    clearPendingNextQuestion();
    isEndingRef.current = false;
    setGameState((prev) => ({ ...prev, isLoading: true }));

    try {
      const session = await startSessionMutation.mutateAsync({ difficulty });
      setGameState({
        sessionId: session.sessionId,
        difficulty: session.difficulty as Difficulty,
        isActive: true,
        word: "",
        question: "",
        questionType: "",
        options: ["", "", "", ""],
        correctOption: 0,
        selectedOption: null,
        score: 0,
        correctAnswers: 0,
        totalAnswers: 0,
        timeStarted: Date.now(),
        isLoading: true,
      });
      setShowDifficultySelector(false);
      setSessionTime(0);

      await loadNextQuestion(session.sessionId);
    } catch (error) {
      toast.error("Erro ao iniciar sessão");
      setGameState((prev) => ({ ...prev, isLoading: false, isActive: false }));
    }
  };

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameState.sessionId || gameState.selectedOption === null || gameState.isLoading) {
      if (gameState.selectedOption === null) {
        toast.error("Selecione uma opção");
      }
      return;
    }

    const currentSessionId = gameState.sessionId;
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - gameState.timeStarted) / 1000));

    setGameState((prev) => ({ ...prev, isLoading: true }));
    try {
      const result = await submitAnswerMutation.mutateAsync({
        sessionId: currentSessionId,
        selectedOption: gameState.selectedOption,
        timeSpentSeconds: elapsedSeconds,
      });

      setGameState((prev) => ({
        ...prev,
        score: result.totalScore,
        correctAnswers: result.isCorrect ? prev.correctAnswers + 1 : prev.correctAnswers,
        totalAnswers: prev.totalAnswers + 1,
      }));

      if (result.isCorrect) {
        toast.success(`✓ Correto! +${result.pointsEarned} pontos`);
      } else {
        toast.error(`✗ Incorreto. A resposta correta era: ${gameState.options[gameState.correctOption - 1]}`);
      }

      clearPendingNextQuestion();
      nextQuestionTimeoutRef.current = setTimeout(() => {
        nextQuestionTimeoutRef.current = null;
        if (!isEndingRef.current) {
          void loadNextQuestion(currentSessionId);
        }
      }, 1200);
    } catch (error) {
      toast.error("Erro ao enviar resposta");
      setGameState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handleEndSession = async () => {
    if (!gameState.sessionId) return;

    isEndingRef.current = true;
    clearPendingNextQuestion();
    setGameState((prev) => ({ ...prev, isLoading: true }));
    try {
      await endSessionMutation.mutateAsync({
        sessionId: gameState.sessionId,
      });

      await Promise.all([
        utils.game.getHistory.invalidate(),
        utils.admin.getMetrics.invalidate(),
      ]);

      toast.success("Sessão finalizada!");
      navigate("/history");
    } catch (error) {
      isEndingRef.current = false;
      toast.error("Erro ao finalizar sessão");
    } finally {
      setGameState((prev) => ({ ...prev, isLoading: false, isActive: false }));
    }
  };

  const handleLogout = async () => {
    if (gameState.isActive) {
      if (!confirm("Tem certeza? Sua sessão será perdida.")) return;
      isEndingRef.current = true;
      clearPendingNextQuestion();
      if (gameState.sessionId) {
        try {
          await endSessionMutation.mutateAsync({ sessionId: gameState.sessionId });
        } catch {
          // Ignore end-session errors during logout
        }
      }
    } else {
      isEndingRef.current = true;
      clearPendingNextQuestion();
    }
    await logout();
    queryClient.clear();
    utils.auth.me.setData(undefined, null);
    await utils.invalidate();
    navigate("/login");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getDifficultyColor = (difficulty: Difficulty | null) => {
    switch (difficulty) {
      case "easy":
        return "text-green-600";
      case "medium":
        return "text-yellow-600";
      case "hard":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getDifficultyLabel = (difficulty: Difficulty | null) => {
    switch (difficulty) {
      case "easy":
        return "Fácil";
      case "medium":
        return "Médio";
      case "hard":
        return "Difícil";
      default:
        return "";
    }
  };


  
  if (loading) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Jogo de Palavras</h1>
            <p className="text-gray-600 truncate max-w-[250px] sm:max-w-none">Bem-vindo, {user.name}!</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2"
            >
              <Home className="h-4 w-4" />
              Início
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/history")}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Histórico
            </Button>
            {isStaff && (
              <Button
                variant="outline"
                onClick={() => navigate("/admin")}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2"
              >
                <LayoutDashboard className="h-4 w-4" />
                {user.role === "admin" ? "Admin" : "Painel"}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleLogout}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>

        {!gameState.isActive ? (
          // Start Screen or Difficulty Selector
          <Card className="p-8 text-center shadow-lg">
            {!showDifficultySelector ? (
              <>
                <h2 className="text-2xl font-bold mb-4 text-gray-900">
                  Pronto para jogar?
                </h2>
                <p className="text-gray-600 mb-6">
                  Responda questões sobre palavras em português e ganhe pontos!
                </p>
                <Button
                  onClick={() => setShowDifficultySelector(true)}
                  disabled={gameState.isLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2 text-lg"
                >
                  {gameState.isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Iniciando...
                    </>
                  ) : (
                    "Começar Jogo"
                  )}
                </Button>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-6 text-gray-900">
                  Escolha o Nível de Dificuldade
                </h2>
                <div className="space-y-4">
                  <Button
                    onClick={() => startGame("easy")}
                    disabled={gameState.isLoading}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg"
                  >
                    🟢 Fácil (10 pontos)
                  </Button>
                  <Button
                    onClick={() => startGame("medium")}
                    disabled={gameState.isLoading}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-3 text-lg"
                  >
                    🟡 Médio (20 pontos)
                  </Button>
                  <Button
                    onClick={() => startGame("hard")}
                    disabled={gameState.isLoading}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-3 text-lg"
                  >
                    🔴 Difícil (30 pontos)
                  </Button>
                  <Button
                    onClick={() => setShowDifficultySelector(false)}
                    variant="outline"
                    className="w-full mt-4"
                  >
                    Voltar
                  </Button>
                </div>
              </>
            )}
          </Card>
        ) : (
          // Game Screen
          <div className="space-y-6">
            {/* Stats Bar */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="p-4 text-center">
                <p className="text-gray-600 text-sm">Pontuação</p>
                <p className="text-2xl font-bold text-indigo-600">{gameState.score}</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-gray-600 text-sm">Corretas</p>
                <p className="text-2xl font-bold text-green-600">{gameState.correctAnswers}</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-gray-600 text-sm">Total</p>
                <p className="text-2xl font-bold text-blue-600">{gameState.totalAnswers}</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-gray-600 text-sm">Tempo</p>
                <p className="text-2xl font-bold text-purple-600">{formatTime(sessionTime)}</p>
              </Card>
            </div>

            {/* Game Card */}
            <Card className="p-8 shadow-lg">
              {gameState.isLoading && !gameState.word ? (
                <div className="py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-3" />
                  <p className="text-gray-600">Carregando questão...</p>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-gray-600 text-sm font-medium mb-2">PALAVRA:</p>
                        <p className="text-3xl font-bold text-indigo-600">{gameState.word}</p>
                      </div>
                      <div className={`text-right ${getDifficultyColor(gameState.difficulty)}`}>
                        <p className="text-xs font-semibold uppercase">Dificuldade</p>
                        <p className="text-lg font-bold">{getDifficultyLabel(gameState.difficulty)}</p>
                      </div>
                    </div>

                    <div className="bg-indigo-50 p-4 rounded-lg mb-6">
                      <p className="text-gray-600 text-sm font-medium mb-2">QUESTÃO:</p>
                      <p className="text-lg font-semibold text-gray-900">{gameState.question}</p>
                    </div>

                    <p className="text-gray-600 text-sm font-medium mb-2">TIPO:</p>
                    <p className="text-sm text-gray-700 mb-4">
                      {gameState.questionType === "syllables" && "Contagem de Sílabas"}
                      {gameState.questionType === "grammar" && "Classe Gramatical"}
                      {gameState.questionType === "meaning" && "Significado"}
                      {gameState.questionType === "accent" && "Acentuação"}
                      {gameState.questionType === "gender" && "Gênero e Número"}
                    </p>
                  </div>

                  <form onSubmit={handleSubmitAnswer} className="space-y-6">
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-gray-700">Escolha a resposta correta:</p>
                      <RadioGroup
                        value={gameState.selectedOption?.toString() || ""}
                        disabled={gameState.isLoading}
                        onValueChange={(value) => {
                          if (gameState.isLoading) return;
                          setGameState((prev) => ({
                            ...prev,
                            selectedOption: Number(value),
                          }));
                        }}
                      >
                        {gameState.options.map((option, index) => {
                          const optionValue = index + 1;
                          const isSelected = gameState.selectedOption === optionValue;
                          return (
                            <div
                              key={index}
                              onClick={() => {
                                if (gameState.isLoading) return;
                                setGameState((prev) => ({
                                  ...prev,
                                  selectedOption: optionValue,
                                }));
                              }}
                              className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                                gameState.isLoading
                                  ? "opacity-60 cursor-not-allowed border-gray-200"
                                  : isSelected
                                  ? "bg-indigo-50 border-indigo-400 cursor-pointer"
                                  : "hover:bg-gray-50 border-gray-200 cursor-pointer"
                              }`}
                            >
                              <RadioGroupItem
                                value={optionValue.toString()}
                                id={`option-${index}`}
                                disabled={gameState.isLoading}
                              />
                              <Label
                                htmlFor={`option-${index}`}
                                className={`flex-1 font-medium text-gray-900 ${
                                  gameState.isLoading ? "cursor-not-allowed" : "cursor-pointer"
                                }`}
                              >
                                {option}
                              </Label>
                            </div>
                          );
                        })}
                      </RadioGroup>
                    </div>

                    <div className="flex gap-4">
                      <Button
                        type="submit"
                        disabled={gameState.isLoading || gameState.selectedOption === null}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2"
                      >
                        {gameState.isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verificando...
                          </>
                        ) : (
                          "Responder"
                        )}
                      </Button>
                      <Button
                        type="button"
                        onClick={handleEndSession}
                        disabled={endSessionMutation.isPending}
                        variant="outline"
                        className="flex-1"
                      >
                        Finalizar Sessão
                      </Button>
                    </div>
                  </form>
                </>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
