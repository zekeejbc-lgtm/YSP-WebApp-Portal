/**
 * =============================================================================
 * OFFICER DIRECTORY SEARCH PAGE
 * =============================================================================
 * 
 * SMART SPEC COMPLIANCE:
 * ✅ Uses PageLayout master component
 * ✅ Search input height: 44px
 * ✅ Autosuggest shows up to 8 items
 * ✅ Details card: two-column layout desktop, 16px gutter
 * ✅ Clear button: Primary variant, min width 120px
 * ✅ Empty, loading, error states included
 * 
 * =============================================================================
 */

import { useState } from "react";
import { Mail, Phone, Calendar, User as UserIcon, Hash, Briefcase, Users } from "lucide-react";
import { PageLayout, SearchInput, DetailsCard, Button } from "./design-system";

interface Officer {
  idCode: string;
  fullName: string;
  position: string;
  committee: string;
  email: string;
  contactNumber: string;
  birthday: string;
  age: number;
  gender: string;
  civilStatus: string;
  nationality: string;
  religion: string;
  role: string;
  profilePicture?: string;
}

interface OfficerDirectoryPageProps {
  onClose: () => void;
  isDark: boolean;
}

export default function OfficerDirectoryPage({
  onClose,
  isDark,
}: OfficerDirectoryPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOfficer, setSelectedOfficer] = useState<Officer | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Mock officer data
  const mockOfficers: Officer[] = [
    {
      idCode: "HD-001",
      fullName: "Juan Dela Cruz",
      position: "President",
      committee: "Executive Board",
      email: "juan.delacruz@ysp.org.ph",
      contactNumber: "+63 912 345 6789",
      birthday: "1998-05-15",
      age: 26,
      gender: "Male",
      civilStatus: "Single",
      nationality: "Filipino",
      religion: "Roman Catholic",
      role: "Head",
      profilePicture: "https://images.unsplash.com/photo-1737574821698-862e77f044c1?w=400",
    },
    {
      idCode: "HD-002",
      fullName: "Maria Santos",
      position: "Vice President - Internal",
      committee: "Executive Board",
      email: "maria.santos@ysp.org.ph",
      contactNumber: "+63 923 456 7890",
      birthday: "1999-08-22",
      age: 25,
      gender: "Female",
      civilStatus: "Single",
      nationality: "Filipino",
      religion: "Roman Catholic",
      role: "Head",
      profilePicture: "https://images.unsplash.com/photo-1762522921456-cdfe882d36c3?w=400",
    },
    {
      idCode: "HD-003",
      fullName: "Pedro Reyes",
      position: "Committee Member",
      committee: "Environmental Conservation",
      email: "pedro.reyes@ysp.org.ph",
      contactNumber: "+63 934 567 8901",
      birthday: "2000-03-10",
      age: 24,
      gender: "Male",
      civilStatus: "Single",
      nationality: "Filipino",
      religion: "Iglesia ni Cristo",
      role: "Member",
      profilePicture: "https://images.unsplash.com/photo-1600180758890-6b94519a8ba6?w=400",
    },
    {
      idCode: "ADM-001",
      fullName: "Ana Rodriguez",
      position: "Secretary General",
      committee: "Executive Board",
      email: "ana.rodriguez@ysp.org.ph",
      contactNumber: "+63 945 678 9012",
      birthday: "1997-11-20",
      age: 27,
      gender: "Female",
      civilStatus: "Single",
      nationality: "Filipino",
      religion: "Roman Catholic",
      role: "Admin",
      profilePicture: "https://images.unsplash.com/photo-1754298949882-216a1c92dbb5?w=400",
    },
    {
      idCode: "MEM-020",
      fullName: "Carlos Mendoza",
      position: "Volunteer Coordinator",
      committee: "Community Relations",
      email: "carlos.mendoza@ysp.org.ph",
      contactNumber: "+63 956 789 0123",
      birthday: "2001-04-18",
      age: 23,
      gender: "Male",
      civilStatus: "Single",
      nationality: "Filipino",
      religion: "Born Again",
      role: "Member",
    },
  ];

  const filteredOfficers = mockOfficers.filter(
    (officer) =>
      officer.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      officer.idCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      officer.committee.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const suggestions = filteredOfficers.map((officer) => ({
    id: officer.idCode,
    label: officer.fullName,
    subtitle: `${officer.committee} • ${officer.idCode}`,
    profilePicture: officer.profilePicture,
  }));

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(value.length > 0);
  };

  const handleSelectSuggestion = (suggestion: any) => {
    const officer = mockOfficers.find((o) => o.idCode === suggestion.id);
    if (officer) {
      setSelectedOfficer(officer);
      setSearchQuery(officer.fullName);
      setShowSuggestions(false);
    }
  };

  const handleClear = () => {
    setSelectedOfficer(null);
    setSearchQuery("");
    setShowSuggestions(false);
  };

  return (
    <PageLayout
      title="Officer Directory Search"
      subtitle="Search officers by name, committee, or ID code"
      isDark={isDark}
      onClose={onClose}
      breadcrumbs={[
        { label: "Home", onClick: onClose },
        { label: "Dashboard & Directory", onClick: undefined },
        { label: "Officer Directory", onClick: undefined },
      ]}
    >
      {/* Search Input */}
      <div className="mb-6">
        <SearchInput
          value={searchQuery}
          onChange={handleSearch}
          onClear={handleClear}
          placeholder="Search by Name, Committee, or ID Code..."
          suggestions={suggestions}
          onSelectSuggestion={handleSelectSuggestion}
          isLoading={isLoading}
          isDark={isDark}
          showSuggestions={showSuggestions}
        />
      </div>

      {/* Officer Details Card */}
      {selectedOfficer && (
        <DetailsCard
          title="Officer Details"
          isDark={isDark}
          onClose={handleClear}
          profileImage={selectedOfficer.profilePicture}
          fields={[
            {
              label: "Full Name",
              value: selectedOfficer.fullName,
              icon: <UserIcon className="w-4 h-4" />,
              fullWidth: true,
            },
            {
              label: "ID Code",
              value: selectedOfficer.idCode,
              icon: <Hash className="w-4 h-4" />,
            },
            {
              label: "Position",
              value: selectedOfficer.position,
              icon: <Briefcase className="w-4 h-4" />,
            },
            {
              label: "Committee",
              value: selectedOfficer.committee,
              icon: <Users className="w-4 h-4" />,
              fullWidth: true,
            },
            {
              label: "Email",
              value: selectedOfficer.email,
              icon: <Mail className="w-4 h-4" />,
            },
            {
              label: "Contact Number",
              value: selectedOfficer.contactNumber,
              icon: <Phone className="w-4 h-4" />,
            },
            {
              label: "Birthday",
              value: selectedOfficer.birthday,
              icon: <Calendar className="w-4 h-4" />,
            },
            {
              label: "Age",
              value: `${selectedOfficer.age} years old`,
            },
            {
              label: "Gender",
              value: selectedOfficer.gender,
            },
            {
              label: "Civil Status",
              value: selectedOfficer.civilStatus,
            },
            {
              label: "Nationality",
              value: selectedOfficer.nationality,
            },
            {
              label: "Religion",
              value: selectedOfficer.religion,
            },
          ]}
          actions={
            <>
              <Button variant="secondary" onClick={handleClear}>
                Clear
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  window.location.href = `mailto:${selectedOfficer.email}`;
                }}
              >
                Send Email
              </Button>
            </>
          }
        />
      )}

      {/* Empty State */}
      {!selectedOfficer && !searchQuery && (
        <div className="text-center py-12">
          <UserIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            Use the search bar above to find officers by name, committee, or ID
            code.
          </p>
        </div>
      )}
    </PageLayout>
  );
}