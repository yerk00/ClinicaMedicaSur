import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  Loader,
  Activity,
  Heart,
  Zap,
  Shield,
  ArrowRight,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { signIn } from "@/lib/auth";
import Head from "next/head";
import { getCurrentProfile } from "@/lib/profile";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [focusedInput, setFocusedInput] = useState<string>("");

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const validateEmail = (value: string) => {
    return /\S+@\S+\.\S+/.test(value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Por favor completa todos los campos.");
      return;
    }
    if (!validateEmail(email)) {
      toast.error("Ingresa un correo válido.");
      return;
    }

    try {
      setIsSubmitting(true);
      const { user, session } = await signIn(email, password);

      const profile = await getCurrentProfile();
      if (!profile || !profile.role?.name) {
        throw new Error("No se pudo cargar el rol de usuario.");
      }

      toast.success("Inicio de sesión exitoso.");

      if (profile.role.name === "Administrador") {
        router.push("/admin");
      } else {
        router.push("/profile");
      }
    } catch (error: any) {
      const message =
        (error && (error.message || error.error || error.toString())) ||
        "Login failed. Please try again.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const floatingElements = Array.from({ length: 8 }, (_, i) => (
    <div
      key={i}
      className={`absolute opacity-20 animate-float-${i % 3}`}
      style={{
        left: `${10 + i * 12}%`,
        top: `${20 + i * 8}%`,
        animationDelay: `${i * 0.5}s`,
      }}
      aria-hidden
    >
      {i % 4 === 0 && <Activity className="w-6 h-6 text-white" />}
      {i % 4 === 1 && <Heart className="w-5 h-5 text-white" />}
      {i % 4 === 2 && <Zap className="w-4 h-4 text-white" />}
      {i % 4 === 3 && <Shield className="w-5 h-5 text-white" />}
    </div>
  ));

  return (
    <>
      <Head>
        <title>Clínica Médica Sur | Iniciar sesión</title>
        <meta
          name="description"
          content="Inicia sesión en tu cuenta para acceder al panel médico."
        />
      </Head>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

        * {
          font-family: 'Inter', sans-serif;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          overflow: hidden;
          scroll-behavior: smooth;
          overscroll-behavior: none;
        }

        @keyframes pulse-glow {
          0%,
          100% {
            box-shadow: 0 0 20px rgba(41, 227, 144, 0.3);
          }
          50% {
            box-shadow: 0 0 40px rgba(41, 227, 144, 0.6);
          }
        }

        @keyframes float-0 {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-10px) rotate(90deg);
          }
          50% {
            transform: translateY(-5px) rotate(180deg);
          }
          75% {
            transform: translateY(-15px) rotate(270deg);
          }
        }

        @keyframes float-1 {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg) scale(1);
          }
          33% {
            transform: translateY(-20px) rotate(120deg) scale(1.1);
          }
          66% {
            transform: translateY(-10px) rotate(240deg) scale(0.9);
          }
        }

        @keyframes float-2 {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-25px) rotate(180deg);
          }
        }

        @keyframes gradient-shift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        @keyframes slide-in-left {
          from {
            transform: translateX(-100px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slide-in-right {
          from {
            transform: translateX(100px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes scale-in {
          from {
            transform: scale(0.8);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes ripple {
          0% {
            transform: scale(0);
            opacity: 1;
          }
          100% {
            transform: scale(4);
            opacity: 0;
          }
        }

        .animate-float-0 {
          animation: float-0 6s ease-in-out infinite;
        }
        .animate-float-1 {
          animation: float-1 8s ease-in-out infinite;
        }
        .animate-float-2 {
          animation: float-2 7s ease-in-out infinite;
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.8s ease-out forwards;
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.8s ease-out forwards;
        }
        .animate-scale-in {
          animation: scale-in 0.6s ease-out forwards;
        }

        .gradient-bg {
          background: linear-gradient(-45deg, #006c89, #007291, #29e390, #007c9d);
          background-size: 400% 400%;
          animation: gradient-shift 15s ease infinite;
        }

        .glass-effect {
          backdrop-filter: blur(20px);
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .input-glow:focus {
          box-shadow: 0 0 20px rgba(41, 227, 144, 0.3);
          border-color: #29e390;
        }

        .medical-grid {
          background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 50px 50px;
        }

        .pulse-ring {
          position: relative;
        }

        .pulse-ring::before {
          content: "";
          position: absolute;
          top: -10px;
          left: -10px;
          right: -10px;
          bottom: -10px;
          border: 2px solid #29e390;
          border-radius: 50%;
          animation: ripple 1.5s infinite;
          opacity: 0;
        }

        .neon-text {
          text-shadow: 0 0 5px rgba(255, 255, 255, 0.5), 0 0 10px rgba(255, 255, 255, 0.3),
            0 0 15px rgba(41, 227, 144, 0.3), 0 0 20px rgba(41, 227, 144, 0.2);
        }

        .morphing-border {
          position: relative;
          overflow: hidden;
        }

        .morphing-border::before {
          content: "";
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          background: linear-gradient(45deg, #29e390, #5de57b, #29e390);
          border-radius: inherit;
          z-index: -1;
          animation: gradient-shift 3s ease infinite;
        }
      `}</style>

      <div className="h-screen flex relative overflow-hidden">
        {/* Dynamic background with mouse tracking (no pointer events) */}
        <div
          className="absolute inset-0 gradient-bg medical-grid pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(41, 227, 144, 0.1) 0%, transparent 50%), linear-gradient(-45deg, #006C89, #007291, #29E390, #007C9D)`,
          }}
          aria-hidden
        />

        {/* Floating medical icons */}
        <div className="absolute inset-0 pointer-events-none">{floatingElements}</div>

        {/* Left side - Login Form */}
        <div className="relative z-10 w-full lg:w-1/2 flex flex-col bg-white/95 backdrop-blur-sm">
          {/* Header with logo and create account */}
          <div className="flex justify-between items-center p-6 lg:p-8">

            <Link href="/auth/signUp" legacyBehavior>
              <a className="border border-[#006C89] px-6 py-2 rounded-full text-[#006C89] text-sm font-medium hover:bg-[#006C89] hover:text-white transition-all duration-300 transform hover:scale-105 animate-slide-in-right">
                Crear cuenta
              </a>
            </Link>
          </div>

          {/* Main login form */}
          <div className="flex-1 flex items-center justify-center p-6 lg:p-8">
            <div className="w-full max-w-md space-y-8 animate-scale-in">
              <div className="text-center space-y-4">
                <h1 className="text-4xl lg:text-5xl font-black text-[#006C89]">
                  Bienvenido de vuelta
                </h1>
              
              </div>

              <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                {/* Email input */}
                <div className="relative group">
                  <input
                    aria-label="Email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedInput("email")}
                    onBlur={() => setFocusedInput("")}
                    className="w-full px-6 py-4 bg-white border-2 border-gray-300 rounded-2xl text-[#006C89] placeholder-gray-500 font-medium transition-all duration-300 focus:border-[#29E390] focus:bg-gray-50 shadow-lg hover:shadow-xl input-glow"
                    required
                  />
                  {/* Overlay: only receives pointer events when visible */}
                  <div
                    className={`absolute inset-0 rounded-2xl transition-opacity duration-300 ${
                      focusedInput === "email"
                        ? "opacity-100 pointer-events-auto"
                        : "opacity-0 pointer-events-none"
                    }`}
                  >
                    <div className="morphing-border absolute inset-0 rounded-2xl" />
                  </div>
                </div>

                {/* Password input */}
                <div className="relative group">
                  <input
                    aria-label="Password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedInput("password")}
                    onBlur={() => setFocusedInput("")}
                    className="w-full px-6 py-4 pr-14 bg-white border-2 border-gray-300 rounded-2xl text-[#006C89] placeholder-gray-500 font-medium transition-all duration-300 focus:border-[#29E390] focus:bg-gray-50 shadow-lg hover:shadow-xl input-glow"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-[#006C89] transition-colors duration-200"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>

                  {/* Overlay: only pointer-events when visible */}
                  <div
                    className={`absolute inset-0 rounded-2xl transition-opacity duration-300 ${
                      focusedInput === "password"
                        ? "opacity-100 pointer-events-auto"
                        : "opacity-0 pointer-events-none"
                    }`}
                  >
                    <div className="morphing-border absolute inset-0 rounded-2xl" />
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-[#006C89] to-[#007C9D] hover:from-[#007291] hover:to-[#006F8D] text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl disabled:opacity-50 disabled:transform-none flex items-center justify-center space-x-3 group shadow-lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader className="animate-spin w-5 h-5" />
                      <span>Inciando...</span>
                    </>
                  ) : (
                    <>
                      <span>Inciar Sesion</span>
                      <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-200" />
                    </>
                  )}
                </button>

                {/* Forgot password */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => router.push("/auth/forgotPassword")}
                    className="text-[#007291] hover:text-[#29E390] transition-colors duration-200 font-medium hover:underline"
                  >
                    Olvidaste tu contraseña?
                  </button>
                </div>
              </form>

              {/* Terms */}
              <p className="text-center text-sm text-gray-600">
                Al iniciar sesion estas deacurerdo con nuestras politicas{" "}
                <button
                  type="button"
                  onClick={() => router.push("/terms")}
                  className="text-[#29E390] hover:underline"
                >
                  Terminos de Servicio
                </button>{" "}
                y{" "}
                <button
                  type="button"
                  onClick={() => router.push("/privacy")}
                  className="text-[#29E390] hover:underline"
                >
                  Politicas de privacidad
                </button>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Right side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-[#006C89]/90 to-[#007C9D]/90 backdrop-blur-sm" />

          {/* Medical visualization */}
          <div className="relative z-10 flex flex-col justify-center items-end p-12 text-right space-y-8">
            <div className="animate-slide-in-right">
              <h1 className="text-6xl font-black text-white mb-4 neon-text">
                Clínica
                <br />
                Médica
                <br />
                Sur
              </h1>
              <div className="w-24 h-1 bg-gradient-to-r from-[#29E390] to-[#5DE57B] ml-auto rounded-full" />
            </div>

            <div className="space-y-6 animate-slide-in-right" style={{ animationDelay: "0.2s" }}>
              <div className="glass-effect p-6 rounded-2xl">
                <div className="flex items-center justify-end space-x-4 mb-2">
                  <span className="text-2xl font-bold text-white">Metricas</span>
                  <Activity className="w-8 h-8 text-[#29E390]" />
                </div>
              </div>

              <div className="glass-effect p-6 rounded-2xl">
                <div className="flex items-center justify-end space-x-4 mb-2">
                  <span className="text-2xl font-bold text-white">Analisis Clinico</span>
                  <Heart className="w-8 h-8 text-[#5DE57B]" />
                </div>
              </div>

              <div className="glass-effect p-6 rounded-2xl">
                <div className="flex items-center justify-end space-x-4 mb-2">
                  <span className="text-2xl font-bold text-white">Asistencia Diagnostica</span>
                  <Shield className="w-8 h-8 text-[#29E390]" />
                </div>
                
              </div>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute bottom-10 right-10 opacity-30">
            <div className="w-32 h-32 border-4 border-white rounded-full animate-spin" style={{ animationDuration: "20s" }} />
            <div className="absolute inset-4 border-2 border-[#29E390] rounded-full animate-spin" style={{ animationDuration: "15s", animationDirection: "reverse" }} />
            <div className="absolute inset-8 w-16 h-16 bg-gradient-to-br from-[#29E390] to-[#5DE57B] rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    </>
  );
}
