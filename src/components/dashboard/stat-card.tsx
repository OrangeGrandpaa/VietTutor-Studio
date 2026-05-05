import { ArrowUpRight } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  hint
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-3 font-serif text-4xl leading-none">{value}</p>
        </div>
        <div className="rounded-full bg-secondary p-2 text-secondary-foreground">
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
