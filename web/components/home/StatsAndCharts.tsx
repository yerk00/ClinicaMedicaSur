import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, RadialLinearScale, Title, Tooltip, Legend,
} from "chart.js";
import { Line, Doughnut, PolarArea, Radar } from "react-chartjs-2";
import { 
  Activity, 
  TrendingUp, 
  PieChart, 
  Target,
  Stethoscope,
  BarChart3,
  ChevronDown,
  ChevronUp
} from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
);

function AnimatedCounter({ value, duration = 700 }: { value: number; duration?: number }) {
  const [count, setCount] = React.useState(0);
  React.useEffect(() => {
    const steps = 30;
    const inc = value / steps;
    let cur = 0, n = 0;
    const t = setInterval(() => {
      n += 1; cur += inc;
      if (n >= steps) { cur = value; clearInterval(t); }
      setCount(Math.floor(cur));
    }, duration / steps);
    return () => clearInterval(t);
  }, [value, duration]);
  return <span>{count}</span>;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5 } }),
};

const chartContentVariants = {
  hidden: { 
    opacity: 0, 
    height: 0,
    transition: { duration: 0.3, ease: "easeInOut" }
  },
  visible: { 
    opacity: 1, 
    height: "auto",
    transition: { duration: 0.3, ease: "easeInOut" }
  }
};

type Log = { severity: number | null; mood: string | null; symptom_type: string | null };
type Med = { recurrence: string | null };

export default function StatsAndCharts({
  totalMeds,
  totalLogs,
  allLogs,
  allMedications,
}: {
  totalMeds: number;
  totalLogs: number;
  allLogs: Log[];
  allMedications: Med[];
}) {
  const { theme, resolvedTheme } = useTheme();
  const effectiveTheme = theme === "system" ? resolvedTheme : theme;
  const tickColor = effectiveTheme === "dark" ? "#E2E8F0" : "#475569";
  const gridColor = effectiveTheme === "dark" ? "rgba(226,232,240,0.1)" : "rgba(148,163,184,0.15)";

  // Estados para controlar el colapso de cada gráfico
  const [expandedCharts, setExpandedCharts] = React.useState({
    severity: true,
    symptoms: true,
    mood: true,
    distribution: true
  });

  const toggleChart = (chartName: keyof typeof expandedCharts) => {
    setExpandedCharts(prev => ({
      ...prev,
      [chartName]: !prev[chartName]
    }));
  };

  // Paleta de colores original y nítida
  const colorSet = [
    "#344966",
    "#F97F51",
    "#EAD637",
    "#4CD137",
    "#FF577F",
    "#9A6AFF",
    "#00BDA5",
    "#FF8C00",
    "#00A8E8",
    "#9B5DE5",
    "#F15BB5",
    "#7D7D7D",
  ];

  // Línea — severidad con color principal profesional
  const labels = allLogs.map((_, i) => `#${i + 1}`);
  const values = allLogs.map((l) => l.severity ?? 0);
  const lineData = {
    labels,
    datasets: [{
      label: "Tendencia de severidad",
      data: values,
      borderColor: colorSet[0], // #344966
      backgroundColor: `${colorSet[0]}30`,
      tension: 0.3,
      fill: true,
      pointBackgroundColor: colorSet[0],
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      borderWidth: 2.5,
    }],
  };

  const basePlugins = {
    legend: {
      labels: { 
        color: tickColor,
        font: { size: 13, family: "'Inter', 'system-ui', sans-serif" },
        padding: 16,
        usePointStyle: true,
      }
    },
    tooltip: {
      backgroundColor: effectiveTheme === "dark" ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      titleColor: effectiveTheme === "dark" ? '#E2E8F0' : '#1E293B',
      bodyColor: effectiveTheme === "dark" ? '#CBD5E1' : '#475569',
      borderColor: colorSet[0],
      borderWidth: 1,
      cornerRadius: 6,
      padding: 10,
      titleFont: { size: 13, family: "'Inter', 'system-ui', sans-serif" },
      bodyFont: { size: 12, family: "'Inter', 'system-ui', sans-serif" }
    }
  };

  const defaultChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: basePlugins,
    scales: {
      x: {
        ticks: { 
          color: tickColor, 
          font: { size: 12, family: "'Inter', 'system-ui', sans-serif" } 
        },
        grid: { 
          color: gridColor, 
          drawBorder: false,
          lineWidth: 1
        },
        border: { display: false }
      },
      y: {
        ticks: { 
          color: tickColor, 
          font: { size: 12, family: "'Inter', 'system-ui', sans-serif" } 
        },
        grid: { 
          color: gridColor, 
          drawBorder: false,
          lineWidth: 1
        },
        border: { display: false }
      },
    },
  };

  // Doughnut — síntomas con colores profesionales
  const symptomMap: Record<string, number> = {};
  allLogs.forEach((l) => (l.symptom_type || "").split(",").map(s => s.trim()).filter(Boolean).forEach(s => symptomMap[s] = (symptomMap[s] || 0) + 1));
  const doughLabels = Object.keys(symptomMap);
  const doughValues = doughLabels.map((k) => symptomMap[k]);
  const doughData = {
    labels: doughLabels,
    datasets: [{
      data: doughValues,
      backgroundColor: colorSet.map(c => `${c}E0`), // Más opacidad para mejor visibilidad
      borderColor: colorSet,
      borderWidth: 2,
      hoverBorderWidth: 3,
      hoverOffset: 4,
    }]
  };

  // Radar — ánimo con estilo profesional
  const moodMap: Record<string, number> = {};
  allLogs.forEach((l) => { const m = (l.mood || "").toLowerCase(); if (m) moodMap[m] = (moodMap[m] || 0) + 1; });
  const moodLabels = Object.keys(moodMap).map((m) => m.charAt(0).toUpperCase() + m.slice(1));
  const moodValues = moodLabels.map((m) => moodMap[m.toLowerCase()]);
  const radarData = {
    labels: moodLabels,
    datasets: [{
      label: 'Distribución de ánimo',
      data: moodValues,
      backgroundColor: `${colorSet[5]}40`, // #9A6AFF con más opacidad
      borderColor: colorSet[5],
      borderWidth: 2.5,
      pointBackgroundColor: colorSet[5],
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
    }]
  };
  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: basePlugins,
    scales: {
      r: {
        grid: { color: gridColor, lineWidth: 1 },
        angleLines: { color: gridColor, lineWidth: 1 },
        ticks: { display: false },
        pointLabels: { 
          color: tickColor, 
          font: { size: 12, family: "'Inter', 'system-ui', sans-serif" } 
        }
      }
    },
  };

  // Polar — severidad distribución con colores profesionales
  const sevCount: Record<number, number> = {};
  allLogs.forEach((l) => { const s = l.severity ?? 0; sevCount[s] = (sevCount[s] || 0) + 1; });
  const polarLabels = Object.keys(sevCount).sort();
  const polarValues = polarLabels.map((k) => sevCount[+k]);
  const polarData = {
    labels: polarLabels.map(l => `Severidad ${l}`),
    datasets: [{
      data: polarValues,
      backgroundColor: colorSet.slice(0, polarLabels.length).map(c => `${c}D0`), // Más opacidad
      borderColor: colorSet.slice(0, polarLabels.length),
      borderWidth: 2,
    }]
  };
  const polarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: basePlugins,
    scales: {
      r: {
        grid: { color: gridColor, lineWidth: 1 },
        angleLines: { color: gridColor, lineWidth: 1 },
        ticks: { display: false },
        pointLabels: { 
          color: tickColor, 
          font: { size: 12, family: "'Inter', 'system-ui', sans-serif" } 
        }
      }
    }
  };

  const ChartCard = ({ 
    title, 
    description, 
    icon: Icon, 
    iconColor, 
    chartKey, 
    children, 
    customIndex 
  }: {
    title: string;
    description: string;
    icon: any;
    iconColor: string;
    chartKey: keyof typeof expandedCharts;
    children: React.ReactNode;
    customIndex: number;
  }) => (
    <motion.div custom={customIndex} variants={cardVariants}>
      <Card className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
        <CardHeader 
          className="bg-slate-50 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors duration-200"
          onClick={() => toggleChart(chartKey)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-slate-100 border border-slate-200">
                <Icon className="h-5 w-5" style={{ color: iconColor }} />
              </div>
              <div>
                <CardTitle className="text-slate-700 text-base">
                  {title}
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">{description}</p>
              </div>
            </div>
            <motion.div
              animate={{ rotate: expandedCharts[chartKey] ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ChevronDown className="h-5 w-5" />
            </motion.div>
          </div>
        </CardHeader>
        <AnimatePresence>
          {expandedCharts[chartKey] && (
            <motion.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={chartContentVariants}
            >
              <CardContent className="p-6">
                <div className="h-72">
                  {children}
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl md:text-3xl font-bold text-slate-600 dark:text-slate-100 mb-2">
                Metricas de salud
              </h1></div>
      {/* KPIs mejorados con colores más serios */}
      <motion.div initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {[
          { 
            label: "Total Medicaciones", 
            value: totalMeds, 
            icon: Stethoscope,
            gradient: "from-slate-700 to-slate-800",
            description: "Medicaciones registradas en el sistema"
          },
          { 
            label: "Total Registros de Síntomas", 
            value: totalLogs,
            icon: Activity,
            gradient: "from-slate-600 to-slate-700",
            description: "Entradas de seguimiento clínico"
          },
        ].map((stat, i) => (
          <motion.div key={stat.label} custom={i} variants={cardVariants}>
            <Card className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
              <div className={`h-1 bg-gradient-to-r ${stat.gradient}`} />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
                    {stat.label}
                  </CardTitle>
                  <div className={`p-2.5 rounded-lg bg-gradient-to-br ${stat.gradient} text-white shadow-sm`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-3xl text-slate-800">
                  <AnimatedCounter value={stat.value} />
                </div>
                <p className="text-xs text-slate-500">{stat.description}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts mejorados con funcionalidad de colapso */}
      <motion.div initial="hidden" animate="visible" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Tendencia de Severidad */}
        <ChartCard
          title="Tendencia General de Salud"
          description="Evolución de la severidad a lo largo del tiempo"
          icon={TrendingUp}
          iconColor={colorSet[0]} // #344966
          chartKey="severity"
          customIndex={0}
        >
          {labels.length ? (
            <Line data={lineData} options={defaultChartOptions as any} />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center space-y-3">
                <BarChart3 className="h-12 w-12 mx-auto text-slate-300" />
                <p className="text-sm">Sin datos todavía</p>
                <p className="text-xs text-slate-400">Los datos aparecerán aquí una vez registrados</p>
              </div>
            </div>
          )}
        </ChartCard>

        {/* Distribución de Síntomas */}
        <ChartCard
          title="Distribución de Síntomas"
          description="Categorización por tipo de síntoma reportado"
          icon={PieChart}
          iconColor={colorSet[1]} // #F97F51
          chartKey="symptoms"
          customIndex={1}
        >
          {doughLabels.length ? (
            <Doughnut 
              data={doughData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  ...basePlugins,
                  legend: {
                    position: 'bottom',
                    labels: {
                      color: tickColor,
                      font: { size: 12, family: "'Inter', 'system-ui', sans-serif" },
                      padding: 12,
                      usePointStyle: true,
                      pointStyle: 'circle'
                    }
                  }
                }
              } as any}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center space-y-3">
                <PieChart className="h-12 w-12 mx-auto text-slate-300" />
                <p className="text-sm">Aún no hay síntomas registrados</p>
                <p className="text-xs text-slate-400">Los síntomas se mostrarán cuando se registren</p>
              </div>
            </div>
          )}
        </ChartCard>

        {/* Tendencia de Ánimo */}
        <ChartCard
          title="Análisis de Estado Emocional"
          description="Distribución y tendencias del estado de ánimo"
          icon={Target}
          iconColor={colorSet[5]} // #9A6AFF
          chartKey="mood"
          customIndex={2}
        >
          {moodLabels.length ? (
            <Radar data={radarData as any} options={radarOptions as any} />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center space-y-3">
                <Target className="h-12 w-12 mx-auto text-slate-300" />
                <p className="text-sm">Sin datos de ánimo</p>
                <p className="text-xs text-slate-400">El análisis emocional estará disponible con más datos</p>
              </div>
            </div>
          )}
        </ChartCard>

        {/* Distribución de Severidad */}
        <ChartCard
          title="Distribución de Severidad"
          description="Clasificación por niveles de intensidad clínica"
          icon={Activity}
          iconColor={colorSet[4]} // #FF577F
          chartKey="distribution"
          customIndex={3}
        >
          {polarLabels.length ? (
            <PolarArea data={polarData as any} options={polarOptions as any} />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center space-y-3">
                <Activity className="h-12 w-12 mx-auto text-slate-300" />
                <p className="text-sm">Sin datos de severidad</p>
                <p className="text-xs text-slate-400">La distribución se calculará con más registros</p>
              </div>
            </div>
          )}
        </ChartCard>

      </motion.div>

      {/* Control global de expansión/colapso */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex justify-center"
      >
        <div className="flex gap-2">
          <button
            onClick={() => setExpandedCharts({ severity: true, symptoms: true, mood: true, distribution: true })}
            className="px-4 py-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors duration-200 flex items-center gap-2"
          >
            <ChevronDown className="h-4 w-4" />
            Expandir Todo
          </button>
          <button
            onClick={() => setExpandedCharts({ severity: false, symptoms: false, mood: false, distribution: false })}
            className="px-4 py-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors duration-200 flex items-center gap-2"
          >
            <ChevronUp className="h-4 w-4" />
            Colapsar Todo
          </button>
        </div>
      </motion.div>
    </div>
  );
}