import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Form validation schema
const searchSchema = z.object({
  materialRollId: z.string().min(1, "Material ID is required"),
});

const amendSchema = z.object({
  materialRollId: z.string().min(1, "Material ID is required"),
  declaredWeight: z.union([
    z.coerce.number().min(0, "Weight must be a positive number").optional(),
    z.literal(""),
  ]).transform(val => val === "" ? undefined : val),
  actualWeight: z.union([
    z.coerce.number().min(0, "Weight must be a positive number").optional(),
    z.literal(""),
  ]).transform(val => val === "" ? undefined : val),
  currentWeight: z.union([
    z.coerce.number().min(0, "Weight must be a positive number").optional(),
    z.literal(""),
  ]).transform(val => val === "" ? undefined : val),
  remarks: z.string().optional(),
});

const AmendDetails = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);

  // Setup form for searching material
  const searchForm = useForm<z.infer<typeof searchSchema>>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      materialRollId: "",
    },
  });

  // Setup form for amending material
  const amendForm = useForm<z.infer<typeof amendSchema>>({
    resolver: zodResolver(amendSchema),
    defaultValues: {
      materialRollId: "",
      declaredWeight: "",
      actualWeight: "",
      currentWeight: "",
      remarks: "",
    },
  });

  // Mutation for searching material
  const searchMutation = useMutation({
    mutationFn: async (data: z.infer<typeof searchSchema>) => {
      const response = await fetch(`/api/material/${data.materialRollId}`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Material ID not found: ${data.materialRollId}`);
      }
      const material = await response.json();
      return material;
    },
    onSuccess: (data) => {
      setSelectedMaterial(data);
      amendForm.setValue("materialRollId", data.materialRollId);
      
      if (data.declaredWeight !== null) {
        amendForm.setValue("declaredWeight", data.declaredWeight);
      }
      
      if (data.actualWeight !== null) {
        amendForm.setValue("actualWeight", data.actualWeight);
      }
      
      if (data.currentWeight !== null) {
        amendForm.setValue("currentWeight", data.currentWeight);
      }
      
      if (data.remarks) {
        amendForm.setValue("remarks", data.remarks);
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to find material",
        variant: "destructive",
      });
    },
  });

  // Mutation for amending material
  const amendMutation = useMutation({
    mutationFn: async (data: z.infer<typeof amendSchema>) => {
      const response = await apiRequest("POST", "/api/amend", {
        ...data,
        username: "John Smith", // Normally would come from auth
        declaredWeight: data.declaredWeight === "" ? undefined : Number(data.declaredWeight),
        actualWeight: data.actualWeight === "" ? undefined : Number(data.actualWeight),
        currentWeight: data.currentWeight === "" ? undefined : Number(data.currentWeight),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Material details updated successfully!",
      });
      
      // Reset the forms
      searchForm.reset();
      amendForm.reset();
      setSelectedMaterial(null);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update material: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    },
  });

  // Handle search form submission
  const onSearch = (data: z.infer<typeof searchSchema>) => {
    searchMutation.mutate(data);
  };

  // Handle amend form submission
  const onAmend = (data: z.infer<typeof amendSchema>) => {
    amendMutation.mutate(data);
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="px-6 py-4 border-b border-slate-200">
        <CardTitle className="text-lg font-semibold text-slate-800">Amend Material Details</CardTitle>
        <CardDescription className="text-sm text-slate-500">Update information for existing paper roll materials</CardDescription>
      </CardHeader>
      
      <CardContent className="p-6">
        <Form {...searchForm}>
          <form onSubmit={searchForm.handleSubmit(onSearch)}>
            <FormField
              control={searchForm.control}
              name="materialRollId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Material ID <span className="text-red-600">*</span></FormLabel>
                  <div className="flex">
                    <FormControl>
                      <Input className="rounded-r-none" placeholder="Enter Material ID" {...field} />
                    </FormControl>
                    <Button 
                      type="submit" 
                      disabled={searchMutation.isPending}
                      className="rounded-l-none bg-teal-700 hover:bg-teal-800"
                    >
                      {searchMutation.isPending ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Searching...
                        </>
                      ) : "Search"}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        
        {selectedMaterial && (
          <Form {...amendForm}>
            <form onSubmit={amendForm.handleSubmit(onAmend)} className="mt-6">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Material ID</p>
                    <p className="font-medium">{selectedMaterial.materialRollId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Material Name</p>
                    <p className="font-medium">{selectedMaterial.materialName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Purchase Order</p>
                    <p className="font-medium">{selectedMaterial.purchaseOrderNumber || "N/A"}</p>
                  </div>
                </div>
              </div>
              
              <h4 className="text-sm font-medium text-slate-700 mb-3">Update Material Information</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={amendForm.control}
                  name="materialRollId"
                  render={({ field }) => (
                    <FormItem className="hidden">
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={amendForm.control}
                  name="declaredWeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Declared Weight</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <span className="text-slate-500 text-sm">kg</span>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={amendForm.control}
                  name="actualWeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Actual Weight</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <span className="text-slate-500 text-sm">kg</span>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={amendForm.control}
                  name="currentWeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Weight</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <span className="text-slate-500 text-sm">kg</span>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="mt-4">
                <FormField
                  control={amendForm.control}
                  name="remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remarks</FormLabel>
                      <FormControl>
                        <textarea 
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Add any comments about the amendment (optional)"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="mt-8 flex justify-end">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="mr-3" 
                  onClick={() => {
                    setSelectedMaterial(null);
                    amendForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={amendMutation.isPending}
                  className="bg-teal-700 hover:bg-teal-800"
                >
                  {amendMutation.isPending ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
};

export default AmendDetails;
