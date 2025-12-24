
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Table } from '../types';
import { 
  Plus, Trash2, Grid, ChartBar, Download, FileSpreadsheet, 
  ChevronDown, Undo, Redo, Printer, Type, Bold, Italic, 
  AlignLeft, Search, Filter, Sigma, Share2, MoreVertical,
  Maximize2, X, ChartBar as BarChartIcon, ChartLine as LineChartIcon, ChartArea as AreaChartIcon 
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, LineChart, 
  Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area 
} from 'recharts';
import * as XLSX from 'xlsx';

interface SpreadsheetViewProps {
  tables: Table[];
  onUpdate: (tables: Table[]) => void;
}

const CHART_COLORS = ['#22d3ee', '#a855f7', '#f472b6', '#34d399', '#fbbf24', '#ef4444'];

export const SpreadsheetView: React.FC<SpreadsheetViewProps> = ({ tables, onUpdate }) => {
  const [activeTabId, setActiveTabId] = useState<string>(tables.length > 0 ? tables[0].id : '');
  const [openChartIds, setOpenChartIds] = useState<string[]>([]);
  const [activeCell, setActiveCell] = useState<{ r: number, c: number }>({ r: 0, c: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [showChartOverlay, setShowChartOverlay] = useState(false);

  const activeTable = useMemo(() => tables.find(t => t.id === activeTabId), [tables, activeTabId]);

  // Excel Export Logic
  const exportToExcel = () => {
    if (!activeTable) return;
    const ws_data = [activeTable.headers, ...activeTable.rows];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTable.name.substring(0, 31));
    XLSX.writeFile(wb, `${activeTable.name}.xlsx`);
  };

  const createTable = () => {
    const newTable: Table = {
      id: `table-${Date.now()}`,
      name: `Sheet ${tables.length + 1}`,
      headers: Array.from({ length: 15 }, (_, i) => String.fromCharCode(65 + i)),
      rows: Array(50).fill(0).map(() => Array(15).fill(''))
    };
    onUpdate([...tables, newTable]);
    setActiveTabId(newTable.id);
  };

  const updateActiveTable = (updated: Table) => {
    onUpdate(tables.map(t => t.id === updated.id ? updated : t));
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    if (!activeTable) return;
    const newRows = [...activeTable.rows];
    newRows[rowIndex] = [...newRows[rowIndex]];
    newRows[rowIndex][colIndex] = value;
    updateActiveTable({ ...activeTable, rows: newRows });
  };

  const chartData = useMemo(() => {
    if (!activeTable) return [];
    const config = activeTable.chartConfig || { type: 'bar', xAxisCol: 0, dataCols: [1] };
    return activeTable.rows
      .filter(row => row.some(cell => cell !== '')) // Only rows with data
      .map((row, idx) => {
        const xVal = row[config.xAxisCol] || `Row ${idx + 1}`;
        const item: any = { name: xVal };
        config.dataCols.forEach(colIdx => {
          const val = parseFloat(row[colIdx]?.toString().replace(/[^0-9.-]+/g, "") || "0");
          const header = activeTable.headers[colIdx] || `Col ${colIdx}`;
          item[header] = isNaN(val) ? 0 : val;
        });
        return item;
      });
  }, [activeTable]);

  const effectiveChartConfig = activeTable?.chartConfig || { type: 'bar', xAxisCol: 0, dataCols: [1] };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-[#1f1f1f] text-zinc-900 dark:text-zinc-200 overflow-hidden font-sans select-none">
      
      {/* 1. TOP MENU BAR (Google Sheets Style) */}
      <div className="flex flex-col bg-white dark:bg-[#121214] border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between px-3 h-10">
          <div className="flex items-center gap-1">
            <div className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-emerald-600">
               <Grid className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
               <input 
                 value={activeTable?.name || 'Untitled spreadsheet'}
                 onChange={(e) => activeTable && updateActiveTable({...activeTable, name: e.target.value})}
                 className="bg-transparent border-none text-sm font-medium px-2 py-0.5 focus:ring-1 focus:ring-blue-500 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
               />
               <div className="flex gap-2 px-2 text-[10px] text-zinc-500 font-medium">
                  {['File', 'Edit', 'View', 'Insert', 'Format', 'Data', 'Tools', 'Extensions', 'Help'].map(m => (
                    <button key={m} className="hover:bg-zinc-100 dark:hover:bg-zinc-800 px-1 rounded">{m}</button>
                  ))}
               </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button className="flex items-center gap-2 px-4 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold transition-all hover:bg-blue-200 dark:hover:bg-blue-900/50">
                <Share2 className="w-3.5 h-3.5" /> Share
             </button>
             <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 border border-white/10" />
          </div>
        </div>

        {/* 2. MAIN TOOLBAR */}
        <div className="flex items-center px-3 h-11 gap-1 border-t border-zinc-200 dark:border-zinc-800 bg-[#f1f3f4] dark:bg-[#1a1a1c] overflow-x-auto no-scrollbar">
           <ToolbarBtn icon={Undo} />
           <ToolbarBtn icon={Redo} />
           <ToolbarBtn icon={Printer} />
           <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1" />
           <ToolbarBtn icon={Sigma} />
           <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1" />
           <button onClick={exportToExcel} className="flex items-center gap-1.5 px-3 py-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md text-[11px] font-bold text-emerald-600 transition-colors">
              <FileSpreadsheet className="w-4 h-4" /> Export Excel
           </button>
           <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1" />
           <ToolbarBtn icon={Bold} />
           <ToolbarBtn icon={Italic} />
           <ToolbarBtn icon={Type} />
           <ToolbarBtn icon={AlignLeft} />
           <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1" />
           <button onClick={() => setShowChartOverlay(true)} className="flex items-center gap-1.5 px-3 py-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md text-[11px] font-bold text-blue-500 transition-colors">
              <ChartBar className="w-4 h-4" /> Insert Chart
           </button>
        </div>

        {/* 3. FORMULA BAR */}
        <div className="flex items-center h-9 px-3 gap-2 border-t border-zinc-200 dark:border-zinc-800">
           <div className="flex items-center justify-center min-w-[60px] h-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded text-xs font-medium text-zinc-500">
              {String.fromCharCode(65 + activeCell.c)}{activeCell.r + 1}
           </div>
           <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1" />
           <div className="flex items-center gap-2 text-zinc-400 font-serif italic text-sm">fx</div>
           <input 
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm h-full"
              placeholder=""
              value={activeTable?.rows[activeCell.r][activeCell.c] || ''}
              onChange={(e) => handleCellChange(activeCell.r, activeCell.c, e.target.value)}
           />
        </div>
      </div>

      {/* 4. MAIN GRID */}
      <div className="flex-1 relative overflow-auto custom-scrollbar bg-white dark:bg-[#09090b]">
        {activeTable ? (
          <table className="border-collapse table-fixed min-w-full">
            <thead className="sticky top-0 z-40 shadow-sm">
              <tr className="h-7 bg-[#f8f9fa] dark:bg-[#121214]">
                <th className="w-12 border-r border-b border-zinc-200 dark:border-zinc-800 sticky left-0 z-50 bg-[#f8f9fa] dark:bg-[#121214]"></th>
                {activeTable.headers.map((h, i) => (
                  <th key={i} className="w-32 border-r border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-medium text-zinc-500 uppercase tracking-wider text-center">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeTable.rows.map((row, rIdx) => (
                <tr key={rIdx} className="h-[22px]">
                  <td className="w-12 bg-[#f8f9fa] dark:bg-[#121214] border-r border-b border-zinc-200 dark:border-zinc-800 text-center text-[10px] text-zinc-400 font-mono sticky left-0 z-30">
                    {rIdx + 1}
                  </td>
                  {row.map((cell, cIdx) => {
                    const isActive = activeCell.r === rIdx && activeCell.c === cIdx;
                    return (
                      <td 
                        key={cIdx} 
                        className={`border-r border-b border-zinc-200 dark:border-zinc-800 p-0 relative focus-within:ring-2 focus-within:ring-blue-500 focus-within:z-10 ${isActive ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                        onClick={() => setActiveCell({ r: rIdx, c: cIdx })}
                      >
                        <input 
                          value={cell}
                          onFocus={() => setIsEditing(true)}
                          onBlur={() => setIsEditing(false)}
                          onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                          className="w-full h-full bg-transparent border-none focus:ring-0 text-xs px-2 outline-none overflow-hidden text-ellipsis whitespace-nowrap"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="h-full flex flex-col items-center justify-center opacity-30">
             <Grid className="w-20 h-20 mb-4" />
             <p className="text-sm font-bold uppercase tracking-widest">No Active Sheet</p>
             <button onClick={createTable} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md text-xs font-bold uppercase">Initialize Spreadsheet</button>
          </div>
        )}
      </div>

      {/* 5. FOOTER TABS (Sheet Bar) */}
      <div className="h-9 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121214] flex items-center px-4 shrink-0 overflow-x-auto no-scrollbar">
          <button onClick={createTable} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md mr-4 text-zinc-500"><Plus className="w-4 h-4"/></button>
          <div className="flex items-center gap-0.5">
            {tables.map(table => (
              <button 
                key={table.id}
                onClick={() => setActiveTabId(table.id)}
                className={`flex items-center gap-2 px-5 py-2.5 text-xs font-medium border-x border-zinc-200 dark:border-zinc-800 transition-all ${activeTabId === table.id ? 'bg-[#f1f3f4] dark:bg-zinc-800 text-blue-600 border-b-2 border-b-blue-600' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
              >
                 {table.name}
                 <ChevronDown className="w-3 h-3 opacity-30" />
              </button>
            ))}
          </div>
      </div>

      {/* CHART OVERLAY (Fixed dimension Recharts fix) */}
      {showChartOverlay && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-8 animate-fade-in">
            <div className="w-full max-w-5xl h-[600px] bg-white dark:bg-[#0c0c0e] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10">
               <div className="h-16 px-8 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                  <div className="flex items-center gap-3">
                     <ChartBar className="w-5 h-5 text-blue-500" />
                     <h3 className="text-lg font-bold">Chart Intelligence</h3>
                  </div>
                  <button onClick={() => setShowChartOverlay(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all"><X className="w-6 h-6"/></button>
               </div>

               <div className="flex-1 flex overflow-hidden">
                  {/* Chart Config Sidebar */}
                  <div className="w-64 border-r border-zinc-200 dark:border-zinc-800 p-6 flex flex-col gap-8 shrink-0 bg-zinc-50 dark:bg-[#121214]">
                     <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest block">Type</label>
                        <div className="grid grid-cols-3 gap-2">
                           <ChartTypeBtn active={effectiveChartConfig.type === 'bar'} onClick={() => activeTable && updateActiveTable({...activeTable, chartConfig: {...effectiveChartConfig, type: 'bar'}})} icon={BarChartIcon} />
                           <ChartTypeBtn active={effectiveChartConfig.type === 'line'} onClick={() => activeTable && updateActiveTable({...activeTable, chartConfig: {...effectiveChartConfig, type: 'line'}})} icon={LineChartIcon} />
                           <ChartTypeBtn active={effectiveChartConfig.type === 'area'} onClick={() => activeTable && updateActiveTable({...activeTable, chartConfig: {...effectiveChartConfig, type: 'area'}})} icon={AreaChartIcon} />
                        </div>
                     </div>
                     <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest block">Series</label>
                        <div className="flex flex-col gap-1.5">
                           {activeTable?.headers.map((h, i) => (
                              <button 
                                key={i}
                                onClick={() => {
                                   if (!activeTable) return;
                                   const currentCols = effectiveChartConfig.dataCols;
                                   const newCols = currentCols.includes(i) ? currentCols.filter(c => c !== i) : [...currentCols, i];
                                   updateActiveTable({...activeTable, chartConfig: {...effectiveChartConfig, dataCols: newCols}});
                                }}
                                className={`text-left px-3 py-2 rounded-lg text-xs font-medium border transition-all ${effectiveChartConfig.dataCols.includes(i) ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500'}`}
                              >
                                 {h || `Col ${i}`}
                              </button>
                           ))}
                        </div>
                     </div>
                  </div>

                  {/* Chart Area - Stable Dimensions */}
                  <div className="flex-1 p-12 bg-zinc-100/30 dark:bg-black/20 flex items-center justify-center overflow-hidden">
                     <div className="w-full h-full min-h-[400px] min-w-[500px]">
                        <ResponsiveContainer width="99%" height="99%">
                            {effectiveChartConfig.type === 'line' ? (
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                    <XAxis dataKey="name" fontSize={11} axisLine={false} tickLine={false} dy={10} />
                                    <YAxis fontSize={11} axisLine={false} tickLine={false} dx={-10} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    {effectiveChartConfig.dataCols.map((idx, i) => <Line key={idx} type="monotone" dataKey={activeTable?.headers[idx]} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={3} dot={{ r: 4 }} />)}
                                </LineChart>
                            ) : effectiveChartConfig.type === 'area' ? (
                                <AreaChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                    <XAxis dataKey="name" fontSize={11} axisLine={false} tickLine={false} dy={10} />
                                    <YAxis fontSize={11} axisLine={false} tickLine={false} dx={-10} />
                                    <Tooltip />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    {effectiveChartConfig.dataCols.map((idx, i) => <Area key={idx} type="monotone" dataKey={activeTable?.headers[idx]} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.2} strokeWidth={3} />)}
                                </AreaChart>
                            ) : (
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                    <XAxis dataKey="name" fontSize={11} axisLine={false} tickLine={false} dy={10} />
                                    <YAxis fontSize={11} axisLine={false} tickLine={false} dx={-10} />
                                    <Tooltip />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    {effectiveChartConfig.dataCols.map((idx, i) => <Bar key={idx} dataKey={activeTable?.headers[idx]} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />)}
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

const ToolbarBtn: React.FC<{ icon: any, active?: boolean }> = ({ icon: Icon, active }) => (
  <button className={`p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-all ${active ? 'bg-zinc-200 text-blue-500' : 'text-zinc-600'}`}>
    <Icon className="w-4 h-4" />
  </button>
);

const ChartTypeBtn: React.FC<{ icon: any, active: boolean, onClick: () => void }> = ({ icon: Icon, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`p-3 rounded-xl border flex items-center justify-center transition-all ${active ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300'}`}
  >
    <Icon className="w-5 h-5" />
  </button>
);
