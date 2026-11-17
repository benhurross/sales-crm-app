"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Validation messages are keys in the "common" messages.
const leadSchema = z.object({
  prospectName: z.string().min(1, "required"),
  prospectClientId: z.string().optional(),
  producerId: z.string().min(1, "selectProducer"),
  startWorkingDate: z.string().min(1, "required"),
  rfqType: z.enum(["New", "Renewal"]),
  cob: z.enum(["General", "Medical", "Motor"]),
  bor: z.boolean(),
  quoted: z.boolean(),
  status: z.enum(["Secured", "Pending", "Lost"]),
  estimatedPremium: z.string().min(1, "required"),
  commission: z.string().optional(),
  currentInsurerId: z.string().optional(),
  city: z.string().min(1, "required"),
  borTimestamp: z.string().optional(),
  quoteTimestamp: z.string().optional(),
  comments: z.string().optional(),
});
export type LeadFormValues = z.infer<typeof leadSchema>;

interface Producer { id: number; code: string; name: string }
interface Insurer { id: number; name: string }
interface ProspectSuggestion {
  id: number;
  clientName: string;
  producerId: number;
  premiums: string | null;
  currentInsurerId: number | null;
  lob: string | null;
  status: string;
  producerName: string | null;
}

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
  const t = useTranslations("leadForm");
  const tc = useTranslations("common");
  const ts = useTranslations("status");
  const tRfq = useTranslations("rfq");
  const tCob = useTranslations("cob");
  const err = (message?: string) => (message ? <p className="text-xs text-destructive">{tc(message)}</p> : null);
  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    values: {
      prospectName: defaults?.prospectName ?? "",
      prospectClientId: defaults?.prospectClientId ?? undefined,
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
            <Label htmlFor="prospectName">{t("prospectName")}</Label>
            <ProspectAutocomplete
              value={form.watch("prospectName")}
              onChange={(name) => form.setValue("prospectName", name)}
              onSelect={(prospect) => {
                form.setValue("prospectName", prospect.clientName);
                form.setValue("prospectClientId", String(prospect.id));
                if (!isSalesman) form.setValue("producerId", String(prospect.producerId));
                if (prospect.currentInsurerId) form.setValue("currentInsurerId", String(prospect.currentInsurerId));
                if (prospect.lob) form.setValue("cob", prospect.lob as "General" | "Medical" | "Motor");
                if (prospect.premiums) form.setValue("estimatedPremium", prospect.premiums);
              }}
              disabled={!!defaults?.prospectClientId}
            />
            {err(form.formState.errors.prospectName?.message)}
            {form.watch("prospectClientId") && (
              <p className="text-xs text-muted-foreground">{t("linkedToProspect")}</p>
            )}
          </div>

          {!isSalesman && (
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="producerId">{t("producer")}</Label>
              <select id="producerId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" {...form.register("producerId")}>
                <option value="">{t("selectProducer")}</option>
                {producers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {err(form.formState.errors.producerId?.message)}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="startWorkingDate">{t("startDate")}</Label>
            <Input id="startWorkingDate" type="date" {...form.register("startWorkingDate")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rfqType">{t("rfqType")}</Label>
            <select id="rfqType" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" {...form.register("rfqType")}>
              <option value="New">{tRfq("New")}</option>
              <option value="Renewal">{tRfq("Renewal")}</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cob">{t("cob")}</Label>
            <select id="cob" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" {...form.register("cob")}>
              <option value="General">{tCob("General")}</option>
              <option value="Medical">{tCob("Medical")}</option>
              <option value="Motor">{tCob("Motor")}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">{t("status")}</Label>
            <select id="status" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" {...form.register("status")}>
              <option value="Pending">{ts("Pending")}</option>
              <option value="Secured">{ts("Secured")}</option>
              <option value="Lost">{ts("Lost")}</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="estimatedPremium">{t("estimatedPremium")}</Label>
            <Input id="estimatedPremium" type="number" step="0.01" {...form.register("estimatedPremium")} />
            {err(form.formState.errors.estimatedPremium?.message)}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="commission">{t("commission")}</Label>
            <Input id="commission" type="number" step="0.01" {...form.register("commission")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="city">{t("city")}</Label>
            <Input id="city" {...form.register("city")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currentInsurerId">{t("currentInsurer")}</Label>
            <select id="currentInsurerId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" {...form.register("currentInsurerId")}>
              <option value="">{tc("none")}</option>
              {insurers.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>

          <BooleanCheckboxes form={form} />

          <div className="space-y-1.5">
            <Label htmlFor="borTimestamp">{t("borDate")}</Label>
            <Input id="borTimestamp" type="date" {...form.register("borTimestamp")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quoteTimestamp">{t("quoteDate")}</Label>
            <Input id="quoteTimestamp" type="date" {...form.register("quoteTimestamp")} />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="comments">{t("comments")}</Label>
            <Textarea id="comments" rows={2} {...form.register("comments")} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button type="submit" form="lead-form" disabled={isPending}>{tc("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProspectAutocomplete({
  value,
  onChange,
  onSelect,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (prospect: ProspectSuggestion) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("leadForm");
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { data: suggestions = [] } = useQuery<ProspectSuggestion[]>({
    queryKey: ["prospect-search", query],
    queryFn: () => fetch(`/api/prospects/search?q=${encodeURIComponent(query)}`).then((r) => r.json()),
    enabled: query.length >= 2,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    onChange(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(v);
      if (v.length >= 2) setShowDropdown(true);
    }, 300);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          id="prospectName"
          autoComplete="off"
          placeholder={t("prospectPlaceholder")}
          className="ps-8"
          value={value}
          onChange={handleInputChange}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          disabled={disabled}
        />
      </div>
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover shadow-md">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-start text-sm hover:bg-muted"
              onClick={() => {
                onSelect(s);
                setShowDropdown(false);
              }}
            >
              <span className="font-medium">{s.clientName}</span>
              {s.producerName && <span className="text-xs text-muted-foreground">{s.producerName}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BooleanCheckboxes({ form }: { form: ReturnType<typeof useForm<LeadFormValues>> }) {
  const bor = useWatch({ control: form.control, name: "bor" });
  const quoted = useWatch({ control: form.control, name: "quoted" });
  const t = useTranslations("leadForm");
  return (
    <div className="flex items-center gap-4 col-span-2">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={bor} onCheckedChange={(v) => form.setValue("bor", !!v)} />
        {t("borReceived")}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={quoted} onCheckedChange={(v) => form.setValue("quoted", !!v)} />
        {t("quoted")}
      </label>
    </div>
  );
}
