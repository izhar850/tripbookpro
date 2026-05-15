"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarFooter, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { Loader2, LayoutDashboard, Users, CreditCard, User, LogOut, Truck, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function TransporterLayout({ children }: { children: React.Node }) {
  const { user, profile, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Parties", href: "/parties", icon: Users },
    { name: "Billing", href: "/billing", icon: CreditCard },
    { name: "Profile", href: "/profile", icon: User },
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r border-border/50 bg-card">
          <SidebarHeader className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-primary rounded-lg flex items-center justify-center shadow-md">
                <Truck className="text-white w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-headline font-bold text-lg leading-tight">TripBook</span>
                <span className="text-[10px] uppercase tracking-widest text-primary font-bold">Pro SaaS</span>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent className="px-3">
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <Link href={item.href} passHref>
                    <SidebarMenuButton 
                      isActive={pathname === item.href}
                      className={cn(
                        "w-full h-11 px-4 flex items-center gap-3 rounded-lg transition-all duration-200",
                        pathname === item.href 
                          ? "bg-primary/10 text-primary font-bold" 
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      <item.icon className={cn("w-5 h-5", pathname === item.href ? "text-primary" : "")} />
                      <span>{item.name}</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
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
            <button
              onClick={logout}
              className="w-full h-10 flex items-center gap-3 px-4 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-bold">Logout</span>
            </button>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
          {/* Mobile Header with Sidebar Trigger */}
          <header className="flex md:hidden items-center justify-between p-4 border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-primary rounded flex items-center justify-center">
                <Truck className="text-white w-4 h-4" />
              </div>
              <span className="font-headline font-bold text-sm tracking-tight">TripBook Pro</span>
            </div>
            <SidebarTrigger>
              <Button size="icon" variant="ghost" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SidebarTrigger>
          </header>

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
