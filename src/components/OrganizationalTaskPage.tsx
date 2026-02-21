import { useEffect, useMemo, useState } from "react";
import {
  LayoutGrid,
  Table,
  Plus,
  Pencil,
  Trash2,
  Users,
  ShieldCheck,
  UserCheck,
  Handshake,
  FileText,
  Landmark,
  Lightbulb,
  Megaphone,
  Building2,
  CircleDot,
  HeartHandshake,
  Hourglass,
  ListChecks,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button, DESIGN_TOKENS, PageLayout } from "./design-system";
import {
  deleteOrganizationalTask,
  getCommitteeTasks,
  getTaskCommittees,
  saveOrganizationalTask,
  type TaskChecklistItem,
  type OrganizationalTask,
  type SaveOrganizationalTaskPayload,
} from "../services/gasTaskService";

interface OrganizationalTaskPageProps {
  onClose: () => void;
  isDark: boolean;
  username?: string;
}

type ViewMode = "tile" | "table";

const EMPTY_FORM: SaveOrganizationalTaskPayload = {
  committeeId: "",
  committeeName: "",
  title: "",
  description: "",
  priority: "Medium",
  status: "Not Started",
  dueDate: "",
  assignee: "",
  checklist: [],
};

type CommitteeVisual = {
  icon: LucideIcon;
  iconColor: string;
  accent: string;
  lightBackground: string;
  darkBackground: string;
};

const COMMITTEE_VISUALS: Record<string, CommitteeVisual> = {
  "executive-board": {
    icon: ShieldCheck,
    iconColor: "#f59e0b",
    accent: "#f59e0b",
    lightBackground: "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(255,255,255,0.88) 100%)",
    darkBackground: "linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(30,41,59,0.75) 100%)",
  },
  "membership-internal-affairs": {
    icon: UserCheck,
    iconColor: "#2563eb",
    accent: "#2563eb",
    lightBackground: "linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(255,255,255,0.88) 100%)",
    darkBackground: "linear-gradient(135deg, rgba(37,99,235,0.2) 0%, rgba(30,41,59,0.75) 100%)",
  },
  "external-relations": {
    icon: Handshake,
    iconColor: "#16a34a",
    accent: "#16a34a",
    lightBackground: "linear-gradient(135deg, rgba(22,163,74,0.12) 0%, rgba(255,255,255,0.88) 100%)",
    darkBackground: "linear-gradient(135deg, rgba(22,163,74,0.2) 0%, rgba(30,41,59,0.75) 100%)",
  },
  "secretariat-documentation": {
    icon: FileText,
    iconColor: "#6366f1",
    accent: "#6366f1",
    lightBackground: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(255,255,255,0.88) 100%)",
    darkBackground: "linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(30,41,59,0.75) 100%)",
  },
  "finance-treasury": {
    icon: Landmark,
    iconColor: "#0d9488",
    accent: "#0d9488",
    lightBackground: "linear-gradient(135deg, rgba(13,148,136,0.12) 0%, rgba(255,255,255,0.88) 100%)",
    darkBackground: "linear-gradient(135deg, rgba(13,148,136,0.2) 0%, rgba(30,41,59,0.75) 100%)",
  },
  "program-development": {
    icon: Lightbulb,
    iconColor: "#f97316",
    accent: "#f97316",
    lightBackground: "linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(255,255,255,0.88) 100%)",
    darkBackground: "linear-gradient(135deg, rgba(249,115,22,0.2) 0%, rgba(30,41,59,0.75) 100%)",
  },
  "communications-marketing": {
    icon: Megaphone,
    iconColor: "#ec4899",
    accent: "#ec4899",
    lightBackground: "linear-gradient(135deg, rgba(236,72,153,0.12) 0%, rgba(255,255,255,0.88) 100%)",
    darkBackground: "linear-gradient(135deg, rgba(236,72,153,0.2) 0%, rgba(30,41,59,0.75) 100%)",
  },
  "barangay-chapter-leaders": {
    icon: Building2,
    iconColor: "#22c55e",
    accent: "#22c55e",
    lightBackground: "linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(255,255,255,0.88) 100%)",
    darkBackground: "linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(30,41,59,0.75) 100%)",
  },
  "general-members": {
    icon: CircleDot,
    iconColor: "#64748b",
    accent: "#64748b",
    lightBackground: "linear-gradient(135deg, rgba(100,116,139,0.14) 0%, rgba(255,255,255,0.88) 100%)",
    darkBackground: "linear-gradient(135deg, rgba(100,116,139,0.22) 0%, rgba(30,41,59,0.75) 100%)",
  },
  volunteers: {
    icon: HeartHandshake,
    iconColor: "#ef4444",
    accent: "#ef4444",
    lightBackground: "linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(255,255,255,0.88) 100%)",
    darkBackground: "linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(30,41,59,0.75) 100%)",
  },
  "probationary-members": {
    icon: Hourglass,
    iconColor: "#a855f7",
    accent: "#a855f7",
    lightBackground: "linear-gradient(135deg, rgba(168,85,247,0.12) 0%, rgba(255,255,255,0.88) 100%)",
    darkBackground: "linear-gradient(135deg, rgba(168,85,247,0.2) 0%, rgba(30,41,59,0.75) 100%)",
  },
};

const FALLBACK_COMMITTEE_VISUAL: CommitteeVisual = {
  icon: Users,
  iconColor: "#f97316",
  accent: "#f97316",
  lightBackground: "linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(255,255,255,0.88) 100%)",
  darkBackground: "linear-gradient(135deg, rgba(249,115,22,0.2) 0%, rgba(30,41,59,0.75) 100%)",
};

export default function OrganizationalTaskPage({
  onClose,
  isDark,
  username = "",
}: OrganizationalTaskPageProps) {
  const [committees, setCommittees] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCommittee, setSelectedCommittee] = useState<{ id: string; name: string } | null>(null);
  const [tasks, setTasks] = useState<OrganizationalTask[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("tile");
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SaveOrganizationalTaskPayload>(EMPTY_FORM);
  const [checklistInput, setChecklistInput] = useState("");

  const actions = selectedCommittee ? (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setViewMode(viewMode === "table" ? "tile" : "table")}
        className="px-3 py-2 rounded-lg flex items-center gap-2 transition-all"
        style={{
          background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)`,
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {viewMode === "table" ? <LayoutGrid className="w-4 h-4" /> : <Table className="w-4 h-4" />}
        <span className="hidden sm:inline">{viewMode === "table" ? "Tile View" : "Table View"}</span>
      </button>
      <Button
        size="sm"
        variant="secondary"
        icon={<Plus className="w-4 h-4" />}
        onClick={() => {
          setForm({
            ...EMPTY_FORM,
            committeeId: selectedCommittee.id,
            committeeName: selectedCommittee.name,
          });
          setChecklistInput("");
          setShowForm(true);
        }}
      >
        Add Task
      </Button>
    </div>
  ) : null;

  const pageTitle = selectedCommittee ? `${selectedCommittee.name} Tasks` : "Organizational Task";
  const pageSubtitle = selectedCommittee
    ? "Manage committee-specific work items"
    : "Committees";

  useEffect(() => {
    let mounted = true;
    getTaskCommittees()
      .then((data) => {
        if (mounted) setCommittees(data);
      })
      .catch(() => {
        if (mounted) setCommittees([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedCommittee) return;
    let mounted = true;
    setIsLoading(true);
    getCommitteeTasks(selectedCommittee.id)
      .then((data) => {
        if (mounted) setTasks(data);
      })
      .catch((error: Error) => {
        if (mounted) {
          setTasks([]);
          toast.error(error.message || "Failed to load tasks");
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [selectedCommittee]);

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort(
        (a, b) =>
          new Date(b.UpdatedAt || b.CreatedAt || "").getTime() -
          new Date(a.UpdatedAt || a.CreatedAt || "").getTime()
      ),
    [tasks]
  );

  const handleSave = async () => {
    if (!form.title?.trim() || !form.committeeId) {
      toast.error("Title and committee are required");
      return;
    }
    try {
      setIsLoading(true);
      const saved = await saveOrganizationalTask({
        ...form,
        checklist: (form.checklist || []).filter((item) => String(item.text || "").trim() !== ""),
        username,
      });
      setTasks((prev) => {
        const existing = prev.findIndex((item) => item.TaskID === saved.TaskID);
        if (existing === -1) return [saved, ...prev];
        const copy = [...prev];
        copy[existing] = saved;
        return copy;
      });
      setShowForm(false);
      toast.success("Task saved");
    } catch (error) {
      toast.error((error as Error).message || "Failed to save task");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (task: OrganizationalTask) => {
    setForm({
      taskId: task.TaskID,
      committeeId: task.CommitteeId,
      committeeName: task.CommitteeName,
      title: task.Title,
      description: task.Description,
      priority: task.Priority,
      status: task.Status,
      dueDate: task.DueDate,
      assignee: task.Assignee,
      checklist: task.Checklist || [],
    });
    setChecklistInput("");
    setShowForm(true);
  };

  const handleAddChecklistItem = () => {
    const text = checklistInput.trim();
    if (!text) return;
    const newItem: TaskChecklistItem = {
      id: `chk-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
      text,
      done: false,
    };
    setForm((prev) => ({
      ...prev,
      checklist: [...(prev.checklist || []), newItem],
    }));
    setChecklistInput("");
  };

  const handleToggleFormChecklistItem = (itemId: string) => {
    setForm((prev) => ({
      ...prev,
      checklist: (prev.checklist || []).map((item) =>
        item.id === itemId ? { ...item, done: !item.done } : item
      ),
    }));
  };

  const handleRemoveFormChecklistItem = (itemId: string) => {
    setForm((prev) => ({
      ...prev,
      checklist: (prev.checklist || []).filter((item) => item.id !== itemId),
    }));
  };

  const getChecklistProgress = (task: OrganizationalTask) => {
    const checklist = Array.isArray(task.Checklist) ? task.Checklist : [];
    const total = checklist.length;
    const done = checklist.filter((item) => item.done).length;
    return { total, done };
  };

  const handleToggleTaskChecklistItem = async (task: OrganizationalTask, itemId: string) => {
    const checklist = (task.Checklist || []).map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    try {
      const saved = await saveOrganizationalTask({
        taskId: task.TaskID,
        committeeId: task.CommitteeId,
        committeeName: task.CommitteeName,
        title: task.Title,
        description: task.Description,
        priority: task.Priority,
        status: task.Status,
        dueDate: task.DueDate,
        assignee: task.Assignee,
        checklist,
        username,
      });
      setTasks((prev) => prev.map((item) => (item.TaskID === saved.TaskID ? saved : item)));
    } catch (error) {
      toast.error((error as Error).message || "Failed to update checklist item");
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      setIsLoading(true);
      await deleteOrganizationalTask(taskId, username);
      setTasks((prev) => prev.filter((item) => item.TaskID !== taskId));
      toast.success("Task deleted");
    } catch (error) {
      toast.error((error as Error).message || "Failed to delete task");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageLayout
      onClose={onClose}
      isDark={isDark}
      title={pageTitle}
      subtitle={pageSubtitle}
      actions={actions}
    >
      {!selectedCommittee && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {committees.map((committee) => {
            const visual = COMMITTEE_VISUALS[committee.id] || FALLBACK_COMMITTEE_VISUAL;
            const CommitteeIcon = visual.icon;
            return (
              <button
                key={committee.id}
                onClick={() => setSelectedCommittee(committee)}
                className="p-5 rounded-xl border text-left transition-all hover:shadow-lg"
                style={{
                  background: isDark ? visual.darkBackground : visual.lightBackground,
                  borderColor: isDark ? `${visual.accent}66` : `${visual.accent}55`,
                }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <CommitteeIcon className="w-5 h-5" style={{ color: visual.iconColor }} />
                  <div className="text-sm font-semibold">{committee.name}</div>
                </div>
                <div className="text-xs opacity-80">Open Committee Workspace</div>
              </button>
            );
          })}
        </div>
      )}

      {!!selectedCommittee && (
        <>
          <div className="mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedCommittee(null);
                setShowForm(false);
              }}
            >
              Back to Committees
            </Button>
          </div>

          {showForm && (
            <div
              className="p-4 mb-4 rounded-xl border grid grid-cols-1 md:grid-cols-2 gap-3"
              style={{
                background: isDark ? "rgba(15, 23, 42, 0.7)" : "rgba(255, 255, 255, 0.9)",
                borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
              }}
            >
              <input
                value={form.title || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Task title"
                className="px-3 py-2 rounded-lg border bg-transparent"
              />
              <input
                value={form.assignee || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, assignee: e.target.value }))}
                placeholder="Delegate to (name or role)"
                className="px-3 py-2 rounded-lg border bg-transparent"
              />
              <input
                type="date"
                value={form.dueDate || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                className="px-3 py-2 rounded-lg border bg-transparent"
              />
              <select
                value={form.priority || "Medium"}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, priority: e.target.value as SaveOrganizationalTaskPayload["priority"] }))
                }
                className="px-3 py-2 rounded-lg border bg-transparent"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
              <select
                value={form.status || "Not Started"}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, status: e.target.value as SaveOrganizationalTaskPayload["status"] }))
                }
                className="px-3 py-2 rounded-lg border bg-transparent"
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Blocked">Blocked</option>
              </select>
              <input
                value={form.description || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Description"
                className="px-3 py-2 rounded-lg border bg-transparent"
              />
              <div className="md:col-span-2 rounded-lg border p-3">
                <div className="text-xs font-semibold mb-2 flex items-center gap-2">
                  <ListChecks className="w-4 h-4" />
                  To-Do Checklist
                </div>
                <div className="flex gap-2 mb-2">
                  <input
                    value={checklistInput}
                    onChange={(e) => setChecklistInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddChecklistItem();
                      }
                    }}
                    placeholder="Add checklist item"
                    className="flex-1 px-3 py-2 rounded-lg border bg-transparent"
                  />
                  <Button variant="secondary" size="sm" onClick={handleAddChecklistItem}>
                    Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {(form.checklist || []).map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                      <label className="flex items-center gap-2 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => handleToggleFormChecklistItem(item.id)}
                        />
                        <span className={item.done ? "line-through opacity-70" : ""}>{item.text}</span>
                      </label>
                      <button
                        type="button"
                        className="text-xs text-red-500"
                        onClick={() => handleRemoveFormChecklistItem(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {(form.checklist || []).length === 0 && (
                    <div className="text-xs opacity-70">No checklist items yet.</div>
                  )}
                </div>
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Button variant="primary" size="sm" onClick={handleSave}>
                  Save
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {isLoading && <div className="text-sm opacity-80">Loading tasks...</div>}

          {!isLoading && viewMode === "tile" && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedTasks.map((task) => {
                const progress = getChecklistProgress(task);
                return (
                  <div
                    key={task.TaskID}
                    className="p-4 rounded-xl border text-left transition-all hover:shadow-lg"
                    style={{
                      background: isDark ? "rgba(30, 41, 59, 0.7)" : "rgba(255, 255, 255, 0.8)",
                      borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="text-sm font-semibold">{task.Title}</div>
                      <button onClick={() => handleEdit(task)} aria-label="Edit task">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-xs opacity-80 mb-2">{task.Description || "No description"}</div>
                    <div className="text-xs mb-1">Status: {task.Status}</div>
                    <div className="text-xs mb-1">Priority: {task.Priority}</div>
                    <div className="text-xs mb-1">Due: {task.DueDate || "N/A"}</div>
                    <div className="text-xs mb-2 flex items-center gap-1">
                      <UserRound className="w-3.5 h-3.5" />
                      Delegated to: {task.Assignee || "Unassigned"}
                    </div>
                    <div className="text-xs font-medium mb-1">
                      Checklist: {progress.done}/{progress.total}
                    </div>
                    <div className="space-y-1">
                      {(task.Checklist || []).slice(0, 3).map((item) => (
                        <label key={item.id} className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={() => handleToggleTaskChecklistItem(task, item.id)}
                          />
                          <span className={item.done ? "line-through opacity-70" : ""}>{item.text}</span>
                        </label>
                      ))}
                      {progress.total > 3 && (
                        <div className="text-xs opacity-70">+{progress.total - 3} more items</div>
                      )}
                    </div>
                  </div>
                );
              })}
              {sortedTasks.length === 0 && <div className="text-sm opacity-70">No tasks yet.</div>}
            </div>
          )}

          {!isLoading && viewMode === "table" && (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className={isDark ? "bg-slate-800/80" : "bg-gray-50"}>
                    <th className="px-3 py-2 text-left">Title</th>
                    <th className="px-3 py-2 text-left">Delegation</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Priority</th>
                    <th className="px-3 py-2 text-left">Checklist</th>
                    <th className="px-3 py-2 text-left">Due</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTasks.map((task) => {
                    const progress = getChecklistProgress(task);
                    return (
                      <tr key={task.TaskID} className="border-t">
                        <td className="px-3 py-2">{task.Title}</td>
                        <td className="px-3 py-2">{task.Assignee || "Unassigned"}</td>
                        <td className="px-3 py-2">{task.Status}</td>
                        <td className="px-3 py-2">{task.Priority}</td>
                        <td className="px-3 py-2">{progress.done}/{progress.total}</td>
                        <td className="px-3 py-2">{task.DueDate || "N/A"}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleEdit(task)} aria-label="Edit task">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(task.TaskID)} aria-label="Delete task">
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {sortedTasks.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 opacity-70" colSpan={7}>
                        No tasks yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </PageLayout>
  );
}
