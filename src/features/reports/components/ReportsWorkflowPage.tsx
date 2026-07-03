"use client";

import { useState, useMemo, useEffect, useRef, type FormEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeletonRows } from "@/components/ui/table-skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Plus } from "lucide-react";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import {
  workflowRequests,
  employees,
  type RequestStatus,
  type WorkflowRequest,
  type RequestType,
} from "@/lib/mock";
import { loadRequestsFromStorage, saveRequestsToStorage } from "@/features/workflow/services/workflowRequests";
import { RequestTable } from "@/features/workflow/components/RequestTable";
import { appendAuditLog } from "@/features/audit/services/audit.service";

const PURPOSE = "";

const badgeVariant = (status: string) => {
  if (status === "APPROVED") return "default";
  if (status === "REJECTED") return "destructive";
  if (status === "PENDING") return "secondary";
  return "outline";
};

const REQUEST_TYPE_OPTIONS: { value: RequestType; label: string }[] = [
  { value: "PROMOTION", label: "Promotion" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "ROLE_CHANGE", label: "Role change" },
  { value: "DEPARTMENT_CHANGE", label: "Department change" },
  { value: "MANAGER_CHANGE", label: "Manager change" },
  { value: "SALARY_CHANGE", label: "Salary change" },
];

export default function WorkflowReportsPage() {
  const { user: currentUser } = useCurrentUser();
  const requestTypeOptions = useMemo(
    () =>
      REQUEST_TYPE_OPTIONS.filter(
        (opt) => opt.value !== "DEPARTMENT_CHANGE" || currentUser.role === "DEPARTMENT_MANAGER"
      ),
    [currentUser.role]
  );
  const [requests, setRequests] = useState<WorkflowRequest[]>(() => {
    const stored = loadRequestsFromStorage();
    return stored.length > 0 ? stored : workflowRequests;
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [myStatusFilter, setMyStatusFilter] = useState<RequestStatus | "ALL">("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<RequestType>("PROMOTION");
  const [createTitle, setCreateTitle] = useState("");
  const [createEntityId, setCreateEntityId] = useState<string>("");
  const [createError, setCreateError] = useState("");
  const [workflowUiReady, setWorkflowUiReady] = useState(false);
  const skipSaveRef = useRef(true); // Skip first save (initial mount) to avoid overwriting stored data

  useEffect(() => {
    setWorkflowUiReady(true);
  }, []);

  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false; // Allow saves after first run
      return;
    }
    saveRequestsToStorage(requests);
  }, [requests]);

  const myRequests = useMemo(() => {
    let list = requests
      .filter((r) => r.createdBy === currentUser.employeeId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    if (myStatusFilter !== "ALL") {
      list = list.filter((r) => r.status.toUpperCase() === myStatusFilter.toUpperCase());
    }
    return list;
  }, [requests, currentUser.employeeId, myStatusFilter]);

  const toApprove = useMemo(() => {
    if (
      currentUser.role === "EMPLOYEE" ||
      currentUser.role === "AUDITOR"
    ) {
      return [];
    }
    return requests.filter((r) => r.status === "PENDING");
  }, [requests, currentUser.role]);

  const pendingCount = toApprove.length;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(toApprove.map((r) => r.id));
  };

  const updateStatus = (id: string, status: RequestStatus) => {
    setRequests((prev) => {
      const next = prev.map((r) =>
        r.id === id && r.status === "PENDING" ? { ...r, status } : r
      );
      const before = prev.find((r) => r.id === id);
      if (before && before.status === "PENDING") {
        const verb = status === "APPROVED" ? "approved" : status === "REJECTED" ? "rejected" : "updated";
        appendAuditLog({
          actorId: currentUser.employeeId,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          action: "REQUEST_STATUS_CHANGED",
          entityType: "WORKFLOW_REQUEST",
          entityId: before.id,
          summary: `${currentUser.name} ${verb} workflow request ${before.id}.`,
          before: { status: before.status, title: before.title },
          after: { status, title: before.title },
        });
      }
      return next;
    });
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const bulkApprove = () => {
    selectedIds.forEach((id) => updateStatus(id, "APPROVED"));
    setSelectedIds([]);
  };

  const bulkReject = () => {
    selectedIds.forEach((id) => updateStatus(id, "REJECTED"));
    setSelectedIds([]);
  };

  const submitForApproval = (id: string) => {
    setRequests((prev) => {
      const before = prev.find((r) => r.id === id);
      if (!before || before.status !== "CREATED") return prev;
      const next = prev.map((r) =>
        r.id === id ? { ...r, status: "PENDING" as RequestStatus } : r
      );
      appendAuditLog({
        actorId: currentUser.employeeId,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: "REQUEST_SUBMITTED",
        entityType: "WORKFLOW_REQUEST",
        entityId: id,
        summary: `${currentUser.name} submitted workflow request ${id} for approval.`,
        before: { status: before.status, title: before.title },
        after: { status: "PENDING", title: before.title },
      });
      return next;
    });
  };

  const handleCreateRequest = (e: FormEvent) => {
    e.preventDefault();
    setCreateError("");
    const title = createTitle.trim();
    if (!title) {
      setCreateError("Please enter a title.");
      return;
    }
    const id = "req-" + Date.now();
    const newReq: WorkflowRequest = {
      id,
      type: createType,
      title,
      createdBy: currentUser.employeeId,
      createdByName: currentUser.name,
      status: "CREATED",
      createdAt: new Date().toISOString(),
      entityId: createEntityId || undefined,
      entityType: createEntityId ? "employee" : undefined,
    };
    setRequests((prev) => {
      const next = [newReq, ...prev];
      saveRequestsToStorage(next);
      return next;
    });
    appendAuditLog({
      actorId: currentUser.employeeId,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "REQUEST_CREATED",
      entityType: "WORKFLOW_REQUEST",
      entityId: id,
      summary: `${currentUser.name} created workflow request: ${title}.`,
      after: { type: createType, title, status: "CREATED" },
    });
    setCreateTitle("");
    setCreateEntityId("");
    setCreateOpen(false);
  };

  if (
    currentUser.role !== "SUPER_ADMIN" &&
    currentUser.role !== "HR_ADMIN" &&
    currentUser.role !== "HR_MANAGER" &&
    currentUser.role !== "HR_STAFF" &&
    currentUser.role !== "DEPARTMENT_MANAGER"
  ) {
    return (
      <div className="space-y-4 -mt-2">
        <h1 className="mt-[10px] text-3xl font-semibold tracking-tight text-foreground">Workflow Requests</h1>
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">You do not have permission to view reports.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 -mt-2">
      {currentUser.role === "HR_STAFF" ? (
        <div className="flex flex-col gap-6">
          <EmployeeModuleTopbar searchPlaceholder="Search" />
          <EmployeeSectionHeader
            title="Workflow Requests"
            actions={
              <Button variant="outline" size="sm">
                <Download className="size-4 mr-2" />
                Export
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-[10px] flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Workflow Requests</h1>
          </div>
          <Button variant="outline" size="sm">
            <Download className="size-4 mr-2" />
            Export
          </Button>
        </div>
      )}

      <Tabs defaultValue="by-status" className="space-y-4">
        <TabsList className="h-auto gap-0 rounded-lg bg-muted/60 p-1">
          <TabsTrigger
            value="by-status"
            className="rounded-md px-4 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground"
          >
            Requests by Status
          </TabsTrigger>
          <TabsTrigger
            value="my"
            className="rounded-md px-4 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground"
          >
            My Requests
          </TabsTrigger>
          <TabsTrigger
            value="to-approve"
            className="rounded-md px-4 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground"
          >
            To approve
            {pendingCount > 0 && (
              <span className="ml-2 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="by-status" className="mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requests by status</CardTitle>
          <CardDescription>All workflow requests. Filter by department or employee when wired to API.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-x-auto max-h-[50vh] overflow-y-auto scrollbar-hide">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!workflowUiReady ? (
                  <TableSkeletonRows columns={5} prefix="workflow-report-sk" />
                ) : (
                requests.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell>{row.type.replace(/_/g, " ")}</TableCell>
                    <TableCell>{row.createdByName}</TableCell>
                    <TableCell>
                      {new Date(row.createdAt).toLocaleDateString("en-US", {
                        month: "numeric",
                        day: "2-digit",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={badgeVariant(row.status)}
                        className={
                          row.status === "APPROVED"
                            ? "rounded-full border-transparent bg-emerald-700 px-3 py-1 font-bold text-white"
                            : undefined
                        }
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="my" className="mt-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">My Requests</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Requests you created. Status: Created → Pending → Approved/Rejected → Applied/Closed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4 mr-2" />
              New request
            </Button>
            <label htmlFor="my-status-filter" className="text-sm text-muted-foreground">
              Status:
            </label>
            <select
              id="my-status-filter"
              value={myStatusFilter}
              onChange={(e) => setMyStatusFilter(e.target.value as RequestStatus | "ALL")}
              className="flex h-9 rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm"
            >
              <option value="ALL">All</option>
              <option value="CREATED">Created</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="APPLIED">Applied</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <RequestTable
            loading={!workflowUiReady}
            requests={myRequests}
          />
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="to-approve" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">To Approve</CardTitle>
              <CardDescription>
                Approve or reject these requests. You can select multiple and use the buttons below, or use the row actions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RequestTable
                loading={!workflowUiReady}
                requests={toApprove}
                selectable
                selectedIds={selectedIds}
                onToggle={toggleSelected}
                onToggleAll={toggleAll}
                showRowActions
                onApprove={(id) => updateStatus(id, "APPROVED")}
                onReject={(id) => updateStatus(id, "REJECTED")}
              />
              {pendingCount > 0 && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <Button
                    size="sm"
                    onClick={bulkApprove}
                    disabled={selectedIds.length === 0}
                  >
                    Approve selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={bulkReject}
                    disabled={selectedIds.length === 0}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto scrollbar-hide">
          <DialogHeader>
            <DialogTitle>New request</DialogTitle>
            <DialogDescription>
              Create a workflow request (promotion, transfer, etc.). It will appear in My Requests with status Created.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateRequest} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-type">Type</Label>
              <select
                id="create-type"
                value={createType}
                onChange={(e) => setCreateType(e.target.value as RequestType)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {requestTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-title">Title</Label>
              <Input
                id="create-title"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="e.g. Promotion: Glean Ramos to Software Engineer II"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-entity">Related employee (optional)</Label>
              <select
                id="create-entity"
                value={createEntityId}
                onChange={(e) => setCreateEntityId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">— None —</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeNumber})
                  </option>
                ))}
              </select>
            </div>
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create request</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
