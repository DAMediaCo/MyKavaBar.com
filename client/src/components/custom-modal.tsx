import * as React from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CustomModalProps {
  title: string;
  description: string;
  confirmButtonText: string;
  confirmAction: () => void;
  trigger?: React.ReactNode; // Optional trigger to open modal
}

export const CustomModal: React.FC<CustomModalProps> = ({
  title,
  description,
  confirmButtonText,
  confirmAction,
  trigger,
}) => {
  const [open, setOpen] = React.useState(false);

  const closeModal = () => setOpen(false);
  const handleConfirm = () => {
    confirmAction();
    closeModal();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col md:flex-row justify-end space-y-2 md:space-y-0 md:space-x-2 mt-4 md:mt-0">
          <Button
            variant="outline"
            size="sm"
            className="w-full md:w-auto"
            onClick={closeModal}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="w-full md:w-auto"
            onClick={handleConfirm}
          >
            {confirmButtonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
