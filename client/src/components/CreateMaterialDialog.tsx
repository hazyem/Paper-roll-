import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus } from "lucide-react";

const createMaterialSchema = z.object({
  name: z.string().min(1, "Material name is required"),
});

type CreateMaterialDialogProps = {
  variant?: "outline" | "default" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
};

const CreateMaterialDialog = ({ variant = "outline", size = "default" }: CreateMaterialDialogProps) => {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof createMaterialSchema>>({
    resolver: zodResolver(createMaterialSchema),
    defaultValues: {
      name: "",
    },
  });

  const createMaterialMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createMaterialSchema>) => {
      const response = await apiRequest("POST", "/api/materials", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Material type created successfully",
      });
      form.reset();
      setOpen(false);
      
      // Invalidate materials query to refresh dropdowns
      queryClient.invalidateQueries({ queryKey: ['/api/materials'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create material: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    },
  });

  function onSubmit(data: z.infer<typeof createMaterialSchema>) {
    createMaterialMutation.mutate(data);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Plus className="h-4 w-4 mr-1" /> Add Material Type
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Material Type</DialogTitle>
          <DialogDescription>
            Add a new type of paper material to the system.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Material Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Premium Gloss Paper" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
              <Button
                type="submit"
                disabled={createMaterialMutation.isPending}
                className="bg-teal-700 hover:bg-teal-800"
              >
                {createMaterialMutation.isPending ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : "Create Material"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateMaterialDialog;