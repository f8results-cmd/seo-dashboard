'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import type { ClientTask } from '@/lib/types';
import { Plus, CheckCircle, Circle, ChevronDown } from 'lucide-react';

const PRIORITY_BAR: Record<string, string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-400',
  low:    'bg-blue-400',
};

const PRIORITY_LABEL: Record<string, string> = {
  high:   'text-red-600',
  medium: 'text-amber-600',
  low:    'text-blue-600',
};

interface TaskWithClient extends ClientTask {
  clients: { business_name: string; id: string } | null;
}

export default function TodoPage() {
  const [tasks, setTasks]       = useState<TaskWithClient[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding]     = useState(false);
  const [desc, setDesc]         = useState('');
  const [dueDate, setDueDate]   = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [clientId, setClientId] = useState('');
  const [clients, setClients]   = useState<{ id: string; business_name: string }[]>([]);

  const supabase = createClient();
  const today = startOfDay(new Date());

  const load = useCallback(async () => {
    const [{ data: taskData }, { data: clientData }] = await Promise.all([
      supabase.from('client_tasks').select('*, clients(id, business_name)').order('due_date').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, business_name').order('business_name'),
    ]);
    setTasks((taskData ?? []) as TaskWithClient[]);
    setClients((clientData ?? []) as { id: string; business_name: string }[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!desc.trim()) return;
    await supabase.from('client_tasks').insert({
      client_id: clientId || null,
      description: desc.trim(),
      due_date: dueDate || null,
      priority,
      completed: false,
    });
    setDesc(''); setDueDate(''); setPriority('medium'); setClientId('');
    setAdding(false);
    load();
  }

  async function toggle(task: TaskWithClient) {
    await supabase.from('client_tasks').update({ completed: !task.completed }).eq('id', task.id);
    setTasks(ts => ts.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
  }

  async function remove(id: string) {
    await supabase.from('client_tasks').delete().eq('id', id);
    setTasks(ts => ts.filter(t => t.id !== id));
  }

  const open = tasks.filter(t => !t.completed);
  const done = tasks.filter(t => t.completed);

  function TaskCard({ task }: { task: TaskWithClient }) {
    const overdue = !task.completed && task.due_date && isBefore(parseISO(task.due_date), today);
    return (
      <div className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
        task.completed ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-gray-200 bg-white'
      }`}>
        <span className={`w-1 self-stretch rounded-full flex-shrink-0 ${PRIORITY_BAR[task.priority] ?? 'bg-gray-200'}`} />
        <button onClick={() => toggle(task)} className="mt-0.5 flex-shrink-0 text-gray-300 hover:text-green-500 transition-colors">
          {task.completed ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Circle className="w-5 h-5" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {task.description}
          </p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {task.clients && (
              <Link href={`/agency/clients/${task.clients.id}?tab=todo`} className="text-xs text-[#E8622A] hover:underline">
                {task.clients.business_name}
              </Link>
            )}
            <span className={`text-xs font-medium capitalize ${PRIORITY_LABEL[task.priority] ?? ''}`}>
              {task.priority}
            </span>
            {task.due_date && (
              <span className={`text-xs ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                {overdue ? 'Overdue · ' : ''}{format(parseISO(task.due_date), 'd MMM yyyy')}
              </span>
            )}
          </div>
        </div>
        <button onClick={() => remove(task.id)} className="text-gray-300 hover:text-red-400 text-xs mt-0.5 flex-shrink-0">✕</button>
      </div>
    );
  }

  if (loading) return <div className="p-6 text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">To Do</h1>
        <button
          onClick={() => setAdding(a => !a)}
          className="flex items-center gap-2 bg-[#E8622A] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#d05520] transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <form onSubmit={addTask} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">New task</h3>
          <input
            autoFocus
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Task description…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
          />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Client (optional)</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none">
                <option value="">None</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Due date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as 'high' | 'medium' | 'low')} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-[#1a2744] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#243460] transition-colors">Save</button>
            <button type="button" onClick={() => setAdding(false)} className="text-gray-400 text-sm px-4 py-2">Cancel</button>
          </div>
        </form>
      )}

      {/* Open tasks */}
      <div className="space-y-2">
        {open.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No open tasks. Nice work!</p>
        )}
        {open.map(task => <TaskCard key={task.id} task={task} />)}
      </div>

      {/* Completed */}
      {done.length > 0 && (
        <div>
          <button
            onClick={() => setShowDone(s => !s)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-3"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showDone ? '' : '-rotate-90'}`} />
            Completed ({done.length})
          </button>
          {showDone && (
            <div className="space-y-2">
              {done.map(task => <TaskCard key={task.id} task={task} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
