export interface Prospect {
  firstName: string;
  lastName: string;
  phone: string;
  sessionId: string;
}

export type Role = "admin" | "receptionist" | "nurse" | "doctor";

export interface SceneMeta {
  id: number;
  role: Role | null;
  title: string;
  page: string;       // which nav item is active
  interactive: boolean;
  duration?: number;  // ms for auto-advance
  smsBanner?: string; // message shown as SMS banner at scene start (use {firstName} token)
}

export const SCENES: SceneMeta[] = [
  { id: 1,  role: "admin",        title: "Admin Dashboard",      page: "/",             interactive: false, duration: 5000 },
  { id: 2,  role: "admin",        title: "Register Patient",     page: "/patients/new", interactive: true  },
  { id: 3,  role: "admin",        title: "Live Pipeline",        page: "/pipeline",     interactive: false, duration: 3500 },
  { id: 4,  role: "receptionist", title: "Queue Management",     page: "/queue",        interactive: true  },
  { id: 5,  role: "receptionist", title: "Patient Called In",    page: "/queue",        interactive: true,
     smsBanner: "It's your turn! Please head to the consultation room. — ERA Hospital" },
  { id: 6,  role: "nurse",        title: "Treatment Plan",       page: "/nurse-station",interactive: true  },
  { id: 7,  role: "admin",        title: "Message Log",          page: "/message-log",  interactive: false, duration: 6500 },
  { id: 8,  role: "doctor",       title: "Doctor View",          page: "/doctor-view",  interactive: true  },
  { id: 9,  role: "admin",        title: "Feedback",             page: "/feedback-admin",interactive: false, duration: 5000 },
  { id: 10, role: null,           title: "EMR Integration",      page: "",              interactive: false, duration: 6000 },
  { id: 11, role: null,           title: "Get Started",          page: "",              interactive: false },
];

export const ROLE_LABELS: Record<Role, string> = {
  admin:        "Admin",
  receptionist: "Receptionist",
  nurse:        "Nurse",
  doctor:       "Doctor",
};

export const ROLE_COLORS: Record<Role, string> = {
  admin:        "bg-primary/15 text-primary border-primary/30",
  receptionist: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  nurse:        "bg-violet-500/15 text-violet-400 border-violet-500/30",
  doctor:       "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

// Pipeline stage colors matching real ERA Patient
export const PIPELINE_STAGES = [
  { name: "Booked",          color: "#14b8a6", count: 23 },
  { name: "Queued",          color: "#f59e0b", count: 5  },
  { name: "In Care",         color: "#3b82f6", count: 12 },
  { name: "Post Treatment",  color: "#8b5cf6", count: 48 },
  { name: "Active",          color: "#06b6d4", count: 142},
  { name: "Dormant",         color: "#6b7280", count: 18 },
];
