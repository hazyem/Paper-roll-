import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatWeight } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Printer } from "lucide-react";

// Form validation schema
const reportSchema = z.object({
  reportType: z.enum(["material-id", "material-name", "purchase-order", "sales-order", "all-stock"]),
  filterValue: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  onlyActive: z.boolean().optional(),
});

const Reports = () => {
  const { toast } = useToast();
  const [reportResults, setReportResults] = useState<any>(null);

  // Get all materials for the dropdown
  const { data: materials, isLoading: materialsLoading } = useQuery({
    queryKey: ['/api/materials'],
    retry: 1,
  });

  // Setup form for report generation
  const form = useForm<z.infer<typeof reportSchema>>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reportType: "material-id",
      filterValue: "",
      dateFrom: "",
      dateTo: "",
      onlyActive: true,
    },
  });

  // Watch reportType to show different filter inputs
  const reportType = form.watch("reportType");

  // Mutation for generating report
  const reportMutation = useMutation({
    mutationFn: async (data: z.infer<typeof reportSchema>) => {
      const response = await apiRequest("POST", "/api/report", data);
      return response.json();
    },
    onSuccess: (data) => {
      setReportResults(data);
      toast({
        title: "Success",
        description: "Report generated successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to generate report: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    },
  });

  // State for pagination of all-stock report
  const [currentMaterialPage, setCurrentMaterialPage] = useState(1);
  const materialsPerPage = 10;
  const rollsPerMaterial = 100; // Show max 100 rolls per material to prevent rendering issues with large datasets

  // Handle form submission
  const onSubmit = (data: z.infer<typeof reportSchema>) => {
    // Reset pagination when generating a new report
    setCurrentMaterialPage(1);
    reportMutation.mutate(data);
  };

  // Export as CSV 
  const exportCsv = () => {
    if (!reportResults) return;

    try {
      let csvContent = "";
      let fileName = "report_export.csv";

      // Different CSV structure depending on report type
      switch (reportType) {
        case "material-id":
          // CSV header
          csvContent = "Material Roll ID,Material Name,PO Number,Current Weight,Status,Received Date\n";
          
          // CSV data - single row with material details
          csvContent += `${reportResults.materialRollId},${reportResults.materialName},${reportResults.purchaseOrderNumber || "N/A"},${reportResults.currentWeight},${reportResults.isReleased ? "Released" : "Active"},${new Date(reportResults.receivedAt).toLocaleDateString()}\n`;
          
          // Add activity logs
          if (reportResults.activityLogs?.length > 0) {
            csvContent += "\nActivity Logs\n";
            csvContent += "Action,Date,User,Details\n";
            
            reportResults.activityLogs.forEach(log => {
              csvContent += `${log.action},${new Date(log.performedAt).toLocaleString()},${log.performedBy},"${log.details}"\n`;
            });
          }
          
          fileName = `material_${reportResults.materialRollId}_report.csv`;
          break;
        
        case "material-name":
          // CSV header
          csvContent = "Material Name,Total Rolls,Total Weight\n";
          
          // CSV data - material summary
          csvContent += `${reportResults.materialName},${reportResults.totalRolls},${reportResults.totalWeight?.toFixed(2)}\n\n`;
          
          // Add roll details
          if (reportResults.rolls?.length > 0) {
            csvContent += "Material ID,PO Number,Declared Weight,Actual Weight,Current Weight,Received Date\n";
            
            reportResults.rolls.forEach(roll => {
              csvContent += `${roll.materialRollId},${roll.purchaseOrderNumber || "N/A"},${roll.declaredWeight || "No Data"},${roll.actualWeight || "No Data"},${formatWeight(roll.currentWeight)},${new Date(roll.receivedAt).toLocaleDateString()}\n`;
            });
          }
          
          fileName = `material_${reportResults.materialName.replace(/\s+/g, '_')}_report.csv`;
          break;
        
        case "purchase-order":
          // CSV header
          csvContent = "Purchase Order Number\n";
          csvContent += `${reportResults.purchaseOrderNumber}\n\n`;
          
          // Add material groups
          if (reportResults.materialGroups?.length > 0) {
            reportResults.materialGroups.forEach(group => {
              csvContent += `Material: ${group.materialName},Total Rolls: ${group.totalRolls},Total Weight: ${group.totalWeight?.toFixed(2)}\n`;
              
              if (group.rolls?.length > 0) {
                csvContent += "Material ID,Declared Weight,Actual Weight,Current Weight,Status,Received Date\n";
                
                group.rolls.forEach(roll => {
                  csvContent += `${roll.materialRollId},${roll.declaredWeight || "No Data"},${roll.actualWeight || "No Data"},${formatWeight(roll.currentWeight)},${roll.isReleased ? "Released" : "Active"},${new Date(roll.receivedAt).toLocaleDateString()}\n`;
                });
              }
              
              csvContent += "\n";
            });
          }
          
          fileName = `po_${reportResults.purchaseOrderNumber.replace(/\s+/g, '_')}_report.csv`;
          break;
        
        case "sales-order":
          // CSV header
          csvContent = "Sales Order Number\n";
          csvContent += `${reportResults.salesOrderNumber}\n\n`;
          
          // Add released materials
          if (reportResults.releasedMaterials?.length > 0) {
            csvContent += "Material ID,Material Name,Released Date\n";
            
            reportResults.releasedMaterials.forEach(material => {
              csvContent += `${material.materialRollId},${material.materialName},${new Date(material.releasedAt).toLocaleString()}\n`;
            });
          }
          
          fileName = `so_${reportResults.salesOrderNumber.replace(/\s+/g, '_')}_report.csv`;
          break;
        
        case "all-stock":
          // CSV header with summary
          csvContent = "All Stock Report\n";
          csvContent += `Generated: ${new Date(reportResults.generatedAt).toLocaleString()}\n\n`;
          csvContent += `Total Materials,${reportResults.summary.totalMaterials}\n`;
          csvContent += `Total Rolls,${reportResults.summary.totalRolls}\n`;
          csvContent += `Active Rolls,${reportResults.summary.activeRolls}\n`;
          csvContent += `Total Weight,${Number(reportResults.summary.totalWeight || 0).toFixed(2)} kg\n\n`;
          
          // Add material details
          if (reportResults.materials?.length > 0) {
            reportResults.materials.forEach(material => {
              csvContent += `Material: ${material.name},Active Rolls: ${material.activeRolls},Total Rolls: ${material.totalRolls},Total Weight: ${Number(material.totalWeight || 0).toFixed(2)} kg\n`;
              
              if (material.rolls?.length > 0) {
                csvContent += "Material ID,PO Number,Current Weight,Status,Received Date\n";
                
                material.rolls.forEach(roll => {
                  csvContent += `${roll.materialRollId},${roll.purchaseOrderNumber || "N/A"},${formatWeight(roll.currentWeight)},${roll.isReleased ? "Released" : "Active"},${new Date(roll.receivedAt).toLocaleDateString()}\n`;
                });
              }
              
              csvContent += "\n";
            });
          }
          
          fileName = `all_stock_report_${new Date().toISOString().split('T')[0]}.csv`;
          break;
        
        default:
          toast({
            title: "Export Error",
            description: "Unknown report type",
            variant: "destructive"
          });
          return;
      }
      
      // Create a blob with the CSV data
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      
      // Create a download link and trigger the download
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Export Successful",
        description: `File exported as ${fileName}`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: "An error occurred while exporting the data",
        variant: "destructive"
      });
    }
  };

  // Print report (simplified)
  const printReport = () => {
    window.print();
  };

  // Render the appropriate report result based on the report type
  const renderReportResults = () => {
    if (!reportResults) return null;

    switch (reportType) {
      case "material-id":
        return (
          <div className="mt-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
              <h5 className="font-medium text-slate-800">{reportResults.materialRollId} - {reportResults.materialName}</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                <p className="text-sm">PO: <span className="font-medium">{reportResults.purchaseOrderNumber || "N/A"}</span></p>
                <p className="text-sm">Current Weight: <span className="font-medium">{formatWeight(reportResults.currentWeight)}</span></p>
                <p className="text-sm">Status: <span className="font-medium">{reportResults.isReleased ? "Released" : "Active"}</span></p>
              </div>
            </div>
            
            <h6 className="font-medium text-slate-800 mb-2">Activity Logs</h6>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {reportResults.activityLogs?.length > 0 ? (
                    reportResults.activityLogs.map((log: any) => (
                      <tr key={log.id}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            log.action === 'received' ? 'bg-green-100 text-green-800' : 
                            log.action === 'released' ? 'bg-blue-100 text-blue-800' : 
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {log.action.charAt(0).toUpperCase() + log.action.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800">
                          {new Date(log.performedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800">{log.performedBy}</td>
                        <td className="px-4 py-3 text-sm text-slate-800">{log.details}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-center text-sm text-slate-500">No activity logs found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
        
      case "material-name":
        return (
          <div className="mt-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
              <h5 className="font-medium text-slate-800">{reportResults.materialName}</h5>
              <p className="text-sm text-slate-500 mt-1">
                Total Rolls: <span>{reportResults.totalRolls}</span> | 
                Total Weight: <span>{reportResults.totalWeight?.toFixed(2)} kg</span>
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Material ID</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">PO Number</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Declared Weight</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actual Weight</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Current Weight</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Received Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {reportResults.rolls?.length > 0 ? (
                    reportResults.rolls.map((roll: any) => (
                      <tr key={roll.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800">{roll.materialRollId}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800">{roll.purchaseOrderNumber || "N/A"}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800">
                          {roll.declaredWeight ? `${roll.declaredWeight} kg` : "No Data"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800">
                          {roll.actualWeight ? `${roll.actualWeight} kg` : "No Data"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800">
                          {formatWeight(roll.currentWeight)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">
                          {new Date(roll.receivedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-center text-sm text-slate-500">No materials found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
        
      case "purchase-order":
        return (
          <div className="mt-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
              <h5 className="font-medium text-slate-800">Purchase Order: {reportResults.purchaseOrderNumber}</h5>
            </div>
            
            {reportResults.materialGroups?.map((group: any, index: number) => (
              <div key={index} className="mb-6">
                <h6 className="font-medium text-slate-700 mb-2">{group.materialName}</h6>
                <p className="text-sm text-slate-500 mb-3">
                  Total Rolls: {group.totalRolls} | Total Weight: {group.totalWeight?.toFixed(2)} kg
                </p>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Material ID</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Declared Weight</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actual Weight</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Current Weight</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Received Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {group.rolls?.length > 0 ? (
                        group.rolls.map((roll: any) => (
                          <tr key={roll.id}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800">{roll.materialRollId}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800">
                              {roll.declaredWeight ? `${roll.declaredWeight} kg` : "No Data"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800">
                              {roll.actualWeight ? `${roll.actualWeight} kg` : "No Data"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800">
                              {formatWeight(roll.currentWeight)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800">
                              {roll.isReleased ? "Released" : "Active"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">
                              {new Date(roll.receivedAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-3 text-center text-sm text-slate-500">No materials found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        );
        
      case "sales-order":
        return (
          <div className="mt-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
              <h5 className="font-medium text-slate-800">Sales Order: {reportResults.salesOrderNumber}</h5>
              <p className="text-sm text-slate-500 mt-1">
                Released Materials: {reportResults.releasedMaterials?.length || 0}
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Material ID</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Material Name</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Released Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {reportResults.releasedMaterials?.length > 0 ? (
                    reportResults.releasedMaterials.map((material: any, index: number) => (
                      <tr key={index}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800">{material.materialRollId}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800">{material.materialName}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">
                          {new Date(material.releasedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-center text-sm text-slate-500">No released materials found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
        
      case "all-stock":
        return (
          <div className="mt-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
              <h5 className="font-medium text-slate-800">{reportResults.reportTitle}</h5>
              <p className="text-sm text-slate-500 mt-1">
                Generated: {new Date(reportResults.generatedAt).toLocaleString()}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div className="bg-white p-3 rounded border">
                  <p className="text-xs text-slate-500">Total Materials</p>
                  <p className="text-lg font-semibold">{reportResults.summary.totalMaterials}</p>
                </div>
                <div className="bg-white p-3 rounded border">
                  <p className="text-xs text-slate-500">Total Rolls</p>
                  <p className="text-lg font-semibold">{reportResults.summary.totalRolls}</p>
                </div>
                <div className="bg-white p-3 rounded border">
                  <p className="text-xs text-slate-500">Active Rolls</p>
                  <p className="text-lg font-semibold">{reportResults.summary.activeRolls}</p>
                </div>
                <div className="bg-white p-3 rounded border">
                  <p className="text-xs text-slate-500">Total Weight</p>
                  <p className="text-lg font-semibold">{Number(reportResults.summary.totalWeight || 0).toFixed(2)} kg</p>
                </div>
              </div>
            </div>
            
            {/* Pagination info */}
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-slate-500">
                Showing materials {((currentMaterialPage - 1) * materialsPerPage) + 1} to {Math.min(currentMaterialPage * materialsPerPage, reportResults.materials?.length || 0)} of {reportResults.materials?.length || 0}
              </p>
              <div className="flex gap-2">
                <Button 
                  onClick={() => setCurrentMaterialPage(prev => Math.max(1, prev - 1))}
                  disabled={currentMaterialPage === 1}
                  variant="outline"
                  size="sm"
                >
                  Previous
                </Button>
                <Button
                  onClick={() => setCurrentMaterialPage(prev => 
                    reportResults.materials && prev * materialsPerPage < reportResults.materials.length ? prev + 1 : prev
                  )}
                  disabled={!reportResults.materials || (currentMaterialPage * materialsPerPage) >= reportResults.materials.length}
                  variant="outline"
                  size="sm"
                >
                  Next
                </Button>
              </div>
            </div>
            
            {reportResults.materials
              ?.slice((currentMaterialPage - 1) * materialsPerPage, currentMaterialPage * materialsPerPage)
              .map((material: any, index: number) => (
                <div key={index} className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <h6 className="font-medium text-slate-700">{material.name}</h6>
                    <div className="text-sm">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                        {material.activeRolls} active / {material.totalRolls} total
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 mb-3">
                    Total Weight: {Number(material.totalWeight || 0).toFixed(2)} kg
                  </p>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Material ID</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">PO Number</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Current Weight</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Received Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {material.rolls?.length > 0 ? (
                        <>
                          {material.rolls.slice(0, rollsPerMaterial).map((roll: any) => (
                            <tr key={roll.id} className={roll.isReleased ? "bg-slate-50" : ""}>
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-teal-700">{roll.materialRollId}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800">{roll.purchaseOrderNumber || "N/A"}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800">
                                {formatWeight(roll.currentWeight)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  roll.isReleased ? 'bg-slate-100 text-slate-800' : 'bg-green-100 text-green-800'
                                }`}>
                                  {roll.isReleased ? 'Released' : 'Active'}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">
                                {new Date(roll.receivedAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                          {material.rolls.length > rollsPerMaterial && (
                            <tr>
                              <td colSpan={5} className="px-4 py-3 text-center text-xs italic text-slate-500">
                                Showing {rollsPerMaterial} of {material.rolls.length} rolls. Use filter options to view specific rolls.
                              </td>
                            </tr>
                          )}
                        </>
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-3 text-center text-sm text-slate-500">No materials found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        );
        
      default:
        return <p className="text-center py-5 text-slate-500">Select a report type and click Generate Report</p>;
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="px-6 py-4 border-b border-slate-200">
        <CardTitle className="text-lg font-semibold text-slate-800">Reports & Logs</CardTitle>
        <CardDescription className="text-sm text-slate-500">View reports on paper roll inventory and movement history</CardDescription>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="border-b border-slate-200">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="reportType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Report Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select report type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="material-id">By Material ID</SelectItem>
                          <SelectItem value="material-name">By Material Name</SelectItem>
                          <SelectItem value="purchase-order">By Purchase Order</SelectItem>
                          <SelectItem value="sales-order">By Sales Order</SelectItem>
                          <SelectItem value="all-stock">All Stock Report</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {reportType !== "all-stock" && (
                  <FormField
                    control={form.control}
                    name="filterValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Filter Value</FormLabel>
                        {reportType === "material-name" ? (
                          <Select 
                            onValueChange={field.onChange}
                            disabled={materialsLoading}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select material" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {materials && Array.isArray(materials) ? materials.map((material: any) => (
                                <SelectItem key={material.id} value={material.name}>
                                  {material.name}
                                </SelectItem>
                              )) : (
                                <SelectItem value="loading">Loading materials...</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          <FormControl>
                            <Input 
                              placeholder={
                                reportType === "material-id" ? "Enter Material ID" : 
                                reportType === "purchase-order" ? "Enter Purchase Order" : 
                                "Enter Sales Order"
                              } 
                              {...field} 
                            />
                          </FormControl>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {reportType === "all-stock" && (
                  <FormField
                    control={form.control}
                    name="onlyActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Active Only</FormLabel>
                          <FormDescription>
                            Show only active materials
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                )}
                
                <FormField
                  control={form.control}
                  name="dateFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date From</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="dateTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date To</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="mt-4 flex justify-end">
                <Button 
                  type="submit" 
                  disabled={reportMutation.isPending}
                  className="bg-teal-700 hover:bg-teal-800"
                >
                  {reportMutation.isPending ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </>
                  ) : "Generate Report"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
        
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-base font-medium text-slate-800">Report Results</h4>
            {reportResults && (
              <div className="flex space-x-2">
                <Button onClick={exportCsv} variant="outline" size="sm" className="text-xs">
                  <FileDown className="h-4 w-4 mr-1" />
                  Export CSV
                </Button>
                <Button onClick={printReport} variant="outline" size="sm" className="text-xs">
                  <Printer className="h-4 w-4 mr-1" />
                  Print
                </Button>
              </div>
            )}
          </div>
          
          {renderReportResults()}
        </div>
      </CardContent>
    </Card>
  );
};

export default Reports;