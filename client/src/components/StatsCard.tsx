import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  change: {
    value: string;
    positive: boolean;
  };
  bgColor: string;
}

const StatsCard = ({ title, value, icon, change, bgColor }: StatsCardProps) => {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-2xl font-semibold mt-1">{value}</h3>
        </div>
        <div className={`${bgColor} p-3 rounded-full`}>
          {icon}
        </div>
      </div>
      <div className="mt-2 text-xs font-medium">
        <span className={change.positive ? "text-green-600" : "text-red-600"}>
          {change.value}{" "}
        </span>
        <span className="text-slate-500">from last month</span>
      </div>
    </Card>
  );
};

export default StatsCard;
