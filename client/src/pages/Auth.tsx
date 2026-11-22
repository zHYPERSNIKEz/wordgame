import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { DEMO_ACCOUNTS } from "@/lib/demoStore";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  GraduationCap,
  Shield,
  User,
  Sparkles,
} from "lucide-react";

import { useAuth } from "@/_core/hooks/useAuth";

export function RegisterPage() {
  const [, navigate] = useLocation();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    age: "",
    school: "",
    inviteCode: "",
    password: "",
    passwordConfirm: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      toast.success("Conta criada com sucesso! Faça login para começar.");
      navigate("/login");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar conta");
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ageNum = Number.parseInt(formData.age, 10);
    if (Number.isNaN(ageNum) || ageNum < 5 || ageNum > 120) {
      toast.error("Informe uma idade válida entre 5 e 120 anos.");
      return;
    }

    setIsLoading(true);
    try {
      await registerMutation.mutateAsync({
        name: formData.name,
        email: formData.email,
        age: ageNum,
        school: formData.school.trim() || undefined,
        inviteCode: formData.inviteCode.trim() || undefined,
        password: formData.password,
        passwordConfirm: formData.passwordConfirm,
      });
    } catch {
      // Error toast is handled by registerMutation.onError
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <div className="p-8">
          <div className="mb-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="px-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar para Início
            </Button>
          </div>
          <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">
            Criar Conta
          </h1>
          <p className="text-center text-gray-600 mb-6">
            Junte-se ao jogo de palavras educativo
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-sm font-medium">
                Nome Completo
              </Label>
              <Input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder="Seu nome"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="seu@email.com"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="age" className="text-sm font-medium">
                Idade
              </Label>
              <Input
                id="age"
                name="age"
                type="number"
                value={formData.age}
                onChange={handleChange}
                placeholder="Ex: 15"
                min="5"
                max="120"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="school" className="text-sm font-medium">
                Escola (Opcional)
              </Label>
              <Input
                id="school"
                name="school"
                type="text"
                value={formData.school}
                onChange={handleChange}
                placeholder="Nome da sua escola"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="inviteCode" className="text-sm font-medium">
                Código da Turma (Opcional)
              </Label>
              <Input
                id="inviteCode"
                name="inviteCode"
                type="text"
                value={formData.inviteCode}
                onChange={handleChange}
                placeholder="Ex: PORT6A ou LIT202"
                className="mt-1 uppercase"
              />
              <p className="text-xs text-gray-500 mt-1">
                Turmas de demonstração disponíveis: PORT6A, LIT202
              </p>
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-medium">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="mt-1 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 mt-0.5"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {formData.password && (
                <div className="flex gap-1 mt-2">
                  {[...Array(4)].map((_, i) => {
                    let strength = 0;
                    const pass = formData.password;
                    if (pass.length >= 6) strength += 1;
                    if (/[A-Z]/.test(pass)) strength += 1;
                    if (/[0-9]/.test(pass)) strength += 1;
                    if (/[^A-Za-z0-9]/.test(pass)) strength += 1;
                    
                    return (
                      <div
                        key={i}
                        className={`h-1.5 w-full rounded-full transition-colors ${
                          i < strength
                            ? strength < 2
                              ? "bg-red-500"
                              : strength < 3
                              ? "bg-yellow-500"
                              : "bg-green-500"
                            : "bg-gray-200"
                        }`}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="passwordConfirm" className="text-sm font-medium flex justify-between">
                <span>Confirmar Senha</span>
                {formData.passwordConfirm && (
                  <span className={formData.password === formData.passwordConfirm ? "text-green-600" : "text-red-600"}>
                    {formData.password === formData.passwordConfirm ? "✅" : "❌"}
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  id="passwordConfirm"
                  name="passwordConfirm"
                  type={showPasswordConfirm ? "text" : "password"}
                  value={formData.passwordConfirm}
                  onChange={handleChange}
                  placeholder="Confirme sua senha"
                  required
                  className="mt-1 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 mt-0.5"
                >
                  {showPasswordConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando conta...
                </>
              ) : (
                "Criar Conta"
              )}
            </Button>
          </form>

          <p className="text-center text-gray-600 mt-6 text-sm">
            Já tem conta?{" "}
            <button
              onClick={() => navigate("/login")}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Faça login
            </button>
          </p>
        </div>
      </Card>
    </div>
  );
}

export function LoginPage() {
  const [, navigate] = useLocation();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (userData) => {
      queryClient.removeQueries({
        predicate: (query) => {
          const key = query.queryKey as unknown[];
          return !(Array.isArray(key[0]) && key[0][0] === "auth" && key[0][1] === "me");
        },
      });
      utils.auth.me.setData(undefined, userData as any);
      await utils.auth.me.invalidate();
      toast.success("Login realizado com sucesso!");

      // Redireciona com base na role
      if (userData.role === "admin" || userData.role === "moderator") {
        navigate("/admin");
      } else {
        navigate("/game");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao fazer login");
    },
  });

  const { user, loading } = useAuth();

  useEffect(() => {
    // Apenas redireciona automaticamente se o usuário já estiver logado ao entrar na página de login
    if (!loading && user && !loginMutation.isPending && !loginMutation.isSuccess) {
      if (user.role === "admin" || user.role === "moderator") navigate("/admin");
      else navigate("/game");
    }
  }, [loading, user, navigate, loginMutation.isPending, loginMutation.isSuccess]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await loginMutation.mutateAsync({
        email: formData.email,
        password: formData.password,
      });
    } catch {
      // Error toast is handled by loginMutation.onError
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (email: string, password: string) => {
    setFormData({ email, password });
    setIsLoading(true);
    try {
      await loginMutation.mutateAsync({ email, password });
    } catch {
      // Error toast is handled by loginMutation.onError
    } finally {
      setIsLoading(false);
    }
  };

  const isBusy = isLoading || loginMutation.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <div className="p-8">
          <div className="mb-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="px-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar para Início
            </Button>
          </div>
          <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">
            Bem-vindo
          </h1>
          <p className="text-center text-gray-600 mb-6">
            Faça login para jogar
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="seu@email.com"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-medium">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Sua senha"
                  required
                  className="mt-1 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 mt-0.5"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isBusy}
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Fazer Login"
              )}
            </Button>
          </form>

          {/* 1-Click Demo Access */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-600" />
                Acesso Rápido (Modo Demo)
              </span>
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                1 Clique
              </Badge>
            </div>
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() =>
                  handleDemoLogin(
                    DEMO_ACCOUNTS.student.email,
                    DEMO_ACCOUNTS.student.password
                  )
                }
                className="w-full justify-between text-left h-auto py-2.5"
              >
                <span className="flex items-center gap-2 font-medium text-gray-900">
                  <User className="h-4 w-4 text-indigo-600" />
                  {DEMO_ACCOUNTS.student.label}
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  {DEMO_ACCOUNTS.student.email} / {DEMO_ACCOUNTS.student.password}
                </span>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() =>
                  handleDemoLogin(
                    DEMO_ACCOUNTS.moderator.email,
                    DEMO_ACCOUNTS.moderator.password
                  )
                }
                className="w-full justify-between text-left h-auto py-2.5"
              >
                <span className="flex items-center gap-2 font-medium text-gray-900">
                  <GraduationCap className="h-4 w-4 text-green-600" />
                  {DEMO_ACCOUNTS.moderator.label}
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  {DEMO_ACCOUNTS.moderator.email} / {DEMO_ACCOUNTS.moderator.password}
                </span>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() =>
                  handleDemoLogin(
                    DEMO_ACCOUNTS.admin.email,
                    DEMO_ACCOUNTS.admin.password
                  )
                }
                className="w-full justify-between text-left h-auto py-2.5"
              >
                <span className="flex items-center gap-2 font-medium text-gray-900">
                  <Shield className="h-4 w-4 text-purple-600" />
                  {DEMO_ACCOUNTS.admin.label}
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  {DEMO_ACCOUNTS.admin.email} / {DEMO_ACCOUNTS.admin.password}
                </span>
              </Button>
            </div>
          </div>

          <p className="text-center text-gray-600 mt-6 text-sm">
            Não tem conta?{" "}
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Crie uma agora
            </button>
          </p>
        </div>
      </Card>
    </div>
  );
}
