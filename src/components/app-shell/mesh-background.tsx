import { cn } from "@/lib/utils";

export function MeshBackground({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("mesh pointer-events-none fixed inset-0 -z-10 overflow-hidden", className)}>
      <div className="mesh-glow mesh-glow-1" />
      <div className="mesh-glow mesh-glow-2" />
      <div className="mesh-glow mesh-glow-3" />
      <div className="mesh-glow mesh-glow-4" />
    </div>
  );
}
