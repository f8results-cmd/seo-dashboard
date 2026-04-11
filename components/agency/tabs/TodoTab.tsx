'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Check, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format, isToday, isPast, parseISO } from 'date-fns';
import type { ClientTask, TaskPriority } from '@/lib/types';

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-400',
  low:    'bg-blue-400',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'High', medium: 'Medium', low: 'Low',
};

export default function TodoTab({ clientId }: { clientId: string }) {
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [desc, setDesc] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('client_tasks')
      .select('*')
      .eq('client_id', clientId)
      .order('due_date', { ascending: true, nullsFirst: false });
    setTasks((data ?? []) as ClientTask[]);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!desc.trim()) return;
    setSaving(true);
    await supabase.from('client_tasks').insert({
      client_id: clientId,
      description: desc.trim(),
      due_date: dueDate || null,
      priority,
    });
    setDesc(''); setDueDate(''); setPriority('medium'); setShowForm(false);
    setSaving(false);
    load();
  }

  async function toggleDone(task: ClientTask) {
    await supabase.from('client_tasks').update({ completed: !task.completed }).eq('id', task.id);
    load();
  }

  const open = tasks.filter(t => !t.completed);
  const done = tasks.filter(t => t.completed);

  function isOverdue(t: ClientTask) {
    return !t.completed && t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date));
  }

  if (loading) return <div className="p-6 text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Tasks</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 text-sm bg-[#E8622A] text-white px-3 py-1.5 rounded-lg hover:bg-[#d05520] transition-colors"
        >
          <Plus className="w-4 h-4" /> Add task
        </button>
      </div>

      {showForm && (
        <form onSubmit={addTask} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <input
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Task description…"
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
            required
          />
          <div className="flex gap-3">
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
            />
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as TaskPriority)}
              className="border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button
              type="submit"
              disabled={saving}
              className="ml-auto bg-[#1a2744] text-white px-4 py-2 rounded text-sm hover:bg-[#243460] transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {open.length === 0 && (
        <p className="text-sm text-gray-400 py-4 text-center">No open tasks — add one above.</p>
      )}

      <div className="space-y-2">
        {open.map(task => (
          <div
            key={task.id}
            className={`flex items-start gap-3 bg-white border rounded-lg px-4 py-3 ${isOverdue(task) ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}
          >
            <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${PRIORITY_STYLES[task.priority]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800">{task.description}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs font-medium ${PRIORITY_STYLES[task.priority].replace('bg-', 'text-').replace('-500', '-600').replace('-400', '-600')}`}>
                  {PRIORITY_LABELS[task.priority]}
                </span>
                {task.due_date && (
                  <span className={`text-xs ${isOverdue(task) ? 'text-red-600 font-medium flex items-center gap-1' : 'text-gray-400'}`}>
                    {isOverdue(task) && <AlertCircle className="w-3 h-3" />}
                    {format(parseISO(task.due_date), 'd MMM yyyy')}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => toggleDone(task)}
              className="flex-shrink-0 w-5 h-5 border-2 border-gray-300 rounded hover:border-green-500 transition-colors mt-0.5"
              aria-label="Mark done"
            />
          </div>
        ))}
      </div>

      {done.length > 0 && (
        <details className="mt-4">
          <summary className="text-sm text-gray-400 cursor-pointer select-none">
            {done.length} completed task{done.length !== 1 ? 's' : ''}
          </summary>
          <div className="space-y-2 mt-2">
            {done.map(task => (
              <div key={task.id} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 opacity-60">
                <button onClick={() => toggleDone(task)} className="flex-shrink-0 text-green-500">
                  <Check className="w-5 h-5" />
                </button>
                <p className="text-sm text-gray-500 line-through">{task.description}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
