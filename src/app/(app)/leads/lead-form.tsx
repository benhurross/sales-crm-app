"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const leadSchema = z.object({
  prospectName: z.string().min(1, "Required"),
  producerId: z.string().min(1, "Select a producer"),
  startWorkingDate: z.string().min(1, "Required"),
  rfqType: z.enum(["New", "Renewal"]),
  cob: z.enum(["General", "Medical", "Motor"]),
  bor: z.boolean(),
  quoted: z.boolean(),
  status: z.enum(["Secured", "Pending", "Lost"]),
  estimatedPremium: z.string().min(1, "Required"),
  commission: z.string().optional(),
  currentInsurerId: z.string().optional(),
  city: z.string().min(1, "Required"),
  borTimestamp: z.string().optional(),
  quoteTimestamp: z.string().optional(),
  comments: z.string().optional(),
});
export type LeadFormValues = z.infer<typeof leadSchema>;

interface Producer { id: number; code: string; name: string }
interface Insurer { id: number; name: string }

interface LeadFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaults?: Partial<LeadFormValues>;
  onSubmit: (values: LeadFormValues) => void;
  isPending: boolean;
  title: string;
  userRole?: string | null;
}

export function LeadFormDialog({ open, onOpenChange, defaults, onSubmit, isPending, title, userRole }: LeadFormProps) {
  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    values: {
      prospectName: defaults?.prospectName ?? "",
      producerId: defaults?.producerId ?? "",
      startWorkingDate: defaults?.startWorkingDate ?? new Date().toISOString().slice(0, 10),
      rfqType: defaults?.rfqType ?? "New",
      cob: defaults?.cob ?? "General",
      bor: defaults?.bor ?? false,
      quoted: defaults?.quoted ?? false,
      status: defaults?.status ?? "Pending",
      estimatedPremium: defaults?.estimatedPremium ?? "",
      commission: defaults?.commission ?? "",
      currentInsurerId: defaults?.currentInsurerId ?? undefined,
      city: defaults?.city ?? "Jeddah",
      borTimestamp: defaults?.borTimestamp ?? "",
      quoteTimestamp: defaults?.quoteTimestamp ?? "",
      comments: defaults?.comments ?? "",
    },
  });

  const { data: producers = [] } = useQuery<Producer[]>({
    queryKey: ["producers"],
    queryFn: () => fetch("/api/producers").then((r) => r.json()),
  });

  const { data: insurers = [] } = useQuery<Insurer[]>({
    queryKey: ["insurance-companies"],
    queryFn: () => fetch("/api/insurance-companies").then((r) => r.json()),
  });

  const isSalesman = userRole === "salesman";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form id="lead-form" onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="prospectName">Prospect Name</Label>
            <Input id="prospectName" {...form.register("prospectName")} />
            {form.formState.errors.prospectName && <p className="text-xs text-destructive">{form.formState.errors.prospectName.message}</p>}
          </div>

          {!isSalesman && (
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="producerId">Producer</Label>
              <select id="producerId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" {...form.register("producerId")}>
                <option value="">Select producer...</option>
                {producers.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                ))}
              </select>
              {form.formState.errors.producerId && <p className="text-xs text-destructive">{form.formState.errors.producerId.message}</p>}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="startWorkingDate">Start Date</Label>
            <Input id="startWorkingDate" type="date" {...form.register("startWorkingDate")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rfqType">RFQ Type</Label>
            <select id="rfqType" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" {...form.register("rfqType")}>
              <option value="New">New</option>
              <option value="Renewal">Renewal</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cob">Class of Business</Label>
            <select id="cob" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" {...form.register("cob")}>
              <option value="General">General</option>
              <option value="Medical">Medical</option>
              <option value="Motor">Motor</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <select id="status" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" {...form.register("status")}>
              <option value="Pending">Pending</option>
              <option value="Secured">Secured</option>
              <option value="Lost">Lost</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="estimatedPremium">Estimated Premium</Label>
            <Input id="estimatedPremium" type="number" step="0.01" {...form.register("estimatedPremium")} />
            {form.formState.errors.estimatedPremium && <p className="text-xs text-destructive">{form.formState.errors.estimatedPremium.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="commission">Commission</Label>
            <Input id="commission" type="number" step="0.01" {...form.register("commission")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Input id="city" {...form.register("city")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currentInsurerId">Current Insurer</Label>
            <select id="currentInsurerId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" {...form.register("currentInsurerId")}>
              <option value="">None</option>
              {insurers.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>

          <BooleanCheckboxes form={form} />

          <div className="space-y-1.5">
            <Label htmlFor="borTimestamp">BOR Date</Label>
            <Input id="borTimestamp" type="date" {...form.register("borTimestamp")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quoteTimestamp">Quote Date</Label>
            <Input id="quoteTimestamp" type="date" {...form.register("quoteTimestamp")} />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="comments">Comments</Label>
            <Textarea id="comments" rows={2} {...form.register("comments")} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="lead-form" disabled={isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BooleanCheckboxes({ form }: { form: ReturnType<typeof useForm<LeadFormValues>> }) {
  const bor = useWatch({ control: form.control, name: "bor" });
  const quoted = useWatch({ control: form.control, name: "quoted" });
  return (
    <div className="flex items-center gap-4 col-span-2">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={bor} onCheckedChange={(v) => form.setValue("bor", !!v)} />
        BOR Received
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={quoted} onCheckedChange={(v) => form.setValue("quoted", !!v)} />
        Quoted
      </label>
    </div>
  );
}
