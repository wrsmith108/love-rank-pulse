import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { useAuth } from "@/contexts/AuthContext";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultView?: "login" | "register";
}

export const AuthModal: React.FC<AuthModalProps> = ({ 
  open, 
  onOpenChange,
  defaultView = "login" 
}) => {
  const isMobile = useIsMobile();
  const { isAuthenticated } = useAuth();
  const [view, setView] = React.useState<"login" | "register">(defaultView);
  
  // If user becomes authenticated, close the modal
  React.useEffect(() => {
    if (isAuthenticated) {
      onOpenChange(false);
    }
  }, [isAuthenticated, onOpenChange]);
  
  const handleSuccess = () => {
    onOpenChange(false);
  };
  
  const content = (
    <div className="w-full">
      {view === "login" ? (
        <LoginForm 
          onSuccess={handleSuccess}
          onRegisterClick={() => setView("register")}
        />
      ) : (
        <RegisterForm 
          onSuccess={handleSuccess}
          onLoginClick={() => setView("login")}
        />
      )}
    </div>
  );
  
  // Use Drawer for mobile and Dialog for desktop
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="border-b border-border">
            <DrawerTitle className="text-xl font-bold flex items-center justify-between">
              {view === "login" ? "Login" : "Create Account"}
              <DrawerClose asChild>
                <Button variant="ghost" size="icon">
                  <X className="w-4 h-4" />
                </Button>
              </DrawerClose>
            </DrawerTitle>
            <DrawerDescription>
              {view === "login" 
                ? "Sign in to access your account" 
                : "Join Love Rank Pulse to track your stats"
              }
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 py-6 overflow-y-auto">
            {content}
          </div>
          <DrawerFooter className="pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {view === "login" ? "Login" : "Create Account"}
          </DialogTitle>
          <DialogDescription>
            {view === "login" 
              ? "Sign in to access your account" 
              : "Join Love Rank Pulse to track your stats"
            }
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};