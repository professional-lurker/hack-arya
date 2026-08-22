"use client";

import { useState, useEffect } from "react";
import { FolderOpen, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface Project {
  id: string; name: string; description?: string | null; createdAt: string;
  _count: { sandboxKeys: number; testSessions: number };
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const fetchProjects = async () => {
    const res = await fetch("/api/v1/projects");
    if (res.ok) { const d = await res.json(); setProjects(d.projects); }
    setLoading(false);
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchProjects(), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast({ title: "Project name is required", variant: "destructive" }); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/v1/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        await fetchProjects();
        setShowModal(false);
        setForm({ name: "", description: "" });
        toast({ title: "Project created" });
      }
    } finally { setCreating(false); }
  };

  const inputCls = "w-full bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-[hsl(var(--muted-foreground))] text-sm mt-1">Organize your AI integration testing.</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <Plus className="w-4 h-4" /> New Project
        </Button>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Create Project</h2>
            <div>
              <label className="block text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">Project Name</label>
              <input className={inputCls} placeholder="AI Resume Analyzer" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">Description (optional)</label>
              <input className={inputCls} placeholder="What are you building?" value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 border-[hsl(var(--border))]" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Project"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : projects.length === 0 ? (
        <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <CardContent className="py-16 text-center">
            <FolderOpen className="w-10 h-10 text-[hsl(var(--muted-foreground))] mx-auto mb-3" />
            <p className="text-white font-medium">No projects yet</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Create a project to organize your testing sessions.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map(project => (
            <Card key={project.id} className="border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-blue-400/30 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center">
                    <FolderOpen className="w-4 h-4 text-blue-400" />
                  </div>
                  <CardTitle className="text-white text-base">{project.name}</CardTitle>
                </div>
                {project.description && <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{project.description}</p>}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-[10px] border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]">
                    {project._count.sandboxKeys} keys
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]">
                    {project._count.testSessions} sessions
                  </Badge>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))] ml-auto">
                    {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
