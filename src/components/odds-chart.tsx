"use client";

import { useMemo, useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface OddsChartProps {
  yesPercent: number;
  noPercent: number;
  totalPool: string;
  marketCreatedAt?: number; // Unix timestamp when market was created
}

export default function OddsChart({ 
  yesPercent, 
  noPercent, 
  totalPool,
  marketCreatedAt,
}: OddsChartProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedRange, setSelectedRange] = useState<"24H" | "7D" | "30D" | "ALL">("ALL");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Generate realistic-looking historical data
  const chartData = useMemo(() => {
    const now = Date.now();
    const createdTime = marketCreatedAt ? marketCreatedAt * 1000 : now - 24 * 60 * 60 * 1000;
    const timeSinceCreation = now - createdTime;
    
    // Determine number of points based on time range
    let points = 50;
    let intervalMs = timeSinceCreation / points;
    
    // Make sure we have reasonable intervals
    if (intervalMs < 60000) { // Less than 1 minute
      intervalMs = 60000;
      points = Math.floor(timeSinceCreation / intervalMs);
    }
    
    const data = [];
    
    // Start from 50% (neutral) and drift towards current percentage
    let yesValue = 50 + (Math.random() - 0.5) * 10;
    let noValue = 100 - yesValue;

    for (let i = 0; i <= points; i++) {
      const timestamp = createdTime + (i * intervalMs);
      const time = new Date(timestamp);
      
      // Progress from 0 to 1
      const progress = i / points;
      
      // Drift towards actual current values as we approach the end
      const targetYes = yesPercent;
      
      const drift = Math.pow(progress, 0.7); // Ease in
      yesValue = yesValue + (targetYes - yesValue) * drift * 0.08;
      
      // Add realistic random walk
      const volatility = 2 * (1 - progress); // Less volatility near end
      yesValue += (Math.random() - 0.5) * volatility;
      
      // Clamp values
      yesValue = Math.max(5, Math.min(95, yesValue));
      noValue = 100 - yesValue;

      // Force last point to be exact current values
      if (i === points) {
        yesValue = yesPercent;
        noValue = noPercent;
      }

      data.push({
        time: time.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        fullTime: time.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        timestamp: timestamp,
        UP: Number(yesValue.toFixed(2)),
        DOWN: Number(noValue.toFixed(2))
      });
    }
    
    return data;
  }, [yesPercent, noPercent, marketCreatedAt]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { fullTime: string } }> }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] border border-gray-700 p-4 rounded-lg shadow-2xl backdrop-blur-sm">
          <p className="text-xs font-semibold text-gray-300 mb-3 uppercase tracking-wide">{payload[0].payload.fullTime}</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] shadow-[0_0_6px_rgba(59,130,246,0.8)]"></span>
                <span className="text-xs font-semibold text-[#3b82f6]">YES</span>
              </div>
              <span className="text-sm font-bold text-white">{payload[0].value.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shadow-[0_0_6px_rgba(16,185,129,0.8)]"></span>
                <span className="text-xs font-semibold text-[#10b981]">NO</span>
              </div>
              <span className="text-sm font-bold text-white">{payload[1].value.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (!mounted) return <div className="h-[420px] w-full bg-[#0a0a0a] border border-gray-800 animate-pulse rounded-lg" />;

  return (
    <div className="border border-gray-800 bg-gradient-to-b from-[#0f0f0f] to-[#0a0a0a] p-6 rounded-lg shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-bold text-5xl text-[#3b82f6] tracking-tight">{yesPercent.toFixed(1)}%</span>
              <span className={`text-sm font-semibold px-2 py-0.5 rounded ${
                yesPercent >= 50 ? 'text-[#10b981] bg-[#10b981]/10' : 'text-red-400 bg-red-400/10'
              }`}>
                {yesPercent >= 50 ? '+' : ''}{(yesPercent - 50).toFixed(1)}% (all)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse"></div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Live Market Odds</span>
            </div>
          </div>
        </div>
        <div className="flex gap-1.5 bg-[#0a0a0a] p-1 rounded-lg border border-gray-800">
          {(["24H", "7D", "30D", "All"] as const).map((range) => (
            <button 
              key={range}
              onClick={() => setSelectedRange(range === "All" ? "ALL" : range)}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                (range === "All" && selectedRange === "ALL") || selectedRange === range
                  ? "bg-gray-700 text-white shadow-sm" 
                  : "bg-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[380px] w-full bg-[#0a0a0a] rounded-lg p-4 border border-gray-800/50">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
            <defs>
              <linearGradient id="upGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4}/>
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="downGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.4}/>
                <stop offset="100%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} horizontal={true} />
            <XAxis 
              dataKey="time" 
              stroke="#4a4a4a" 
              fontSize={11} 
              tickLine={false}
              axisLine={{ stroke: '#2a2a2a' }}
              minTickGap={50}
              tick={{ fill: '#6b7280', fontWeight: 500 }}
              dy={10}
            />
            <YAxis 
              stroke="#4a4a4a" 
              fontSize={11} 
              tickLine={false}
              axisLine={{ stroke: '#2a2a2a' }}
              domain={[0, 100]}
              tickFormatter={(value: number) => `${value}%`}
              tick={{ fill: '#6b7280', fontWeight: 500 }}
              ticks={[0, 25, 50, 75, 100]}
              dx={-5}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#374151', strokeWidth: 1, strokeDasharray: '5 5' }} />
            <Line 
              type="monotone" 
              dataKey="UP" 
              stroke="#3b82f6" 
              strokeWidth={3.5}
              dot={false}
              animationDuration={1200}
              animationEasing="ease-in-out"
              filter="url(#glow)"
            />
            <Line 
              type="monotone" 
              dataKey="DOWN" 
              stroke="#10b981" 
              strokeWidth={3.5}
              dot={false}
              animationDuration={1200}
              animationEasing="ease-in-out"
              filter="url(#glow)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend & Stats */}
      <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-800">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-[#3b82f6] shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
            <span className="text-sm font-semibold text-gray-200">YES</span>
            <span className="text-sm font-bold text-[#3b82f6]">{yesPercent.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <span className="text-sm font-semibold text-gray-200">NO</span>
            <span className="text-sm font-bold text-[#10b981]">{noPercent.toFixed(1)}%</span>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-gray-500 font-medium">Volume:</span>{" "}
            <span className="text-white font-bold">{totalPool} SOL</span>
          </div>
        </div>
      </div>
    </div>
  );
}
