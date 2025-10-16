import React, { useRef, useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Inter } from "next/font/google";
import dynamic from "next/dynamic";
import { motion, useInView } from "framer-motion";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  BarChart2,
  Pill,
  Activity,
  FileText,
  Bell,
  HeartPulse,
  Smile,
  Star,
  User,
  CheckSquare,
  Zap,
  Clock,
  Lock,
  ThumbsUp,
  TrendingUp,
  Shield,
  ChevronLeft,
  ChevronRight,
  ArrowDown,
  Github,
} from "lucide-react";
import Head from "next/head";

// Dynamically import react-slick to avoid SSR issues
// This is intentional - we want to load this only on the client side since
// it is for client side interactions only
const Slider = dynamic(() => import("react-slick"), { ssr: false });

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PrevArrow(props: any) {
  const { onClick } = props;
  return (
    <button
      onClick={onClick}
      className="absolute left-0 top-1/2 z-10 transform -translate-y-1/2 bg-white text-primary p-2 rounded-full shadow hover:scale-105 cursor-pointer"
    >
      <ChevronLeft className="w-6 h-6" />
    </button>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NextArrow(props: any) {
  const { onClick } = props;
  return (
    <button
      onClick={onClick}
      className="absolute right-0 top-1/2 z-10 transform -translate-y-1/2 bg-white text-primary p-2 rounded-full shadow hover:scale-105 cursor-pointer"
    >
      <ChevronRight className="w-6 h-6" />
    </button>
  );
}

/**
 * An animated component that fades in when it comes into view, for a smoother user experience
 *
 * @param param0 - Props for the AnimatedInView component
 * @returns - A motion.div that animates its children when they come into view
 */
function AnimatedInView({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, amount: 0.3 });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { delay, duration: 0.5 } },
      }}
    >
      {children}
    </motion.div>
  );
}

const sliderSettings = {
  dots: true,
  arrows: true,
  infinite: true,
  autoplay: true,
  autoplaySpeed: 2500,
  speed: 500,
  slidesToShow: 3,
  slidesToScroll: 1,
  prevArrow: <PrevArrow />,
  nextArrow: <NextArrow />,
  responsive: [
    {
      breakpoint: 1024,
      settings: { slidesToShow: 2 },
    },
    {
      breakpoint: 640,
      settings: { slidesToShow: 1 },
    },
  ],
};

export default function Home() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      setUser(user);
    };

    fetchUser();
  }, []);

  return (
    <>
      <Head>
        <title>Clinica Medica Sur | Welcome</title>
        <meta
          name="description"
          content="Your health companion to track, understand, and manage your daily health seamlessly."
        />
      </Head>
      <div className={`${inter.className} font-sans overflow-x-hidden`}>
        {/* Gotta override the default scroll behavior */}
        {/* This is a workaround for smooth scrolling */}
        <style jsx global>{`
          html {
            scroll-behavior: smooth;
          }

          html,
          body {
            overscroll-behavior: none;
          }
        `}</style>

        <section className="relative min-h-screen bg-gradient-to-b from-cyan-800 via-cyan-700 to-cyan-600 text-white flex flex-col items-center justify-center px-6 text-center overflow-hidden">
        
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full border-t-4 border-cyan-300 border-opacity-40 animate-spin-slow" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-cyan-300/10 backdrop-blur-md blur-3xl" />
        </div>

        <AnimatedInView delay={0}>
          <h1 className="text-5xl md:text-7xl font-bold drop-shadow-xl tracking-tight">
            Clinica Medica Sur
          </h1>
        </AnimatedInView>

        <AnimatedInView delay={0.2}>
          <p className="text-lg md:text-2xl mt-4 mb-8 max-w-2xl mx-auto text-white/90">
            Tu compañero de salud — controla, comprende y mejora tu bienestar.
          </p>
        </AnimatedInView>

        <AnimatedInView delay={0.4}>
          <Link href={user ? "/home" : "/auth/login"} className="inline-block">
            <Button
              variant="default"
              className="bg-white text-cyan-700 font-semibold rounded-full px-8 py-4 text-lg hover:scale-105 hover:shadow-xl hover:bg-cyan-50 transition-transform"
            >
              {user ? "Continuar" : "Empezar ahora"}
            </Button>
          </Link>
        </AnimatedInView>

        <AnimatedInView delay={0.6}>
          <Link href="#features" className="inline-block mt-4">
            <Button
              variant="ghost"
              className="text-white font-medium rounded-full px-8 py-4 text-lg hover:text-cyan-300 hover:translate-y-1 transition-all"
            >
              Conoce más
              <ArrowDown className="w-5 h-5 ml-2 inline-block" />
            </Button>
          </Link>
        </AnimatedInView>
      </section>


        <section id="features" className="relative bg-white text-gray-800 py-24 px-4 sm:px-6 lg:px-8">
        <AnimatedInView delay={0} className="max-w-6xl mx-auto text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold text-cyan-700 mb-4 tracking-tight">
            Funcionalidades destacadas
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Las herramientas más completas para tu salud diaria.
          </p>
        </AnimatedInView>

        <AnimatedInView delay={0.1} className="max-w-6xl mx-auto">
          <Slider {...sliderSettings}>
            {[
              {
                icon: <CalendarDays className="w-16 h-16 text-cyan-600" />,
                title: "Seguimiento Diario",
                description: "Registra tus métricas de salud fácilmente cada día.",
              },
              {
                icon: <BarChart2 className="w-16 h-16 text-cyan-600" />,
                title: "Tendencias Visuales",
                description: "Gráficas que revelan patrones en tu salud.",
              },
              {
                icon: <Pill className="w-16 h-16 text-cyan-600" />,
                title: "Recordatorio de Medicación",
                description: "Recibe notificaciones para no olvidar tus medicamentos.",
              },
              {
                icon: <HeartPulse className="w-16 h-16 text-cyan-600" />,
                title: "Asistente de Salud AI",
                description: "Consejos personalizados disponibles 24/7.",
              },
              {
                icon: <Activity className="w-16 h-16 text-cyan-600" />,
                title: "Registro de Actividades",
                description: "Anota tus síntomas y actividades diarias.",
              },
              {
                icon: <FileText className="w-16 h-16 text-cyan-600" />,
                title: "Informes Detallados",
                description: "Genera reportes listos para compartir con tu médico.",
              },
              {
                icon: <Bell className="w-16 h-16 text-cyan-600" />,
                title: "Alertas Personalizadas",
                description: "Establece notificaciones según tus necesidades.",
              },
              {
                icon: <ThumbsUp className="w-16 h-16 text-cyan-600" />,
                title: "Modo Claro/Oscuro",
                description: "Personaliza tu experiencia visual.",
              },
            ].map(({ icon, title, description }, index) => (
              <div key={index} className="px-4">
                <AnimatedInView delay={0.1 * index}>
                  <Card className="h-72 bg-white shadow-xl rounded-2xl hover:shadow-2xl transition-all duration-300 border border-cyan-100">
                    <CardHeader className="flex flex-col items-center pt-6">
                      {icon}
                      <CardTitle className="text-xl font-bold mt-4 text-cyan-700 text-center">
                        {title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 text-center text-gray-600 px-6 pb-6">
                      {description}
                    </CardContent>
                  </Card>
                </AnimatedInView>
              </div>
            ))}
          </Slider>
        </AnimatedInView>
      </section>


        <section className="relative bg-cyan-50 text-gray-800 py-24 px-4 sm:px-6 lg:px-8">
        <AnimatedInView
          delay={0}
          className="max-w-6xl mx-auto text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-extrabold text-cyan-700 mb-4 tracking-tight">
            Lo que dicen nuestros usuarios
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Testimonios reales de personas que han transformado su salud con SymptomSync.
          </p>
        </AnimatedInView>

        <AnimatedInView delay={0.1} className="max-w-6xl mx-auto">
          <Slider {...sliderSettings}>
            {[
              {
                icon: <Smile className="w-8 h-8 text-cyan-600" />,
                name: "Alex",
                comment:
                  "SymptomSync transformó mi experiencia médica. ¡Ahora llevo el control de todo!",
              },
              {
                icon: <HeartPulse className="w-8 h-8 text-cyan-600" />,
                name: "Jamie",
                comment:
                  "Las alertas de medicación cambiaron mi vida. ¡Nunca más me olvidé de una dosis!",
              },
              {
                icon: <Star className="w-8 h-8 text-cyan-600" />,
                name: "Pat",
                comment:
                  "Los reportes detallados me ayudaron a mejorar mi bienestar con datos precisos.",
              },
              {
                icon: <CheckSquare className="w-8 h-8 text-cyan-600" />,
                name: "Morgan",
                comment:
                  "Las alertas y tendencias de salud me ayudan a prevenir a tiempo.",
              },
              {
                icon: <Zap className="w-8 h-8 text-cyan-600" />,
                name: "Taylor",
                comment:
                  "El asistente de IA es como tener un médico a mi lado todo el día.",
              },
            ].map(({ icon, name, comment }, index) => (
              <div key={index} className="px-4">
                <AnimatedInView delay={0.1 * index}>
                  <Card className="h-48 bg-white rounded-2xl shadow-md border border-cyan-100 p-6 flex flex-col justify-between hover:shadow-lg transition-all">
                    <p className="italic text-gray-700 text-center">
                      “{comment}”
                    </p>
                    <div className="flex items-center justify-center mt-4 text-cyan-600 font-semibold">
                      {icon}
                      <span className="ml-2">— {name}</span>
                    </div>
                  </Card>
                </AnimatedInView>
              </div>
            ))}
          </Slider>
        </AnimatedInView>
      </section>


        <section className="relative bg-white text-gray-800 py-24 px-4 sm:px-6 lg:px-8">
          <AnimatedInView delay={0} className="max-w-6xl mx-auto text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-emerald-600 mb-4">
              ¿Cómo funciona Clinica Medica Sur?
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Un proceso sencillo para transformar tu salud.
            </p>
          </AnimatedInView>

          <AnimatedInView delay={0.1} className="max-w-6xl mx-auto">
            <Slider {...sliderSettings}>
              {[
                {
                  icon: <User className="w-14 h-14 text-emerald-500" />,
                  title: "Regístrate",
                  description: "Crea tu cuenta en minutos, sin complicaciones.",
                },
                {
                  icon: <CalendarDays className="w-14 h-14 text-cyan-600" />,
                  title: "Registra tu salud",
                  description: "Añade tus métricas diarias fácilmente.",
                },
                {
                  icon: <BarChart2 className="w-14 h-14 text-emerald-500" />,
                  title: "Analiza tu bienestar",
                  description: "Descubre patrones y mejora tu salud.",
                },
                {
                  icon: <Bell className="w-14 h-14 text-cyan-600" />,
                  title: "Recibe alertas",
                  description: "Notificaciones personalizadas según tus datos.",
                },
                {
                  icon: <Activity className="w-14 h-14 text-emerald-500" />,
                  title: "Asistente AI",
                  description: "Consulta dudas y obtén consejos inteligentes.",
                },
                {
                  icon: <HeartPulse className="w-14 h-14 text-cyan-600" />,
                  title: "Mantente saludable",
                  description: "Lleva un control continuo y seguro.",
                },
                {
                  icon: <Zap className="w-14 h-14 text-emerald-500" />,
                  title: "Activa tu energía",
                  description: "Mejora tus hábitos con ayuda de la app.",
                },
                {
                  icon: <Clock className="w-14 h-14 text-cyan-600" />,
                  title: "Ahorra tiempo",
                  description: "Reduce estrés. Gana claridad médica al instante.",
                },
              ].map(({ icon, title, description }, index) => (
                <div key={index} className="px-4">
                  <AnimatedInView delay={0.1 * index}>
                    <Card className="h-72 bg-white rounded-2xl shadow-md hover:shadow-lg border border-gray-100 transition-all">
                      <CardHeader className="flex flex-col items-center pt-6">
                        {icon}
                        <CardTitle className="text-xl font-bold mt-4 text-center text-gray-800">
                          {title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-center text-gray-600 px-6 pb-6">
                        {description}
                      </CardContent>
                    </Card>
                  </AnimatedInView>
                </div>
              ))}
            </Slider>
          </AnimatedInView>
        </section>


        <section className="relative bg-gradient-to-b from-cyan-50 via-white to-emerald-50 text-gray-800 py-24 px-4 sm:px-6 lg:px-8">
        <AnimatedInView delay={0} className="max-w-6xl mx-auto text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold text-cyan-700 tracking-tight mb-4">
            ¿Por qué elegir Clinica Medica Sur?
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Las razones por las que miles de usuarios confían en nosotros.
          </p>
        </AnimatedInView>

        <AnimatedInView delay={0.1} className="max-w-6xl mx-auto">
          <Slider {...sliderSettings}>
            {[
              {
                icon: <ThumbsUp className="w-14 h-14 text-emerald-500" />,
                title: "Fácil de usar",
                description: "Diseño intuitivo para todas las edades.",
              },
              {
                icon: <Lock className="w-14 h-14 text-cyan-600" />,
                title: "Privacidad garantizada",
                description: "Tus datos siempre protegidos y cifrados.",
              },
              {
                icon: <Zap className="w-14 h-14 text-emerald-500" />,
                title: "Rendimiento superior",
                description: "Rápido, eficiente y sin interrupciones.",
              },
              {
                icon: <Shield className="w-14 h-14 text-cyan-600" />,
                title: "Seguimiento seguro",
                description: "Controles médicos con tecnología avanzada.",
              },
              {
                icon: <TrendingUp className="w-14 h-14 text-emerald-500" />,
                title: "Análisis inteligentes",
                description: "Información útil para mejorar tu salud.",
              },
              {
                icon: <HeartPulse className="w-14 h-14 text-cyan-600" />,
                title: "Asistente de IA",
                description: "Te acompaña y responde tus inquietudes 24/7.",
              },
              {
                icon: <Clock className="w-14 h-14 text-emerald-500" />,
                title: "Soporte 24/7",
                description: "Estamos para ti a toda hora, sin excepción.",
              },
              {
                icon: <CheckSquare className="w-14 h-14 text-cyan-600" />,
                title: "Funciones completas",
                description: "Todo lo que necesitas, en un solo lugar.",
              },
            ].map(({ icon, title, description }, index) => (
              <div key={index} className="px-4">
                <AnimatedInView delay={0.1 * index}>
                  <Card className="h-72 bg-white rounded-2xl shadow-md hover:shadow-2xl border border-gray-100 transition-all duration-300">
                    <CardHeader className="flex flex-col items-center pt-6">
                      {icon}
                      <CardTitle className="text-xl font-bold mt-4 text-gray-800 text-center">
                        {title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-center text-gray-600 px-6 pb-6">
                      {description}
                    </CardContent>
                  </Card>
                </AnimatedInView>
              </div>
            ))}
          </Slider>
        </AnimatedInView>
      </section>


       <section className="relative bg-white text-gray-800 py-24 px-4 sm:px-6 lg:px-8">
        <AnimatedInView delay={0} className="max-w-6xl mx-auto text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-cyan-700 mb-4">
            Preguntas Frecuentes
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Encuentra respuestas claras a tus dudas más comunes.
          </p>
        </AnimatedInView>

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {[
            {
              q: "¿Qué tan segura está mi información?",
              a: `Tus datos están cifrados y protegidos. Nunca compartimos tu información sin tu consentimiento.`,
            },
            {
              q: "¿Puedo generar reportes detallados?",
              a: `Sí, puedes exportar tus reportes como PDF desde la sección de Documentos.`,
            },
            {
              q: "¿Cómo configuro recordatorios?",
              a: `Ve a la página de Inicio y añade tus medicamentos o citas con fechas.`,
            },
            {
              q: "¿El soporte está disponible 24/7?",
              a: `¡Sí! Escríbenos en cualquier momento a <a href=\"mailto:soporte@clinicasur.com\" className=\"text-cyan-700 underline\">soporte@clinicasur.com</a>.`,
            },
            {
              q: "¿Tienen un chatbot?",
              a: `Sí. Nuestro asistente inteligente responde preguntas y da consejos médicos básicos.`,
            },
            {
              q: "¿Cómo registro mi salud diaria?",
              a: `Desde el Inicio puedes registrar tus métricas fácilmente en pocos clics.`,
            },
            {
              q: "¿Puedo ver mi calendario?",
              a: `En la página Calendario puedes visualizar tus próximos eventos y medicamentos.`,
            },
            {
              q: "¿Existe una app móvil?",
              a: `Por ahora solo versión web, pero es 100% responsiva y funcional en móviles.`,
            },
          ].map(({ q, a }, idx) => (
            <AnimatedInView key={idx} delay={0.05 * idx}>
              <Card className="h-full flex flex-col shadow-md border border-cyan-100 rounded-xl p-6 bg-gradient-to-br from-white to-cyan-50 hover:shadow-lg hover:border-emerald-300 transition-all duration-300">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-cyan-700 mb-3">{q}</h3>
                  <p
                    className="text-gray-600 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: a }}
                  />
                </div>
              </Card>
            </AnimatedInView>
          ))}
        </div>
      </section>


        <section className="relative bg-white py-24 px-6 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none z-0">
            <div className="absolute top-[-5rem] left-[-5rem] w-[28rem] h-[28rem] bg-emerald-100 rounded-full opacity-20 blur-3xl animate-pulse-slow" />
            <div className="absolute bottom-[-5rem] right-[-5rem] w-[24rem] h-[24rem] bg-cyan-100 rounded-full opacity-20 blur-3xl animate-pulse-slow" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[20rem] h-[20rem] bg-white/50 rounded-full blur-[100px]" />
          </div>

          {/* Contenido principal */}
          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <AnimatedInView delay={0.2}>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-cyan-700 mb-6">
                Toma el control de tu salud
              </h2>
            </AnimatedInView>

            <AnimatedInView delay={0.3}>
              <p className="text-lg md:text-xl text-gray-600 mb-10 leading-relaxed">
                Transforma tu bienestar con <strong>Clinica Medica Sur</strong>. Organiza tus métricas, recibe alertas inteligentes y accede a un asistente médico personalizado, todo en una plataforma moderna.
              </p>
            </AnimatedInView>

            <AnimatedInView delay={0.4}>
              <motion.a
                href={user ? "/home" : "/auth/signUp"}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-block"
              >
                <Button
                  className="rounded-full px-10 py-4 text-lg font-semibold shadow-xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white hover:from-emerald-600 hover:to-cyan-700 transition"
                >
                  {user ? "Continuar con mi cuenta" : "Empieza gratis ahora"}
                </Button>
              </motion.a>
            </AnimatedInView>
          </div>
        </section>




        <footer className="bg-white text-gray-700 border-t border-gray-200 py-8 px-4">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between">
            <p className="text-sm whitespace-nowrap">
              © {new Date().getFullYear()}{" "}
              <strong className="font-bold text-cyan-700">ClinicaMedicaSur</strong>. Todos los derechos reservados.
            </p>
            <div className="mt-4 md:mt-0 flex flex-wrap items-center justify-center md:justify-end gap-6 text-sm">
              <Link href="/privacy" className="flex items-center hover:text-cyan-700 transition">
                <Shield className="w-4 h-4 mr-1" />
                Política de Privacidad
              </Link>
              <Link href="/terms" className="flex items-center hover:text-cyan-700 transition">
                <FileText className="w-4 h-4 mr-1" />
                Términos y Condiciones
              </Link>
              <Link
                href="localhost"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center hover:text-cyan-700 transition"
              >
                <Github className="w-4 h-4 mr-1" />
                Repositorio
              </Link>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
