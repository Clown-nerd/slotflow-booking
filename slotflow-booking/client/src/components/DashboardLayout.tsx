import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/" },
  { icon: CalendarDays, label: "Calendar", path: "/#calendar" },
  { icon: Users, label: "Operations", path: "/manage" },
  { icon: Wrench, label: "Resources", path: "/manage" },
];

export default function DashboardLayout({
  children,
  allowDemo = false,
}: {
  children: React.ReactNode;
  allowDemo?: boolean;
}) {
  const { loading, user } = useAuth();

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user && !allowDemo) {
    return (
      <main className="min-h-screen grid place-items-center bg-background p-6">
        <section className="surface-card max-w-md rounded-[1.6rem] p-8 text-center">
          <div className="mx-auto mb-6 grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            SlotFlow workspace
          </p>
          <h1 className="font-display mt-3 text-3xl tracking-tight">
            Sign in to manage your studio.
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Your booking calendar, services, resources, and customer records are
            private to your workspace.
          </p>
          <Button
            onClick={() => startLogin()}
            className="pressable mt-7 w-full rounded-xl bg-primary py-5 text-primary-foreground hover:bg-primary/90"
          >
            Sign in to SlotFlow
          </Button>
        </section>
      </main>
    );
  }

  return <DashboardChrome>{children}</DashboardChrome>;
}

function DashboardChrome({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();

  return (
    <SidebarProvider defaultOpen>
      <Sidebar
        collapsible="icon"
        className="border-r border-sidebar-border/80 bg-sidebar"
      >
        <SidebarHeader className="h-20 px-4 pt-4">
          <div className="flex items-center gap-3 px-1 group-data-[collapsible=icon]:justify-center">
            <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_9px_20px_oklch(0.33_0.047_142_/_22%)]">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="font-display text-lg leading-5">SlotFlow</p>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                Atelier Nia
              </p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-3 py-4">
          <SidebarMenu>
            {menuItems
              .filter((item, index) => item.path !== "/manage" || index === 2)
              .map(item => {
                const selected =
                  location === item.path ||
                  (item.path.includes("#") && location === "/");
                return (
                  <SidebarMenuItem key={`${item.label}-${item.path}`}>
                    <SidebarMenuButton
                      isActive={selected}
                      tooltip={item.label}
                      onClick={() => {
                        setLocation(item.path);
                        const target = item.path.split("#")[1];
                        if (target)
                          window.setTimeout(
                            () =>
                              document
                                .getElementById(target)
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                }),
                            30
                          );
                      }}
                      className="h-11 rounded-xl px-3 text-[13px] font-medium data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:shadow-sm"
                    >
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
          </SidebarMenu>
          <div className="mt-7 rounded-2xl bg-secondary/70 p-3.5 group-data-[collapsible=icon]:hidden">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Booking link
            </p>
            <p className="mt-1.5 text-xs leading-5 text-foreground">
              Share your page and let the schedule fill itself.
            </p>
            <button
              onClick={() => setLocation("/book/slotflow-studio")}
              className="mt-3 text-xs font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
            >
              Open public page
            </button>
          </div>
        </SidebarContent>
        <SidebarFooter className="p-3 pb-4">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center">
                  <Avatar className="size-8 border border-sidebar-border">
                    <AvatarFallback className="bg-secondary text-[11px] font-semibold text-secondary-foreground">
                      {user.name?.slice(0, 2).toUpperCase() || "SF"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="truncate text-xs font-semibold">
                      {user.name || "Studio owner"}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      Owner workspace
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer rounded-lg text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={() => startLogin()}
              variant="outline"
              className="h-9 w-full rounded-xl border-border bg-card text-xs font-semibold group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:px-0"
            >
              <span className="group-data-[collapsible=icon]:hidden">
                Sign in to customize
              </span>
              <Sparkles className="hidden size-4 group-data-[collapsible=icon]:block" />
            </Button>
          )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-h-screen bg-background">
        {isMobile && (
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/80 bg-background/90 px-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="rounded-xl" />
              <span className="font-display text-lg">SlotFlow</span>
            </div>
            <button
              onClick={() => setLocation("/book/slotflow-studio")}
              className="text-xs font-semibold text-primary"
            >
              Booking page
            </button>
          </header>
        )}
        {!isMobile && (
          <button
            aria-label="Collapse navigation"
            onClick={() =>
              document
                .querySelector<HTMLButtonElement>("[data-sidebar=trigger]")
                ?.click()
            }
            className="absolute left-4 top-5 z-20 grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            <PanelLeft className="size-4" />
          </button>
        )}
        <main className="min-h-screen px-4 pb-10 pt-5 sm:px-7 sm:pb-14 lg:px-10 lg:pt-7">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
