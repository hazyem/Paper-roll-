import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatWeight } from "@/lib/utils";

interface MaterialStatusCardProps {
  name: string;
  rolls: number;
  totalWeight: number;
  weightPercentage: number;
}

const MaterialStatusCard = ({ name, rolls, totalWeight, weightPercentage }: MaterialStatusCardProps) => {
  return (
    <div className="bg-slate-50 p-4 rounded-lg">
      <div className="flex justify-between items-center">
        <h4 className="font-medium text-slate-800">{name}</h4>
        <span className="text-sm text-slate-500">{rolls} rolls</span>
      </div>
      <div className="mt-2">
        <div className="flex justify-between text-xs text-slate-600 mb-1">
          <span>Total Weight</span>
          <span>{formatWeight(totalWeight)}</span>
        </div>
        <Progress value={weightPercentage} className="h-2 bg-slate-200" />
      </div>
    </div>
  );
};

export default MaterialStatusCard;
