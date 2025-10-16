'use client';

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getSummary, getByRole, getByDay } from "@/lib/admin/dashboard";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  AreaChart, Area, XAxis, Tooltip,
  BarChart, Bar, YAxis, CartesianGrid,
} from "recharts";
import { 
  Users, 
  UserCheck, 
  UserX, 
  TrendingUp, 
  Calendar,
  Activity,
  Shield,
  Clock
} from "lucide-react";

export default function AdminDashboardPage() {
  const kpisQ = useQuery({ queryKey: ["admin-kpis"], queryFn: getSummary, staleTime: 60_000 });
  const rolesQ = useQuery({ queryKey: ["admin-by-role"], queryFn: getByRole, staleTime: 60_000 });
  const seriesQ = useQuery({ queryKey: ["admin-by-day", 30], queryFn: () => getByDay(30), staleTime: 60_000 });

  const currentTime = new Date().toLocaleString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header formal */}
        <motion.header 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg border border-slate-200 shadow-sm p-6"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-700 rounded-lg text-white">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                    Panel de Control Médico
                  </h1>
                  <p className="text-slate-600">Sistema de Gestión de Personal Sanitario</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 ml-11">
                <Clock className="h-4 w-4" />
                <span>Última actualización: {currentTime}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="px-3 py-1 bg-green-50 text-green-700 border-green-200">
                <Activity className="h-4 w-4 mr-1" />
                En línea
              </Badge>
              <Badge variant="outline" className="px-3 py-1 border-slate-300 text-slate-600">
                Tiempo Real
              </Badge>
            </div>
          </div>
        </motion.header>

        {/* KPIs con colores sutiles */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5"
        >
          <KpiCard 
            title="Total Personal" 
            value={kpisQ.data?.total_users} 
            gradient="from-slate-600 to-slate-700"
            icon={Users}
            description="Personal registrado en sistema"
            color="slate"
          />
          <KpiCard 
            title="Personal Activo" 
            value={kpisQ.data?.active_users} 
            gradient="from-emerald-600 to-emerald-700"
            icon={UserCheck}
            description="Usuarios activos hoy"
            color="emerald"
          />
          <KpiCard 
            title="Personal Inactivo" 
            value={kpisQ.data?.inactive_users} 
            gradient="from-amber-500 to-amber-600"
            icon={UserX}
            description="Requiere seguimiento"
            color="amber"
          />
          <KpiCard 
            title="Nuevos (7 días)" 
            value={kpisQ.data?.new_users_last_7d} 
            gradient="from-blue-600 to-blue-700"
            icon={TrendingUp}
            description="Incorporaciones recientes"
            color="blue"
          />
          <KpiCard 
            title="Nuevos (30 días)" 
            value={kpisQ.data?.new_users_last_30d} 
            gradient="from-indigo-600 to-indigo-700"
            icon={Calendar}
            description="Crecimiento mensual"
            color="indigo"
          />
        </motion.div>

        {/* Gráficos con diseño formal */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Serie temporal */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50">
                <CardTitle className="flex items-center gap-2 text-slate-700">
                  <TrendingUp className="h-5 w-5 text-slate-600" />
                  Incorporaciones Diarias (Últimos 30 días)
                </CardTitle>
                <p className="text-slate-500 text-sm">Tendencia de nuevos registros de personal</p>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-64">
                  {seriesQ.isLoading ? (
                    <div className="animate-pulse h-full w-full rounded bg-slate-100" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={seriesQ.data ?? []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#475569" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#475569" stopOpacity={0.05}/>
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="day" 
                          tick={{ fontSize: 12, fill: '#64748B' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #E2E8F0',
                            borderRadius: '6px',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                            fontSize: '14px'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="count" 
                          stroke="#475569" 
                          strokeWidth={2}
                          fill="url(#colorUsers)"
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 2, fill: '#475569' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Distribución por rol */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50">
                <CardTitle className="flex items-center gap-2 text-slate-700">
                  <Users className="h-5 w-5 text-slate-600" />
                  Distribución por Especialidad
                </CardTitle>
                <p className="text-slate-500 text-sm">Personal categorizado por rol profesional</p>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-64">
                  {rolesQ.isLoading ? (
                    <div className="animate-pulse h-full w-full rounded bg-slate-100" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rolesQ.data ?? []} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.7} />
                        <XAxis 
                          dataKey="role_name" 
                          tick={{ fontSize: 12, fill: '#64748B' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis 
                          allowDecimals={false}
                          tick={{ fontSize: 12, fill: '#64748B' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #E2E8F0',
                            borderRadius: '6px',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                            fontSize: '14px'
                          }}
                        />
                        <Bar 
                          dataKey="count" 
                          fill="#64748B"
                          radius={[3, 3, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Footer con métricas adicionales */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-lg border border-slate-200 shadow-sm p-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="space-y-1">
              <div className="text-2xl font-bold text-slate-700">
                {((kpisQ.data?.active_users / kpisQ.data?.total_users) * 100 || 0).toFixed(1)}%
              </div>
              <p className="text-sm text-slate-500">Tasa de Actividad</p>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-slate-700">
                {kpisQ.data?.new_users_last_7d || 0}
              </div>
              <p className="text-sm text-slate-500">Incorporaciones esta semana</p>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-slate-700">
                {rolesQ.data?.length || 0}
              </div>
              <p className="text-sm text-slate-500">Especialidades activas</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function KpiCard({ 
  title, 
  value, 
  gradient, 
  icon: Icon, 
  description,
  color
}: { 
  title: string; 
  value: number | undefined; 
  gradient: string; 
  icon: React.ElementType;
  description: string;
  color: string;
}) {
  const colorClasses = {
    slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200' }
  };

  const colorClass = colorClasses[color as keyof typeof colorClasses] || colorClasses.slate;

  return (
    <motion.div 
      whileHover={{ y: -2, scale: 1.01 }} 
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <Card className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600 uppercase tracking-wide">
              {title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${colorClass.bg} ${colorClass.border} border`}>
              <Icon className={`h-4 w-4 ${colorClass.text}`} />
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 space-y-2">
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold text-slate-800">
              {value?.toLocaleString('es-ES') ?? "—"}
            </div>
          </div>
          
          <p className="text-xs text-slate-500">
            {description}
          </p>
          
          {/* Indicador de carga simple */}
          {!value && (
            <div className="space-y-2">
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-slate-400 rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </div>
              <p className="text-xs text-slate-400">Cargando...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}