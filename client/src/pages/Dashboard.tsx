import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import MaterialStatusCard from "@/components/MaterialStatusCard";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Define interfaces for our dashboard data
interface DashboardStats {
  totalMaterials: number;
  pendingReleases: number;
  ordersReceived: number;
  totalWeight: number;
}

interface Activity {
  id: number;
  action: string;
  materialRollId: string;
  materialName: string;
  performedAt: string;
  performedBy: string;
}

interface MaterialStatus {
  materialName: string;
  totalRolls: number;
  totalWeight: number;
}

interface DashboardData {
  stats: DashboardStats;
  recentActivities: Activity[];
  materialStatus: MaterialStatus[];
}

const Dashboard = () => {
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['/api/dashboard'],
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-700 mx-auto"></div>
          <p className="mt-3 text-slate-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    // Show error message without calling toast in the render method
    // This avoids the infinite render loop
    return (
      <div className="text-center py-10">
        <h2 className="text-xl font-semibold text-red-600 mb-2">Something went wrong</h2>
        <p className="text-slate-600 mb-4">We couldn't load the dashboard data</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-teal-700 text-white rounded-md hover:bg-teal-800"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Type assertion since we've already checked that data exists
  const dashboardData = data as DashboardData;
  
  // Calculate the max weight to determine percentages for progress bars
  const maxWeight = dashboardData.materialStatus.reduce((max: number, item: MaterialStatus) => {
    return Math.max(max, item.totalWeight);
  }, 0);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="px-5 py-4 border-b border-slate-200">
              <CardTitle className="text-base font-semibold text-slate-800">Recent Activities</CardTitle>
              <p className="text-xs text-slate-500 mt-1">Showing 20 most recent activities</p>
            </CardHeader>
            <CardContent className="p-5">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead>
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Material ID</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Material</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {dashboardData.recentActivities.length > 0 ? (
                      dashboardData.recentActivities.map((activity: Activity) => (
                        <tr key={activity.id}>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              activity.action === 'received' ? 'bg-green-100 text-green-800' : 
                              activity.action === 'released' ? 'bg-blue-100 text-blue-800' : 
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {activity.action.charAt(0).toUpperCase() + activity.action.slice(1)}
                            </span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-800">{activity.materialRollId}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-800">{activity.materialName}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-500">
                            {new Date(activity.performedAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-500">{activity.performedBy}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-3 py-5 text-center text-sm text-slate-500">
                          No recent activities
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 text-right">
                <Button 
                  onClick={() => setLocation('/reports')} 
                  variant="link"
                  className="text-sm font-medium text-teal-700 hover:text-teal-800 p-0"
                >
                  View All Activities →
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader className="px-5 py-4 border-b border-slate-200">
              <CardTitle className="text-base font-semibold text-slate-800">Material Status</CardTitle>
              <p className="text-xs text-slate-500 mt-1">Showing 20 most recent materials based on activity</p>
            </CardHeader>
            <CardContent className="p-5">
              <div className="space-y-4">
                {dashboardData.materialStatus.length > 0 ? (
                  dashboardData.materialStatus.map((material: MaterialStatus, index: number) => (
                    <MaterialStatusCard 
                      key={index}
                      name={material.materialName}
                      rolls={material.totalRolls}
                      totalWeight={material.totalWeight}
                      weightPercentage={Math.round((material.totalWeight / maxWeight) * 100)}
                    />
                  ))
                ) : (
                  <p className="text-center text-sm text-slate-500 py-10">
                    No materials available
                  </p>
                )}
              </div>
              <div className="mt-4 text-right">
                <Button 
                  onClick={() => setLocation('/reports')} 
                  variant="link"
                  className="text-sm font-medium text-teal-700 hover:text-teal-800 p-0"
                >
                  View Full Report →
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
