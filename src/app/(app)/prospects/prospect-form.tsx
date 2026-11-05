"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const prospectSchema = z.object({
  clientName: z.string().min(1, "Required"),
  producerId: z.string().min(1, "Select a producer"),
  premiums: z.string().optional(),
  month: z.string().optional(),
  currentInsurerId: z.string().optional(),
  lob: z.string().optional(),
});
export type ProspectFormValues = z.infer<typeof prospectSchema>;

interface Producer { id: number; code: string; name: string }
interface Insurer { id: number; name: string }

interface ProspectFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaults?: Partial<ProspectFormValues>;
  onSubmit: (values: ProspectFormValues) => void;
  isPending: boolean;
  title: string;
  userRole?: string | null;
}

export function ProspectFormDialog({ open, onOpenChange, defaults, onSubmit, isPending, title, userRole }: ProspectFormProps) {
  const form = useForm<ProspectFormValues>({
    resolver: zodResolver(prospectSchema),
    values: {
      clientName: defaults?.clientName ?? "",
      producerId: defaults?.producerId ?? "",
      premiums: defaults?.premiums ?? "",
      month: defaults?.month ?? "",
      currentInsurerId: defaults?.currentInsurerId ?? undefined,
      lob: defaults?.lob ?? undefined,
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
        <form id="prospect-form" onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="clientName">Client Name</Label>
            <Input id="clientName" {...form.register("clientName")} />
            {form.formState.errors.clientName && <p className="text-xs text-destructive">{form.formState.errors.clientName.message}</p>}
          </div>

          {!isSalesman && (
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="producerId">Producer</Label>
              <select id="producerId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" {...form.register("producerId")}>
                <option value="">Select producer...</option>
                {producers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {form.formState.errors.producerId && <p className="text-xs text-destructive">{form.formState.errors.producerId.message}</p>}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="premiums">Premiums</Label>
            <Input id="premiums" type="number" step="0.01" {...form.register("premiums")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="month">Month</Label>
            <Input id="month" placeholder="e.g. January" {...form.register("month")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lob">Line of Business</Label>
            <select id="lob" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" {...form.register("lob")}>
              <option value="">None</option>
              <option value="General">General</option>
              <option value="Medical">Medical</option>
              <option value="Motor">Motor</option>
            </select>
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
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="prospect-form" disabled={isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
