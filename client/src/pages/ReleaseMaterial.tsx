import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Search, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Form validation schema
const searchSchema = z.object({
  searchMethod: z.enum(["material-id", "material-name"]),
  materialId: z.string().optional(),
  materialName: z.string().optional(),
});

// Individual material weight schema
const materialWeightSchema = z.object({
  materialRollId: z.string().min(1, "Material ID is required"),
  currentWeight: z.union([
    z.coerce.number().min(0, "Weight must be a positive number"),
    z.literal(""),
  ]).transform(val => val === "" ? undefined : Number(val)),
  needsWeight: z.boolean().optional(),
  remarks: z.string().optional(),
});

const releaseSchema = z.object({
  materialRolls: z.array(materialWeightSchema).min(1, "At least one Material ID is required"),
  salesOrderNumber: z.string().min(1, "Sales order number is required"),
  remarks: z.string().optional(),
});

// Type for material data
interface Material {
  id: number;
  materialRollId: string;
  materialName: string;
  purchaseOrderNumber: string | null;
  declaredWeight: number | null;
  actualWeight: number | null;
  currentWeight: number | null;
  materialId: number;
  receivedAt: string;
  isReleased: boolean;
  releasedAt: string | null;
  salesOrderNumber: string | null;
}

// Type for materials data in dropdown
interface MaterialOption {
  id: number;
  name: string;
}

export default function ReleaseMaterial() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for selected materials
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedMaterials, setSelectedMaterials] = useState<Material[]>([]);
  const [showMaterialSelection, setShowMaterialSelection] = useState(false);
  const [showBatchRelease, setShowBatchRelease] = useState(false);
  const [availableMaterials, setAvailableMaterials] = useState<Material[]>([]);

  // Get available materials for dropdown
  const { data: materials, isLoading: materialsLoading } = useQuery({ 
    queryKey: ['/api/materials'],
    select: (data: MaterialOption[]) => data
  });

  // Setup form for material search
  const searchForm = useForm<z.infer<typeof searchSchema>>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      searchMethod: "material-id",
      materialId: "",
      materialName: "",
    },
  });

  // Setup form for releasing material
  const releaseForm = useForm<z.infer<typeof releaseSchema>>({
    resolver: zodResolver(releaseSchema),
    defaultValues: {
      materialRolls: [],
      salesOrderNumber: "",
      remarks: "",
    },
  });

  // Handle method change to toggle between material ID and name search
  const searchMethod = searchForm.watch("searchMethod");

  // Mutation for searching material
  const searchMutation = useMutation({
    mutationFn: async (data: z.infer<typeof searchSchema>) => {
      if (data.searchMethod === "material-id" && data.materialId) {
        const response = await fetch(`/api/material/${data.materialId}`, { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`Material ID not found: ${data.materialId}`);
        }
        const material = await response.json() as Material;
        return { single: true, material } as const;
      } else if (data.searchMethod === "material-name" && data.materialName) {
        const response = await fetch(`/api/rolls/material/${data.materialName}`, { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`No materials found for: ${data.materialName}`);
        }
        const materials = await response.json() as Material[];
        if (materials.length === 0) {
          throw new Error(`No materials found for: ${data.materialName}`);
        }
        return { single: false, materials, materialName: data.materialName } as const;
      }
      throw new Error("Invalid search criteria");
    },
    onSuccess: (data) => {
      if (data.single) {
        // If the material is not already released, add it to the selection
        if (!data.material.isReleased) {
          setSelectedMaterial(data.material);
          
          // Add the material to the form's materialRolls array
          const currentRolls = releaseForm.getValues("materialRolls") || [];
          const newRoll = {
            materialRollId: data.material.materialRollId,
            currentWeight: data.material.currentWeight || undefined,
            needsWeight: !data.material.currentWeight && !data.material.actualWeight
          };
          
          // Only add if not already in the array
          if (!currentRolls.some(roll => roll.materialRollId === newRoll.materialRollId)) {
            releaseForm.setValue("materialRolls", [...currentRolls, newRoll]);
            setSelectedMaterials(prev => [...prev, data.material]);
          }

          // Show batch release UI
          setShowBatchRelease(true);
        } else {
          toast({
            title: "Material Already Released",
            description: `Material ID ${data.material.materialRollId} has already been released.`,
            variant: "destructive",
          });
        }
        setShowMaterialSelection(false);
      } else {
        setAvailableMaterials(data.materials.filter(m => !m.isReleased));
        setShowMaterialSelection(true);
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

  // Mutation for releasing material
  const releaseMutation = useMutation({
    mutationFn: async (data: z.infer<typeof releaseSchema>) => {
      const response = await apiRequest("POST", "/api/release", {
        materialRolls: data.materialRolls,
        salesOrderNumber: data.salesOrderNumber,
        remarks: data.remarks,
        username: "John Smith", // Normally would come from auth
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `${selectedMaterials.length} material${selectedMaterials.length > 1 ? 's' : ''} released successfully!`,
      });
      
      // Reset the forms
      searchForm.reset({
        searchMethod: "material-id",
        materialId: "",
        materialName: "",
      });
      releaseForm.reset();
      setSelectedMaterial(null);
      setSelectedMaterials([]);
      setShowMaterialSelection(false);
      setShowBatchRelease(false);
      setAvailableMaterials([]);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to release material: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    },
  });

  // Handle search form submission
  const onSearch = (data: z.infer<typeof searchSchema>) => {
    searchMutation.mutate(data);
  };

  // Handle release form submission
  const onRelease = (data: z.infer<typeof releaseSchema>) => {
    releaseMutation.mutate(data);
  };

  // Remove a material from selection
  const removeMaterial = (materialRollId: string) => {
    // Get current rolls and filter out the one to remove
    const currentRolls = releaseForm.getValues("materialRolls");
    const updatedRolls = currentRolls.filter(roll => roll.materialRollId !== materialRollId);
    
    // Update form state
    releaseForm.setValue("materialRolls", updatedRolls);
    
    // Update UI state
    setSelectedMaterials(prev => prev.filter(m => m.materialRollId !== materialRollId));
    
    // If no materials selected, hide batch release UI
    if (updatedRolls.length === 0) {
      setShowBatchRelease(false);
    }
  };

  // Handle adding a material from the table
  const addMaterialToSelection = (material: Material) => {
    // If the material is not already in selection
    if (!selectedMaterials.some(m => m.materialRollId === material.materialRollId)) {
      // Create the new roll object with weight information
      const newRoll = {
        materialRollId: material.materialRollId,
        currentWeight: material.currentWeight || undefined,
        needsWeight: !material.currentWeight && !material.actualWeight
      };
      
      // Update the form with the new roll
      const currentRolls = releaseForm.getValues("materialRolls");
      releaseForm.setValue("materialRolls", [...currentRolls, newRoll]);
      
      // Update UI state
      setSelectedMaterials(prev => [...prev, material]);
      setShowBatchRelease(true);
    }
  };
  
  // Handle changing the current weight of a material
  const updateMaterialWeight = (materialRollId: string, weight: number | undefined) => {
    const currentRolls = releaseForm.getValues("materialRolls");
    const updatedRolls = currentRolls.map(roll => 
      roll.materialRollId === materialRollId 
        ? { ...roll, currentWeight: weight } 
        : roll
    );
    releaseForm.setValue("materialRolls", updatedRolls);
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="px-6 py-4 border-b border-slate-200">
        <CardTitle className="text-lg font-semibold text-slate-800">Release Material</CardTitle>
        <CardDescription className="text-sm text-slate-500">Record the release of paper roll materials from inventory</CardDescription>
      </CardHeader>
      
      <CardContent className="p-6">
        <Form {...searchForm}>
          <form onSubmit={searchForm.handleSubmit(onSearch)} className="space-y-6">
            <FormField
              control={searchForm.control}
              name="searchMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Search By</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="material-id" id="material-id" />
                        <Label htmlFor="material-id">Material ID</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="material-name" id="material-name" />
                        <Label htmlFor="material-name">Material Name</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {searchMethod === "material-id" ? (
              <FormField
                control={searchForm.control}
                name="materialId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Material ID <span className="text-red-600">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Enter Material ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={searchForm.control}
                name="materialName"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Material Name <span className="text-red-600">*</span></FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                            disabled={materialsLoading}
                          >
                            {field.value
                              ? materials?.find(
                                  (material) => material.name === field.value
                                )?.name
                              : "Search material..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search material..." className="h-9" />
                          <CommandEmpty>No material found.</CommandEmpty>
                          <CommandGroup>
                            <CommandList>
                              {materials && materials.map((material) => (
                                <CommandItem
                                  key={material.id}
                                  value={material.name}
                                  onSelect={() => {
                                    searchForm.setValue("materialName", material.name);
                                  }}
                                >
                                  {material.name}
                                  {material.name === field.value && (
                                    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                                      <Search className="h-4 w-4" />
                                    </span>
                                  )}
                                </CommandItem>
                              ))}
                            </CommandList>
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={searchMutation.isPending}
                className="bg-teal-700 hover:bg-teal-800"
              >
                {searchMutation.isPending ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Searching...
                  </>
                ) : "Search Material"}
              </Button>
            </div>
          </form>
        </Form>
        
        {/* Show selected materials */}
        {selectedMaterials.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-slate-700 mb-2">Selected Materials</h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedMaterials.map(material => (
                <Badge key={material.materialRollId} variant="outline" className="px-3 py-1.5 flex items-center gap-1">
                  <span>{material.materialRollId}</span>
                  <button
                    type="button"
                    onClick={() => removeMaterial(material.materialRollId)}
                    className="ml-1 text-slate-500 hover:text-slate-700 focus:outline-none"
                  >
                    <X size={14} />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Show material selection table when searching by material name */}
        {showMaterialSelection && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-slate-700 mb-3">Available Materials</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Material ID</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Material Name</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Purchase Order</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Current Weight</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {availableMaterials.length > 0 ? (
                    availableMaterials.map((material: Material) => (
                      <tr key={material.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800">{material.materialRollId}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800">{material.materialName}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800">{material.purchaseOrderNumber || "N/A"}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800">
                          {material.currentWeight ? `${material.currentWeight} kg` : "No Data"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-teal-700 border-teal-700 hover:bg-teal-50"
                            onClick={() => addMaterialToSelection(material)}
                            disabled={selectedMaterials.some(m => m.materialRollId === material.materialRollId)}
                          >
                            {selectedMaterials.some(m => m.materialRollId === material.materialRollId) ? "Selected" : "Add"}
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-center text-sm text-slate-500">No materials found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowMaterialSelection(false)}
              >
                Close
              </Button>
            </div>
          </div>
        )}

        {/* Batch release form */}
        {showBatchRelease && (
          <Form {...releaseForm}>
            <form onSubmit={releaseForm.handleSubmit(onRelease)} className="mt-6">
              <div className="mb-6">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Release Details</h4>
              </div>
              
              <FormField
                control={releaseForm.control}
                name="salesOrderNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sales Order Number <span className="text-red-600">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. SO-2023-00456" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={releaseForm.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem className="mt-4">
                    <FormLabel>Remarks</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Add any notes or comments about this release (optional)" 
                        className="min-h-[80px]" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Display individual material weight inputs */}
              {selectedMaterials.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Material Weights</h4>
                  <div className="space-y-4">
                    {selectedMaterials.map((material, index) => {
                      const needsWeight = !material.currentWeight && !material.actualWeight;
                      return (
                        <div key={material.materialRollId} className="p-4 border border-slate-200 rounded-md">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                            <div className="mb-2 md:mb-0">
                              <h5 className="font-medium text-slate-800">{material.materialRollId}</h5>
                              <p className="text-sm text-slate-500">{material.materialName}</p>
                            </div>
                            
                            <div className="w-full md:w-1/3">
                              <FormField
                                control={releaseForm.control}
                                name={`materialRolls.${index}.currentWeight` as const}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className={needsWeight ? "text-red-600 font-medium" : ""}>
                                      Current Weight {needsWeight && <span className="text-red-600">*</span>}
                                    </FormLabel>
                                    <div className="relative">
                                      <FormControl>
                                        <Input 
                                          type="number" 
                                          step="0.01" 
                                          placeholder={needsWeight ? "Required" : "Optional"} 
                                          {...field}
                                          value={field.value === undefined ? "" : field.value}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            field.onChange(val === "" ? "" : Number(val));
                                            updateMaterialWeight(material.materialRollId, val === "" ? undefined : Number(val));
                                          }}
                                          className={needsWeight ? "border-red-300 focus-visible:ring-red-500" : ""}
                                        />
                                      </FormControl>
                                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <span className="text-slate-500 text-sm">kg</span>
                                      </div>
                                    </div>
                                    <FormMessage />
                                    {needsWeight && (
                                      <p className="text-xs text-red-600 mt-1">
                                        Weight required for this material
                                      </p>
                                    )}
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <div className="mt-6 flex justify-end space-x-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowBatchRelease(false);
                    setSelectedMaterials([]);
                    releaseForm.reset({
                      materialRolls: [],
                      salesOrderNumber: "",
                      remarks: "",
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={releaseMutation.isPending}
                  className="bg-teal-700 hover:bg-teal-800"
                >
                  {releaseMutation.isPending ? "Releasing..." : "Release Materials"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}