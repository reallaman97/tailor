import {
  SparklesIcon,
  MicIcon,
  CalendarIcon,
  TargetIcon,
  UsersIcon,
  DollarSignIcon,
} from "@/components/icons";
import type { UserRole } from "@/generated/prisma/client";

export type ToolDefinition = {
  key: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Path to enter the tool once access is granted (ignored while `released` is false). */
  href: string;
  /** Whether the tool actually has a working app behind it yet. */
  released: boolean;
  /** Roles allowed to use this tool once released. Superadmin always has access to everything regardless of this list. */
  roles: UserRole[];
};

export const TOOLS: ToolDefinition[] = [
  {
    key: "resume-platform",
    name: "Resume Platform",
    description: "Build your profile once, tailor a resume for every job, and track every application.",
    icon: SparklesIcon,
    href: "/resumes",
    released: true,
    roles: ["BIDDER"],
  },
  {
    key: "interview-management",
    name: "Interview Management",
    description: "Schedule, assign, and track interviews across a configurable pipeline.",
    icon: CalendarIcon,
    href: "/interview",
    released: true,
    // Managers run the whole pipeline; Callers see (and act on) the interviews
    // assigned to them. Superadmin always has access regardless of this list.
    roles: ["MANAGER", "CALLER"],
  },
  {
    key: "interview-ai",
    name: "Interview AI Assistant",
    description: "Practice interviews and get real-time feedback from an AI coach.",
    icon: MicIcon,
    href: "/tools/interview-ai",
    released: false,
    roles: ["CALLER"],
  },
  {
    key: "meeting-calendar",
    name: "Meeting Calendar",
    description: "Schedule and track interviews and follow-ups in one calendar.",
    icon: CalendarIcon,
    href: "/tools/meeting-calendar",
    released: false,
    roles: ["CALLER"],
  },
  {
    key: "networking-hub",
    name: "Networking Hub",
    description: "Find and manage warm introductions at companies you're targeting.",
    icon: UsersIcon,
    href: "/tools/networking-hub",
    released: false,
    roles: ["CALLER"],
  },
  {
    key: "career-coach",
    name: "Career Coach AI",
    description: "Get personalized guidance on your job search strategy.",
    icon: TargetIcon,
    href: "/tools/career-coach",
    released: false,
    roles: [],
  },
  {
    key: "salary-insights",
    name: "Salary Insights",
    description: "Benchmark offers and negotiate with real market data.",
    icon: DollarSignIcon,
    href: "/tools/salary-insights",
    released: false,
    roles: [],
  },
];

/** Superadmin can always access every tool; every other role needs to be on that tool's explicit allowlist. */
export function canAccessTool(role: UserRole, tool: ToolDefinition): boolean {
  return role === "SUPERADMIN" || tool.roles.includes(role);
}

/** Every tool this role is allowed to use, in the platform's canonical order. */
export function toolsForRole(role: UserRole): ToolDefinition[] {
  return TOOLS.filter((tool) => canAccessTool(role, tool));
}

export type ToolStatus = "open" | "restricted" | "coming-soon";

/**
 * How a tool should render for this role — every tool is always shown (never
 * hidden), but a tool this role can't use is "restricted" rather than "open",
 * distinct from "coming-soon" (not built yet, for anyone). Actual enforcement
 * happens server-side (e.g. requireResumePlatformAccess()); this only drives
 * the hub's display.
 */
export function toolStatusFor(role: UserRole, tool: ToolDefinition): ToolStatus {
  if (!tool.released) return "coming-soon";
  return canAccessTool(role, tool) ? "open" : "restricted";
}
