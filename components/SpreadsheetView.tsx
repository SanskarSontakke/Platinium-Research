
import React, { useState, useMemo, useEffect } from 'react';
import { Table, ChartConfig } from '../types';
import { Plus, Trash2, Table as TableIcon, MoreHorizontal, Grid, Hash, Calendar, Type as TypeIcon, AlertCircle, BarChart3, X, ExternalLink, Edit3, ChevronDown, Eye, Maximize2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from 'recharts';

interface SpreadsheetViewProps {
  tables: Table[];
  onUpdate: (tables: Table[]) => void;
}

const CHART_COLORS = ['#22d3ee', '#a855f7', '#f472b6', '#34d399', '#fbbf24', '#ef4444'];

export const SpreadsheetView: React.FC<SpreadsheetViewProps> = ({ tables, onUpdate }) => {
  // --- State ---
  const [activeTabId, setActiveTabId] = useState<string>(tables.length > 0 ? tables[0].id : '');
  const [openChartIds, setOpenChartIds] = useState<string[]>([]);
  
  // Context Menu State (Fixed Position)
  const [contextMenu, setContextMenu] = useState<{ id: string, x: number, y: number } | null>(null);
  
  // Preview Modal State
  const [previewTable, setPreviewTable] = useState<Table | null>(null);

  // Derived State
  const isChartView = activeTabId.startsWith('chart-');
  const activeTableId = isChartView ? activeTabId.replace('chart-', '') : activeTabId;
  const activeTable = tables.find(t => t.id === activeTableId);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = () => setContextMenu(null);
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // --- Data Transformation for Charts ---
  const chartData = useMemo(() => {
    if (!activeTable) return [];
    
    // Default config if missing
    const config = activeTable.chartConfig || { type: 'bar', xAxisCol: 0, dataCols: [1] };
    
    return activeTable.rows.map((row, idx) => {
        // Safety: Ensure we don't access out of bounds
        const xVal = config.xAxisCol < row.length ? row[config.xAxisCol] : `Row ${idx + 1}`;
        const item: any = { name: xVal || `Row ${idx + 1}` };
        
        config.dataCols.forEach(colIdx => {
            if (colIdx < row.length) {
                const rawVal = row[colIdx];
                // Robust Parsing: Remove non-numeric chars (except . and -), handle currency/units
                // e.g., "$4,000/kg" -> "4000", "30-32%" -> "30" (takes first number)
                const cleanStr = rawVal.replace(/,/g, '').match(/-?[\d.]+/);
                const val = cleanStr ? parseFloat(cleanStr[0]) : NaN;
                
                const header = activeTable.headers[colIdx] || `Col ${colIdx}`;
                item[header] = isNaN(val) ? 0 : val;
            }
        });
        return item;
    });
  }, [activeTable, activeTable?.chartConfig, activeTable?.rows, activeTable?.headers]);

  // --- CRUD Operations ---

  const createTable = () => {
    const newTable: Table = {
      id: `table-${Date.now()}`,
      name: `Table ${tables.length + 1}`,
      headers: ['Category', 'Value A', 'Value B'],
      columnTypes: ['text', 'number', 'number'],
      rows: [['Item 1', '10', '5'], ['Item 2', '20', '15'], ['Item 3', '15', '25']]
    };
    onUpdate([...tables, newTable]);
    setActiveTabId(newTable.id);
  };

  const updateActiveTable = (updated: Table) => {
    onUpdate(tables.map(t => t.id === updated.id ? updated : t));
    // If we renamed the table in preview, update the preview object too
    if (previewTable && previewTable.id === updated.id) {
        setPreviewTable(updated);
    }
  };

  const renameTable = (id: string) => {
    const table = tables.find(t => t.id === id);
    if (!table) return;
    const newName = prompt("Enter new table name:", table.name);
    if (newName && newName.trim()) {
        const updated = { ...table, name: newName.trim() };
        onUpdate(tables.map(t => t.id === updated.id ? updated : t));
        if (previewTable && previewTable.id === id) setPreviewTable(updated);
    }
    setContextMenu(null);
  };

  const deleteTable = (id: string) => {
    if (confirm("Are you sure you want to delete this table?")) {
        const newTables = tables.filter(t => t.id !== id);
        onUpdate(newTables);
        setOpenChartIds(prev => prev.filter(cid => cid !== id));
        if (activeTableId === id) {
            setActiveTabId(newTables[0]?.id || '');
        }
        if (previewTable?.id === id) setPreviewTable(null);
    }
    setContextMenu(null);
  };

  // --- Context Menu Handler ---
  const handleContextMenu = (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      // Calculate position relative to viewport to avoid overflow clipping
      setContextMenu({ 
          id, 
          x: e.clientX, 
          y: e.clientY 
      });
  };

  // --- Grid Handlers ---

  const updateChartConfig = (updates: Partial<ChartConfig>) => {
      if (!activeTable) return;
      const currentConfig = activeTable.chartConfig || { type: 'bar', xAxisCol: 0, dataCols: [1] };
      updateActiveTable({
          ...activeTable,
          chartConfig: { ...currentConfig, ...updates }
      });
  };

  const toggleDataCol = (idx: number) => {
      if (!activeTable) return;
      const currentConfig = activeTable.chartConfig || { type: 'bar', xAxisCol: 0, dataCols: [1] };
      const currentCols = currentConfig.dataCols;
      let newCols;
      
      if (currentCols.includes(idx)) {
          newCols = currentCols.filter(c => c !== idx);
      } else {
          newCols = [...currentCols, idx];
      }
      updateChartConfig({ dataCols: newCols });
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    if (!activeTable) return;
    const newRows = [...activeTable.rows];
    newRows[rowIndex] = [...newRows[rowIndex]];
    newRows[rowIndex][colIndex] = value;
    updateActiveTable({ ...activeTable, rows: newRows });
  };

  const handleHeaderChange = (colIndex: number, value: string) => {
    if (!activeTable) return;
    const newHeaders = [...activeTable.headers];
    newHeaders[colIndex] = value;
    updateActiveTable({ ...activeTable, headers: newHeaders });
  };

  const addRow = () => {
    if (!activeTable) return;
    const newRow = new Array(activeTable.headers.length).fill('');
    updateActiveTable({ ...activeTable, rows: [...activeTable.rows, newRow] });
  };

  const addColumn = () => {
    if (!activeTable) return;
    const newHeaders = [...activeTable.headers, `Col ${activeTable.headers.length + 1}`];
    const newTypes = [...(activeTable.columnTypes || new Array(activeTable.headers.length).fill('text')), 'text'];
    const newRows = activeTable.rows.map(r => [...r, '']);
    updateActiveTable({ ...activeTable, headers: newHeaders, columnTypes: newTypes, rows: newRows });
  };

  const toggleColumnType = (colIndex: number) => {
      if (!activeTable) return;
      const types = ['text', 'number', 'date'];
      const currentType = activeTable.columnTypes?.[colIndex] || 'text';
      const nextType = types[(types.indexOf(currentType) + 1) % types.length];
      
      const newColumnTypes = [...(activeTable.columnTypes || new Array(activeTable.headers.length).fill('text'))];
      newColumnTypes[colIndex] = nextType;
      
      updateActiveTable({ ...activeTable, columnTypes: newColumnTypes });
  };

  const getIconForType = (type: string) => {
      switch(type) {
          case 'number': return <Hash className="w-3 h-3"/>;
          case 'date': return <Calendar className="w-3 h-3"/>;
          default: return <TypeIcon className="w-3 h-3"/>;
      }
  };

  const validateCell = (value: string, type: string): boolean => {
      if (!value.trim()) return true;
      if (type === 'number') {
          // Allow loose validation for numbers to support currency symbols visually, 
          // though actual strict validation might fail. 
          // For now, let's just check if it contains a number.
          return /[0-9]/.test(value); 
      }
      if (type === 'date') return !isNaN(Date.parse(value));
      return true;
  };

  const openChartTab = () => {
      if (!activeTable) return;
      if (!openChartIds.includes(activeTable.id)) {
          setOpenChartIds([...openChartIds, activeTable.id]);
      }
      setActiveTabId(`chart-${activeTable.id}`);
  };

  // --- Render Helpers ---

  const allTabs = useMemo(() => {
      const tabs: { id: string, label: string, type: 'table' | 'chart', tableId: string }[] = [];
      tables.forEach(t => {
          tabs.push({ id: t.id, label: t.name, type: 'table', tableId: t.id });
          if (openChartIds.includes(t.id)) {
              tabs.push({ id: `chart-${t.id}`, label: `Chart: ${t.name}`, type: 'chart', tableId: t.id });
          }
      });
      return tabs;
  }, [tables, openChartIds]);

  const effectiveChartConfig = activeTable?.chartConfig || { type: 'bar', xAxisCol: 0, dataCols: [1] };

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-white overflow-hidden relative">
        {/* Tab Bar */}
        <div className="flex items-center gap-1 p-2 bg-[#09090b] border-b border-zinc-800 shrink-0 overflow-x-auto no-scrollbar">
            {allTabs.map(tab => {
                const isActive = activeTabId === tab.id;
                return (
                    <div 
                        key={tab.id}
                        onClick={() => setActiveTabId(tab.id)}
                        onContextMenu={(e) => handleContextMenu(e, tab.tableId)}
                        className={`
                            group relative flex items-center gap-2 px-3 py-2 rounded-t-lg border-b-2 text-xs font-bold uppercase transition-all cursor-pointer select-none min-w-[120px] max-w-[200px]
                            ${isActive ? 'bg-zinc-800 border-cyan-500 text-white' : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}
                        `}
                    >
                        {tab.type === 'chart' ? <BarChart3 className="w-3.5 h-3.5 text-purple-400"/> : <Grid className="w-3.5 h-3.5 text-cyan-500"/>}
                        <span className="truncate flex-1">{tab.label}</span>
                        
                        {tab.type === 'chart' ? (
                            <button 
                                onClick={(e) => { e.stopPropagation(); setOpenChartIds(prev => prev.filter(id => id !== tab.tableId)); if(isActive) setActiveTabId(tab.tableId); }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-zinc-700 rounded text-zinc-500 hover:text-white"
                            >
                                <X className="w-3 h-3"/>
                            </button>
                        ) : (
                            <button 
                                onClick={(e) => handleContextMenu(e, tab.id)}
                                className={`opacity-0 group-hover:opacity-100 p-0.5 hover:bg-zinc-700 rounded ${contextMenu?.id === tab.id ? 'opacity-100 text-white' : 'text-zinc-500'}`}
                            >
                                <MoreHorizontal className="w-3 h-3"/>
                            </button>
                        )}
                    </div>
                );
            })}
            
            <button 
                onClick={createTable} 
                className="p-2 ml-1 text-zinc-500 hover:text-cyan-400 hover:bg-zinc-900 rounded-lg transition-colors"
                title="New Table"
            >
                <Plus className="w-4 h-4"/>
            </button>
        </div>
        
        {/* Controls Bar */}
        {activeTable && !isChartView && (
            <div className="h-10 bg-[#1e1e1e] border-b border-zinc-800 flex items-center px-4 justify-between shrink-0">
                <div className="text-xs text-zinc-500 font-mono">
                    {activeTable.rows.length} rows • {activeTable.headers.length} columns
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setPreviewTable(activeTable)} className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors">
                        <Maximize2 className="w-3 h-3"/> Preview Mode
                    </button>
                    <button onClick={openChartTab} className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase bg-purple-900/20 hover:bg-purple-900/40 text-purple-400 border border-purple-500/30 rounded transition-colors">
                        <BarChart3 className="w-3 h-3"/> Visualize
                    </button>
                </div>
            </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative bg-[#18181b]">
            {activeTable ? (
                <>
                {/* TABLE VIEW */}
                <div className={`absolute inset-0 overflow-auto bg-[#1e1e1e] transition-opacity duration-300 ${isChartView ? 'opacity-0 pointer-events-none' : 'opacity-100 z-10'}`}>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="w-10 bg-zinc-900 border border-zinc-800 sticky top-0 left-0 z-20"></th>
                                {activeTable.headers.map((header, i) => {
                                    const type = activeTable.columnTypes?.[i] || 'text';
                                    return (
                                        <th key={i} className="min-w-[140px] bg-zinc-900 border border-zinc-800 p-1 sticky top-0 z-10">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center border-b border-zinc-800/50 pb-1">
                                                    <input 
                                                        value={header} 
                                                        onChange={(e) => handleHeaderChange(i, e.target.value)}
                                                        className="flex-1 bg-transparent text-center text-xs font-bold text-zinc-300 p-1 focus:outline-none focus:bg-zinc-800 rounded"
                                                        placeholder="Column Name"
                                                    />
                                                </div>
                                                <button 
                                                    onClick={() => toggleColumnType(i)}
                                                    className="flex items-center justify-center gap-1 text-[10px] text-zinc-500 hover:text-cyan-400 py-0.5 uppercase tracking-wider font-bold"
                                                >
                                                    {getIconForType(type)} {type}
                                                </button>
                                            </div>
                                        </th>
                                    );
                                })}
                                <th className="w-10 bg-zinc-900 border border-zinc-800 sticky top-0 right-0 z-20">
                                    <button onClick={addColumn} className="w-full h-full flex items-center justify-center hover:bg-zinc-800 text-zinc-500"><Plus className="w-3 h-3"/></button>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeTable.rows.map((row, rIndex) => (
                                <tr key={rIndex}>
                                    <td className="bg-zinc-900 border border-zinc-800 text-center text-xs text-zinc-500 sticky left-0 z-10 font-mono">{rIndex + 1}</td>
                                    {row.map((cell, cIndex) => {
                                        const type = activeTable.columnTypes?.[cIndex] || 'text';
                                        const isValid = validateCell(cell, type);
                                        return (
                                            <td key={cIndex} className={`border border-zinc-800 p-0 min-w-[140px] relative ${!isValid ? 'bg-red-900/10' : ''}`}>
                                                <input 
                                                    value={cell} 
                                                    onChange={(e) => handleCellChange(rIndex, cIndex, e.target.value)}
                                                    className={`w-full h-full bg-transparent text-xs text-white p-2 focus:outline-none focus:ring-1 border-none ${!isValid ? 'text-red-300 focus:ring-red-500/50' : 'focus:ring-cyan-500/50 focus:bg-cyan-900/20'}`}
                                                />
                                                {!isValid && (
                                                    <div className="absolute right-1 top-1.5 pointer-events-none group">
                                                        <AlertCircle className="w-3 h-3 text-red-500" />
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="bg-[#1e1e1e] border-b border-zinc-800"></td>
                                </tr>
                            ))}
                            <tr>
                                <td className="bg-zinc-900 border border-zinc-800 sticky left-0 z-10">
                                    <button onClick={addRow} className="w-full h-full py-2 flex items-center justify-center hover:bg-zinc-800 text-zinc-500"><Plus className="w-3 h-3"/></button>
                                </td>
                                <td colSpan={activeTable.headers.length + 1} className="bg-[#1e1e1e]"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* CHART VIEW */}
                {isChartView && (
                    <div className="absolute inset-0 bg-[#09090b] flex flex-col animate-in fade-in zoom-in-95 duration-200 z-20">
                         {/* Chart Config */}
                         <div className="p-4 border-b border-zinc-800 bg-[#0c0c0e] flex flex-col md:flex-row gap-6 items-start md:items-end justify-between shrink-0">
                            <div className="flex gap-6 w-full md:w-auto">
                                <div className="space-y-1 flex-1 md:flex-none">
                                     <label className="text-[10px] font-bold text-zinc-500 uppercase">Chart Type</label>
                                     <div className="flex bg-zinc-900 rounded p-1 border border-zinc-800">
                                         {['bar', 'line', 'area'].map(t => (
                                             <button 
                                                key={t}
                                                onClick={() => updateChartConfig({ type: t as any })}
                                                className={`flex-1 md:flex-none px-3 py-1 rounded text-[10px] font-bold uppercase transition-colors ${effectiveChartConfig.type === t ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                                             >
                                                 {t}
                                             </button>
                                         ))}
                                     </div>
                                 </div>

                                 <div className="space-y-1 flex-1 md:flex-none">
                                     <label className="text-[10px] font-bold text-zinc-500 uppercase">X-Axis</label>
                                     <select 
                                        value={effectiveChartConfig.xAxisCol}
                                        onChange={e => updateChartConfig({ xAxisCol: Number(e.target.value) })}
                                        className="w-full bg-zinc-900 text-xs text-white border border-zinc-800 rounded p-1.5 focus:outline-none"
                                     >
                                         {activeTable.headers.map((h, i) => (
                                             <option key={i} value={i}>{h}</option>
                                         ))}
                                     </select>
                                 </div>

                                 <div className="space-y-1 relative group flex-1 md:flex-none">
                                     <label className="text-[10px] font-bold text-zinc-500 uppercase">Series</label>
                                     <div className="w-full md:w-48 bg-zinc-900 text-xs text-zinc-300 border border-zinc-800 rounded p-1.5 cursor-pointer hover:border-zinc-600 flex justify-between items-center">
                                         <span>{effectiveChartConfig.dataCols.length} Selected</span>
                                         <ChevronDown className="w-3 h-3"/>
                                     </div>
                                     <div className="absolute top-full left-0 w-full md:w-48 bg-zinc-800 border border-zinc-700 rounded shadow-xl p-2 hidden group-hover:block z-50">
                                         {activeTable.headers.map((h, i) => (
                                             <label key={i} className="flex items-center gap-2 p-1.5 hover:bg-zinc-700 rounded cursor-pointer">
                                                 <input 
                                                    type="checkbox" 
                                                    checked={effectiveChartConfig.dataCols.includes(i)}
                                                    onChange={() => toggleDataCol(i)}
                                                    disabled={i === effectiveChartConfig.xAxisCol}
                                                    className="rounded bg-black border-zinc-600"
                                                 />
                                                 <span className="text-xs text-zinc-300">{h}</span>
                                             </label>
                                         ))}
                                     </div>
                                 </div>
                            </div>
                         </div>
                         
                         {/* Chart Body */}
                         <div className="flex-1 p-6 min-h-0 relative bg-[#09090b]">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    {effectiveChartConfig.type === 'line' ? (
                                        <RechartsLineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                            <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                                            <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: '#fff' }} />
                                            <Legend />
                                            {effectiveChartConfig.dataCols.map((colIdx, i) => (
                                                <Line key={colIdx} type="monotone" dataKey={activeTable.headers[colIdx] || `Col ${colIdx}`} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 4, strokeWidth: 0, fill: CHART_COLORS[i % CHART_COLORS.length] }} activeDot={{ r: 6 }} />
                                            ))}
                                        </RechartsLineChart>
                                    ) : effectiveChartConfig.type === 'area' ? (
                                        <AreaChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                            <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                                            <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: '#fff' }} />
                                            <Legend />
                                            {effectiveChartConfig.dataCols.map((colIdx, i) => (
                                                <Area key={colIdx} type="monotone" dataKey={activeTable.headers[colIdx] || `Col ${colIdx}`} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.3} />
                                            ))}
                                        </AreaChart>
                                    ) : (
                                        <BarChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                            <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                                            <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: '#fff' }} />
                                            <Legend />
                                            {effectiveChartConfig.dataCols.map((colIdx, i) => (
                                                <Bar key={colIdx} dataKey={activeTable.headers[colIdx] || `Col ${colIdx}`} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
                                            ))}
                                        </BarChart>
                                    )}
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                                    <BarChart3 className="w-12 h-12 mb-4 opacity-20"/>
                                    <p className="text-sm">No valid numeric data found for selected columns.</p>
                                    <p className="text-xs mt-2 text-zinc-600">Ensure cells contain numbers (e.g. 120, $500, 30%).</p>
                                </div>
                            )}
                         </div>
                    </div>
                )}
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                    <TableIcon className="w-16 h-16 mb-4 opacity-20"/>
                    <p className="text-sm">No tables open.</p>
                    <button onClick={createTable} className="mt-4 px-4 py-2 bg-zinc-800 text-white rounded hover:bg-zinc-700 uppercase font-bold text-xs tracking-wider">Create First Table</button>
                </div>
            )}
        </div>

        {/* --- PORTALS & OVERLAYS --- */}

        {/* Fixed Position Context Menu */}
        {contextMenu && (
            <div 
                className="fixed z-[100] w-40 bg-[#18181b] border border-zinc-700 rounded-lg shadow-2xl flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-left"
                style={{ top: contextMenu.y, left: contextMenu.x }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-500 uppercase border-b border-zinc-800 mb-1">
                    Table Actions
                </div>
                <button onClick={() => renameTable(contextMenu.id)} className="px-3 py-2 text-left text-[11px] font-bold text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2">
                    <Edit3 className="w-3.5 h-3.5"/> Rename
                </button>
                <button onClick={() => { setPreviewTable(tables.find(t=>t.id===contextMenu.id)||null); setContextMenu(null); }} className="px-3 py-2 text-left text-[11px] font-bold text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5"/> Preview
                </button>
                <div className="h-px bg-zinc-800 my-1"/>
                <button onClick={() => deleteTable(contextMenu.id)} className="px-3 py-2 text-left text-[11px] font-bold text-red-400 hover:bg-red-950/30 flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5"/> Delete
                </button>
            </div>
        )}

        {/* Full Screen Preview Modal */}
        {previewTable && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-200">
                <div className="w-full h-full max-w-6xl bg-[#09090b] rounded-xl border border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
                    {/* Modal Header */}
                    <div className="h-14 border-b border-zinc-800 bg-[#0c0c0e] flex items-center justify-between px-6 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-cyan-900/30 rounded border border-cyan-800 text-cyan-400">
                                <TableIcon className="w-4 h-4"/>
                            </div>
                            <span className="text-sm font-bold text-white tracking-tight">{previewTable.name}</span>
                            <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-500 font-mono">
                                Read-Only
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                             <button onClick={() => renameTable(previewTable.id)} className="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors" title="Rename">
                                <Edit3 className="w-4 h-4"/>
                             </button>
                             <button onClick={() => deleteTable(previewTable.id)} className="p-2 hover:bg-red-950/30 rounded text-zinc-400 hover:text-red-500 transition-colors" title="Delete">
                                <Trash2 className="w-4 h-4"/>
                             </button>
                             <div className="w-px h-6 bg-zinc-800 mx-2"/>
                             <button onClick={() => setPreviewTable(null)} className="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors">
                                <X className="w-5 h-5"/>
                             </button>
                        </div>
                    </div>

                    {/* Modal Body (Scrollable Table) */}
                    <div className="flex-1 overflow-auto bg-[#1e1e1e] p-8">
                        <div className="inline-block min-w-full align-middle">
                            <table className="min-w-full border-collapse shadow-lg">
                                <thead>
                                    <tr>
                                        <th className="w-12 bg-zinc-900 border border-zinc-700/50 p-3 text-center text-xs font-mono text-zinc-500">#</th>
                                        {previewTable.headers.map((h, i) => (
                                            <th key={i} className="bg-zinc-900 border border-zinc-700/50 px-4 py-3 text-left text-xs font-bold text-zinc-300 uppercase tracking-wider">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewTable.rows.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                                            <td className="bg-zinc-900/50 border border-zinc-700/50 p-3 text-center text-xs font-mono text-zinc-500">{idx + 1}</td>
                                            {row.map((cell, cIdx) => (
                                                <td key={cIdx} className="border border-zinc-700/50 px-4 py-3 text-sm text-zinc-300">
                                                    {cell}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
