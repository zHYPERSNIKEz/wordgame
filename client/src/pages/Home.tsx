import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { BookOpen, Target, Trophy, Users, Zap, BarChart3 } from "lucide-react";

export default function Home() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-indigo-600" />
            <span className="text-2xl font-bold text-gray-900">WordGame</span>
          </div>
          <div className="flex gap-2">
            {isAuthenticated ? (
              <>
                <Button
                  onClick={() => navigate("/game")}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Jogar
                </Button>
                {user?.role === "admin" && (
                  <Button
                    onClick={() => navigate("/admin")}
                    variant="outline"
                  >
                    Dashboard
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  onClick={() => navigate("/login")}
                  variant="outline"
                >
                  Login
                </Button>
                <Button
                  onClick={() => navigate("/register")}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Cadastro
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Aprenda Palavras em Português
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Um jogo educativo interativo que torna o aprendizado de vocabulário divertido e envolvente. Adivinhe palavras, ganhe pontos e acompanhe seu progresso.
          </p>
          {!isAuthenticated && (
            <Button
              onClick={() => navigate("/register")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 text-lg"
            >
              Começar Agora
            </Button>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <Card className="p-8 text-center hover:shadow-lg transition-shadow">
            <Target className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Desafios Diários</h3>
            <p className="text-gray-600">
              Adivinhe palavras em português baseado em definições e exemplos.
            </p>
          </Card>

          <Card className="p-8 text-center hover:shadow-lg transition-shadow">
            <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Ganhe Pontos</h3>
            <p className="text-gray-600">
              Acumule pontos por respostas corretas e acompanhe sua pontuação.
            </p>
          </Card>

          <Card className="p-8 text-center hover:shadow-lg transition-shadow">
            <BarChart3 className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Acompanhe Progresso</h3>
            <p className="text-gray-600">
              Veja suas estatísticas, histórico de sessões e melhore continuamente.
            </p>
          </Card>
        </div>

        {/* Stats Section */}
        <div className="bg-white rounded-lg shadow-lg p-12 mb-20">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Por que WordGame?
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-indigo-600 mb-2">100+</div>
              <p className="text-gray-600">Palavras em Português</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-indigo-600 mb-2">Seguro</div>
              <p className="text-gray-600">Dados Protegidos</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-indigo-600 mb-2">Rápido</div>
              <p className="text-gray-600">Sessões Curtas</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-indigo-600 mb-2">Educativo</div>
              <p className="text-gray-600">Aprenda Brincando</p>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Como Funciona
          </h2>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { num: "1", title: "Cadastro", desc: "Crie sua conta com nome, idade e escola" },
              { num: "2", title: "Jogue", desc: "Adivinhe palavras baseado em definições" },
              { num: "3", title: "Ganhe Pontos", desc: "Acumule pontos por respostas corretas" },
              { num: "4", title: "Progresso", desc: "Acompanhe seu histórico e estatísticas" },
            ].map((step) => (
              <div key={step.num} className="text-center">
                <div className="bg-indigo-600 text-white rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {step.num}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        {!isAuthenticated && (
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-12 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">Pronto para começar?</h2>
            <p className="text-lg mb-8 opacity-90">
              Junte-se a milhares de alunos que estão aprendendo português de forma divertida.
            </p>
            <Button
              onClick={() => navigate("/register")}
              className="bg-white text-indigo-600 hover:bg-gray-100 px-8 py-3 text-lg font-medium"
            >
              Criar Conta Gratuitamente
            </Button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; 2026 WordGame. Todos os direitos reservados.</p>
          <p className="mt-2 text-sm">Desenvolvido para educadores e alunos</p>
        </div>
      </footer>
    </div>
  );
}
