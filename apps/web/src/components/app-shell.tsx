import { Avatar, AvatarFallback, AvatarImage } from "@spotify-stats/ui/components/avatar";
import { Toaster } from "@spotify-stats/ui/components/sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@spotify-stats/ui/components/sidebar";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  AudioLinesIcon,
  HistoryIcon,
  LibraryIcon,
  LogOutIcon,
  NewspaperIcon,
  SearchIcon,
  TrophyIcon,
  UserIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { SpotifyIcon } from "./music";

const nav = [
  { to: "/overview", label: "Overview", icon: NewspaperIcon },
  { to: "/top", label: "Top charts", icon: TrophyIcon },
  { to: "/recent", label: "Recently played", icon: HistoryIcon },
  { to: "/library", label: "Library", icon: LibraryIcon },
  { to: "/search", label: "Search", icon: SearchIcon },
  { to: "/player", label: "Now playing", icon: AudioLinesIcon },
] as const;

export type ShellUser = { displayName: string | null; imageUrl: string | null };

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form method="post" action="/auth/logout" className={className}>
      <button
        type="submit"
        className="inline-flex min-h-9 w-full items-center gap-2 px-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
      >
        <LogOutIcon className="size-4" aria-hidden="true" />
        Sign out
      </button>
    </form>
  );
}

export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const name = user.displayName ?? "Spotify listener";

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="px-3 py-4">
          <Link to="/overview" className="flex items-baseline gap-2 overflow-hidden">
            <span className="font-display text-2xl italic leading-none text-highlight">S</span>
            <span className="truncate font-display text-xl leading-none group-data-[collapsible=icon]:hidden">
              Spotify Stats
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Listening</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(item.to)}
                      tooltip={item.label}
                      render={<Link to={item.to} />}
                    >
                      <item.icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                isActive={pathname.startsWith("/account")}
                tooltip="Account"
                render={<Link to="/account" />}
              >
                <Avatar className="size-8">
                  {user.imageUrl && <AvatarImage src={user.imageUrl} alt="" />}
                  <AvatarFallback>
                    <UserIcon className="size-4" aria-hidden="true" />
                  </AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs text-muted-foreground">Account & privacy</span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <LogoutButton className="group-data-[collapsible=icon]:hidden" />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="paper min-w-0">
        <div className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur md:hidden">
          <SidebarTrigger className="size-10" aria-label="Open navigation" />
          <span className="font-display text-lg">Spotify Stats</span>
        </div>
        <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 py-8 sm:px-8 lg:py-12">
          {children}
        </main>
        <SpotifyAttribution />
      </SidebarInset>
      <Toaster theme="dark" closeButton />
    </SidebarProvider>
  );
}

export function SpotifyAttribution() {
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 border-t border-border px-4 py-6 text-sm text-faint-foreground sm:px-8">
      <span className="inline-flex items-center gap-2">
        <SpotifyIcon className="size-5" />
        Content and metadata provided by Spotify.
      </span>
      <Link to="/privacy" className="hover:text-foreground hover:underline">
        Privacy
      </Link>
      <span>Self-hosted · not affiliated with Spotify</span>
    </footer>
  );
}
