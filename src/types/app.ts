import type React from "react";

// Donation type definition
export interface Donation {
  id: number;
  name: string;
  amount: number;
  date: string;
  status: "pending" | "verified" | "rejected";
  receiptUrl?: string;
}

// Pending Application type definition
export interface PendingApplication {
  id: string;
  name: string;
  email: string;
  phone: string;
  dateApplied: string;
  committee: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  rejectionMessage?: string;
  adminNotes?: string;
  approvedBy?: string;
  approvedDate?: string;
  rejectedBy?: string;
  rejectedDate?: string;
  accountCreated?: boolean;
  fullData: ApplicationData;
}

export interface ApplicationData {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string;
  age: number;
  gender: string;
  civilStatus: string;
  nationality: string;
  chapter: string;
  committeePreference: string;
  desiredRole: string;
  skills?: string;
  education?: string;
  certifications?: string;
  experience?: string;
  achievements?: string;
  volunteerHistory?: string;
  reasonForJoining?: string;
  personalStatement?: string;
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactNumber?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  attachments?: {
    type: string;
    name: string;
    url: string;
  }[];
  profilePicture?: string;
}

// Navigation types
export interface NavPage {
  id: string;
  label: string;
  action: () => void;
  roles?: string[]; // Optional: roles that can see this page
  icon?: React.ReactNode;
}

export interface NavGroup {
  id: string;
  label: string;
  pages: NavPage[];
  roles?: string[]; // Optional: roles that can see this group
  icon?: React.ReactNode;
}

// Social Media Platform Detection Helper
export interface SocialPlatform {
  name: string;
  color: string;
  bgColor: string;
  darkBgColor: string;
  borderColor: string;
  darkBorderColor: string;
  icon: string; // SVG path or emoji
}

// Role hierarchy levels
export const ROLE_HIERARCHY: Record<string, number> = {
  banned: 0,
  suspended: 1,
  guest: 2,
  member: 2,
  head: 3,
  admin: 4,
  auditor: 5,
};
