"use client";

import React, { useMemo } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { getOwaspCategory, SEVERITY_COLORS } from '@/lib/owasp';

interface ChartProps {
  scanData: any[];
  historyTrend: any[];
}

export function OverallPassratePie({ df }: { df: any[] }) {
  const total = df.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const failed = df.reduce((acc, curr) => acc + (curr.failed || 0), 0);
  const passed = total - failed;

  const data = [
    { name: 'Защищено (Pass)', value: passed, color: '#2ECC71' },
    { name: 'Взломано (Fail)', value: failed, color: '#FF4B4B' },
  ];

  const renderLabel = (entry: any) => {
    const percent = ((entry.value / total) * 100).toFixed(1);
    return `${entry.value} (${percent}%)`;
  };

  return (
    <Card className="bg-transparent border-0 shadow-none w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-[#222222] drop-shadow-sm">Общий статус тестов</CardTitle>
        <CardDescription className="text-[#45515e] text-base font-medium">Распределение результатов Red Team тестирования</CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={data}
              innerRadius={80}
              outerRadius={130}
              paddingAngle={5}
              dataKey="value"
              label={renderLabel}
              labelLine={true}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                color: '#222222'
              }}
              labelStyle={{ color: '#222222', fontWeight: 600 }}
              formatter={(value: any) => [`${value} тестов`, '']}
            />
            <Legend
              wrapperStyle={{ color: '#222222', fontWeight: 500 }}
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function AsrByOwaspBar({ df }: { df: any[] }) {
  const data = useMemo(() => {
    const categories: Record<string, any> = {};
    df.forEach((row) => {
      const cat = getOwaspCategory(row.vulnerability);
      if (!categories[cat.id]) {
        categories[cat.id] = { id: cat.id, name: cat.name, totalAsr: 0, count: 0 };
      }
      categories[cat.id].totalAsr += (row.asr || 0);
      categories[cat.id].count += 1;
    });

    return Object.values(categories).map((c: any) => ({
      name: `[${c.id}] ${c.name}`,
      ASR: Number(((c.totalAsr / c.count) * 100).toFixed(1)),
      fill: c.totalAsr / c.count > 0.2 ? '#FF4B4B' : (c.totalAsr / c.count > 0 ? '#FFC300' : '#2ECC71')
    })).sort((a, b) => b.ASR - a.ASR);
  }, [df]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>ASR по категориям OWASP</CardTitle>
        <CardDescription>Доля успешных атак по каждой категории. Меньше - лучше.</CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 200, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" unit="%" />
            <YAxis dataKey="name" type="category" width={180} />
            <Tooltip formatter={(value) => `${value}%`} />
            <Bar dataKey="ASR" fill="#8884d8">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function PassrateTrendLine({ history }: { history: any[] }) {
  if (!history || history.length === 0) return null;

  const data = useMemo(() => {
    return history.map(row => ({
      date: new Date(row.timestamp).toLocaleDateString(),
      PassRate: Number((row.pass_rate * 100).toFixed(1)),
    }));
  }, [history]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Тренд защищенности (Pass Rate)</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPass" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2ECC71" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#2ECC71" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="date" />
            <YAxis unit="%" />
            <CartesianGrid strokeDasharray="3 3" />
            <Tooltip formatter={(value) => `${value}%`} />
            <Area type="monotone" dataKey="PassRate" stroke="#2ECC71" fillOpacity={1} fill="url(#colorPass)" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
