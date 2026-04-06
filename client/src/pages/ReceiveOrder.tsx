import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Search, ChevronsUpDown, HelpCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import CreateMaterialDialog from "@/components/CreateMaterialDialog";

// Form validation schema
const formSchema = z.object({
  materialName: z.string().min(1, "Material name is required"),
  purchaseOrderNumber: z.string().min(1, "Purchase order number is required"),
  remarks: z.string().optional(),
  materialRolls: z.array(
    z.object({
      materialRollId: z.string()
        .min(1, "Material ID is required")
        .refine(id => /^[A-Za-z0-9-]+$/.test(id), {
          message: "Material ID must only contain letters, numbers, and hyphens"
        }),
      declaredWeight: z.union([
        z.coerce.number().positive("Declared weight must be a positive number").optional(),
        z.literal(""),
      ]).transform(val => val === "" ? undefined : Number(val))
        .refine(val => val === undefined || val > 0, {
          message: "Declared weight must be greater than zero"
        }),
      actualWeight: z.union([
        z.coerce.number().positive("Actual weight must be a positive number").optional(),
        z.literal(""),
      ]).transform(val => val === "" ? undefined : Number(val))
        .refine(val => val === undefined || val > 0, {
          message: "Actual weight must be greater than zero"
        }),
      remarks: z.string().optional(),
    })
  ).min(1, "At least one material ID is required"),
});

const ReceiveOrder = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get all materials for the dropdown
  const { data: materials = [], isLoading: materialsLoading } = useQuery<any[]>({
    queryKey: ['/api/materials'],
    retry: 1,
  });

  // Form setup with React Hook Form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      materialName: "",
      purchaseOrderNumber: "",
      remarks: "",
      materialRolls: [
        { materialRollId: "", declaredWeight: "" as any, actualWeight: "" as any, remarks: "" }
      ],
    },
  });

  // Setup field array for multiple material IDs
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "materialRolls",
  });

  // Mutation for submitting the form
  const receiveMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const response = await apiRequest("POST", "/api/receive", {
        ...data,
        username: "John Smith", // Normally would come from auth
        materialRolls: data.materialRolls.map(roll => ({
          ...roll,
        })),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "New order received successfully!",
      });
      
      // Reset the form
      form.reset({
        materialName: "",
        purchaseOrderNumber: "",
        remarks: "",
        materialRolls: [
          { materialRollId: "", declaredWeight: "" as any, actualWeight: "" as any, remarks: "" }
        ],
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
    onError: (error: any) => {
      // Check if this is a server validation error with formatted errors
      if (error.response?.data?.errors) {
        // Handle detailed validation errors from the server
        const errorMessages = error.response.data.errors.map((err: any) => {
          // Convert path like 'materialRolls.0.materialRollId' to a more readable form
          const path = err.path.replace(/materialRolls\.(\d+)\./g, 'Material Roll #$1 ');
          return `${path}: ${err.message}`;
        });
        
        toast({
          title: "Validation Error",
          description: (
            <div className="mt-2">
              <p>Please fix the following errors:</p>
              <ul className="list-disc pl-5 mt-2">
                {errorMessages.map((msg: string, i: number) => (
                  <li key={i} className="text-sm">{msg}</li>
                ))}
              </ul>
            </div>
          ),
          variant: "destructive",
        });
      } else if (error.response?.data?.message) {
        // Display specific error message from the server
        toast({
          title: "Error receiving order",
          description: error.response.data.message,
          variant: "destructive",
        });
      } else {
        // Generic error fallback
        toast({
          title: "Error receiving order",
          description: error instanceof Error ? error.message : "An unexpected error occurred",
          variant: "destructive",
        });
      }
    },
  });

  // Form submission handler with additional validation
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    // Check for empty or invalid fields
    let formIsValid = true;
    const errors: string[] = [];

    // Check if material name is selected
    if (!data.materialName) {
      errors.push("Material name is required");
      formIsValid = false;
    }

    // Check if purchase order number is provided
    if (!data.purchaseOrderNumber) {
      errors.push("Purchase order number is required");
      formIsValid = false;
    }

    // Check if all material rolls have valid IDs
    const materialRollIds = new Set<string>();
    
    data.materialRolls.forEach((roll, index) => {
      // Check for required Material Roll ID
      if (!roll.materialRollId) {
        errors.push(`Material ID is required for item #${index + 1}`);
        formIsValid = false;
      } else {
        // We don't need to check for duplicates in the form as the server will check against the database
        materialRollIds.add(roll.materialRollId);
      }
      
      // Validate format of Material Roll ID
      if (roll.materialRollId && !/^[A-Za-z0-9-]+$/.test(roll.materialRollId)) {
        errors.push(`Material ID ${roll.materialRollId} contains invalid characters`);
        formIsValid = false;
      }
      
      // Both declared weight and actual weight are optional
      // Ensure weights are positive numbers if provided
      if (roll.declaredWeight && roll.declaredWeight <= 0) {
        errors.push(`Declared weight must be positive for ${roll.materialRollId || `item #${index + 1}`}`);
        formIsValid = false;
      }
      
      if (roll.actualWeight && roll.actualWeight <= 0) {
        errors.push(`Actual weight must be positive for ${roll.materialRollId || `item #${index + 1}`}`);
        formIsValid = false;
      }
    });

    // Display validation errors if any
    if (!formIsValid) {
      toast({
        title: "Validation Failed",
        description: (
          <div className="mt-2 space-y-2">
            <p>Please fix the following errors:</p>
            <ul className="list-disc pl-5">
              {errors.map((error, index) => (
                <li key={index} className="text-sm">{error}</li>
              ))}
            </ul>
          </div>
        ),
        variant: "destructive",
      });
      return;
    }

    // If all validation passes, submit the form
    receiveMutation.mutate(data);
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="px-6 py-4 border-b border-slate-200">
        <CardTitle className="text-lg font-semibold text-slate-800">Receive New Order</CardTitle>
        <CardDescription className="text-sm text-slate-500">Record new paper roll materials in the system</CardDescription>
      </CardHeader>
      
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="materialName"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1">
                        <FormLabel>Material Name <span className="text-red-600">*</span></FormLabel>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span><HelpCircle className="h-4 w-4 text-muted-foreground" /></span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="w-[200px] text-sm">Select an existing material or create a new one</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <CreateMaterialDialog size="sm" />
                    </div>
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
                                  (material: any) => material.name === field.value
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
                              {materials?.map((material: any) => (
                                <CommandItem
                                  key={material.id}
                                  value={material.name}
                                  onSelect={() => {
                                    form.setValue("materialName", material.name);
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
              
              <FormField
                control={form.control}
                name="purchaseOrderNumber"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1">
                      <FormLabel>Purchase Order Number <span className="text-red-600">*</span></FormLabel>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span><HelpCircle className="h-4 w-4 text-muted-foreground" /></span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="w-[220px] text-sm">Enter the purchase order number used when ordering this material</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <FormControl>
                      <Input placeholder="e.g. PO-2023-00123" {...field} />
                    </FormControl>
                    <FormDescription>
                      A unique identifier for this purchase order
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>General Remarks</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add any general remarks about this order" 
                      className="resize-none" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Optional notes or comments about the entire order
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div>
              <div className="flex justify-between mb-3">
                <div className="flex items-center gap-1">
                  <FormLabel className="text-base">Material IDs <span className="text-red-600">*</span></FormLabel>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span><HelpCircle className="h-4 w-4 text-muted-foreground" /></span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="w-[240px] text-sm space-y-2">
                          <p>Each unique roll of material needs a separate ID</p>
                          <p>Both weight fields are optional</p>
                          <p>IDs must be unique across the system</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <FormField
                        control={form.control}
                        name={`materialRolls.${index}.materialRollId`}
                        render={({ field }) => (
                          <FormItem className="flex-grow">
                            <FormControl>
                              <Input placeholder="Enter Material ID" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`materialRolls.${index}.declaredWeight`}
                        render={({ field }) => (
                          <FormItem className="w-1/4 relative">
                            <div className="absolute right-2 -top-3 z-10">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <p className="w-[180px] text-xs">Weight declared by supplier (optional)</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <FormControl>
                              <Input type="number" placeholder="Declared Weight" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`materialRolls.${index}.actualWeight`}
                        render={({ field }) => (
                          <FormItem className="w-1/4 relative">
                            <div className="absolute right-2 -top-3 z-10">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <p className="w-[180px] text-xs">Actual measured weight upon receipt (optional)</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <FormControl>
                              <Input type="number" placeholder="Actual Weight" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => fields.length > 1 && remove(index)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                    
                    <FormField
                      control={form.control}
                      name={`materialRolls.${index}.remarks`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input 
                              placeholder="Item specific remarks (optional)" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </div>
              
              <Button
                type="button"
                variant="ghost"
                className="mt-3 text-teal-700"
                onClick={() => append({ materialRollId: "", declaredWeight: "" as any, actualWeight: "" as any, remarks: "" })}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add Another Material ID
              </Button>
            </div>
            
            <div className="flex justify-end">
              <Button type="button" variant="outline" className="mr-3">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={receiveMutation.isPending}
                className="bg-teal-700 hover:bg-teal-800"
              >
                {receiveMutation.isPending ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : "Receive Order"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default ReceiveOrder;
