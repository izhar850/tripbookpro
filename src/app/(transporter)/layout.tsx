
"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarClose,
  SidebarContent, 
  SidebarHeader, 
  SidebarFooter, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Loader2, LayoutDashboard, Users, CreditCard, User, LogOut, Truck, Menu, Star } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getTransporterAccessIssue } from "@/lib/account-utils";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";

function MobileHeader() {
  const { toggleSidebar } = useSidebar();
  
  return (
    <header className="flex md:hidden items-center justify-between p-4 border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-20">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gradient-primary rounded flex items-center justify-center">
          <Truck className="text-white w-4 h-4" />
        </div>
        <span className="font-headline font-bold text-sm tracking-tight">TripBook Pro</span>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle className="h-9 px-3" />
        <Button size="icon" variant="ghost" className="h-9 w-9" onClick={toggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}

function NavMenu() {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Vehicles", href: "/vehicles", icon: Truck },
    // Driver module is hidden from the active workflow; legacy driver data/code remains untouched.
    { name: "Parties", href: "/parties", icon: Users },
    { name: "Billing", href: "/billing", icon: CreditCard },
    { name: "Subscription", href: "/subscription", icon: Star },
    { name: "Profile", href: "/profile", icon: User },
  ];

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.name}>
          <SidebarMenuButton 
            asChild
            isActive={pathname === item.href}
            onClick={handleNavClick}
            className={cn(
              "w-full h-11 px-4 flex items-center gap-3 rounded-lg transition-all duration-200",
              pathname === item.href 
                ? "bg-primary/10 text-primary font-bold" 
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <Link href={item.href}>
              <item.icon className={cn("w-5 h-5", pathname === item.href ? "text-primary" : "")} />
              <span>{item.name}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

function TransporterSidebar() {
  const { profile, logout } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleLogout = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
    logout();
  };

  return (
    <Sidebar className="border-r border-border/50 bg-card">
      <SidebarHeader className="border-b border-sidebar-border/70 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-primary rounded-lg flex items-center justify-center shadow-md">
              <Truck className="text-white w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-headline font-bold text-lg leading-tight">TripBook</span>
              <span className="text-[10px] uppercase tracking-widest text-primary font-bold">Pro SaaS</span>
            </div>
          </div>
          <SidebarClose className="rounded-lg border border-sidebar-border/70 bg-sidebar-accent/40" />
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3">
        <NavMenu />
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-border/50">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-xs font-bold text-primary">
            {profile?.ownerName?.charAt(0) || 'U'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold truncate">{profile?.companyName}</span>
            <span className="text-[10px] text-muted-foreground truncate">{profile?.email}</span>
          </div>
        </div>
        <ThemeToggle className="w-full justify-center mb-3" />
        <button
          onClick={handleLogout}
          className="w-full h-10 flex items-center gap-3 px-4 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-bold">Logout</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function TransporterLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, auth, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (loading || redirecting) return;

    if (!user) {
      router.push("/login");
      return;
    }

    const accessIssue = getTransporterAccessIssue(profile);
    if (accessIssue && auth) {
      if (profile?.accountStatus === "pending") {
        return;
      }

      setRedirecting(true);
      toast({
        title: "Access Denied",
        description: accessIssue,
        variant: "destructive",
      });
      signOut(auth).finally(() => router.push("/login"));
    }
  }, [auth, loading, profile, redirecting, router, toast, user]);

  if (loading || !user || redirecting) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (profile?.accountStatus === "pending") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px] pointer-events-none" />
        <div className="w-full max-w-md bg-card border border-border/50 shadow-2xl p-8 rounded-2xl text-center space-y-6 relative z-10">
          <div className="mx-auto w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center shadow-lg border border-orange-500/20">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-headline font-bold">Account Pending Approval</h2>
            <p className="text-primary text-sm font-bold">
              Your account is pending admin approval.
            </p>
            <p className="text-muted-foreground text-sm">
              Thank you for registering <strong>{profile?.companyName}</strong>. 
              Your account is currently under review by our admin team.
            </p>
            <p className="text-muted-foreground text-xs">
              You will get access to the dashboard as soon as your account is approved.
            </p>
          </div>
          <Button onClick={() => logout()} variant="outline" className="w-full h-11 font-bold">
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <TransporterSidebar />
        <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
          <MobileHeader />
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="max-w-7xl mx-auto p-4 md:p-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
