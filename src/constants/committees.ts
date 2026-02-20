export interface CommitteeItem {
  id: string;
  name: string;
}

export const YSP_COMMITTEES: CommitteeItem[] = [
  { id: "executive-board", name: "Executive Board" },
  { id: "membership-internal-affairs", name: "Membership and Internal Affairs Committee" },
  { id: "external-relations", name: "External Relations Committee" },
  { id: "secretariat-documentation", name: "Secretariat and Documentation Committee" },
  { id: "finance-treasury", name: "Finance and Treasury Committee" },
  { id: "program-development", name: "Program Development Committee" },
  { id: "communications-marketing", name: "Communications and Marketing Committee" },
  { id: "barangay-chapter-leaders", name: "Barangay Chapter Leaders" },
  { id: "general-members", name: "General Members" },
  { id: "volunteers", name: "Volunteers" },
  { id: "probationary-members", name: "Probationary Members" },
];

export const YSP_COMMITTEE_NAMES = YSP_COMMITTEES.map((c) => c.name);

export const YSP_COMMITTEE_OPTIONS = YSP_COMMITTEES.map((c) => ({
  value: c.name,
  label: c.name,
}));
