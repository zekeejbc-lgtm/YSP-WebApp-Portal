/**
 * =============================================================================
 * MY QR ID PAGE
 * =============================================================================
 * 
 * SMART SPEC COMPLIANCE:
 * ✅ Uses PageLayout master component
 * ✅ QR Code: 280px desktop, 200px mobile
 * ✅ Orange outline: 4px thickness
 * ✅ Save button: Primary variant, proper sizing
 * ✅ Center-aligned layout
 * 
 * =============================================================================
 */

import { Download, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { PageLayout, Button, DESIGN_TOKENS } from "./design-system";

interface MyQRIDPageProps {
  onClose: () => void;
  isDark: boolean;
  userInfo?: {
    fullName: string;
    idCode: string;
    position: string;
  };
}

export default function MyQRIDPage({
  onClose,
  isDark,
  userInfo,
}: MyQRIDPageProps) {
  const defaultUser = userInfo || {
    fullName: "Juan Dela Cruz",
    idCode: "MEM-001",
    position: "Chapter President",
  };

  const handleSaveQR = () => {
    // In a real app, this would generate a PNG file
    toast.success("QR Code Downloaded", {
      description: `${defaultUser.idCode}_${defaultUser.fullName.replace(
        /\s/g,
        "_"
      )}.png`,
    });
  };

  // Determine QR size based on screen (use media query in real implementation)
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const qrSize = isMobile
    ? DESIGN_TOKENS.media.qrCode.sizeMobile
    : DESIGN_TOKENS.media.qrCode.sizeDesktop;

  return (
    <PageLayout
      title="My QR ID"
      subtitle="Present this QR code during events for attendance recording"
      isDark={isDark}
      onClose={onClose}
      breadcrumbs={[
        { label: "Home", onClick: onClose },
        { label: "Attendance Management", onClick: undefined },
        { label: "My QR ID", onClick: undefined },
      ]}
      actions={
        <Button
          variant="primary"
          onClick={handleSaveQR}
          icon={<Download className="w-5 h-5" />}
        >
          Save as PNG
        </Button>
      }
    >
      {/* QR Code Card */}
      <div
        className="border rounded-lg text-center"
        style={{
          borderRadius: `${DESIGN_TOKENS.radius.card}px`,
          padding: `${DESIGN_TOKENS.spacing.scale["2xl"]}px`,
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.1)",
          background: isDark
            ? `rgba(17, 24, 39, ${DESIGN_TOKENS.glass.backdropOpacity.dark})`
            : `rgba(255, 255, 255, ${DESIGN_TOKENS.glass.backdropOpacity.light})`,
          backdropFilter: `blur(${DESIGN_TOKENS.glass.blur}px)`,
          WebkitBackdropFilter: `blur(${DESIGN_TOKENS.glass.blur}px)`,
        }}
      >
        {/* QR Code Container with Orange Outline */}
        <div
          className="inline-block bg-white rounded-2xl mx-auto"
          style={{
            padding: `${DESIGN_TOKENS.spacing.scale.lg}px`,
            border: `${DESIGN_TOKENS.media.qrCode.outlineThickness}px solid ${DESIGN_TOKENS.colors.brand.orange}`,
            marginBottom: `${DESIGN_TOKENS.spacing.scale.xl}px`,
          }}
        >
          <QRCodeSVG
            value={defaultUser.idCode}
            size={qrSize}
            level="H"
            includeMargin={true}
          />
        </div>

        {/* User Information */}
        <div
          style={{
            marginBottom: `${DESIGN_TOKENS.spacing.scale.xl}px`,
          }}
        >
          <h2
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
              fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              color: DESIGN_TOKENS.colors.brand.red,
              marginBottom: `${DESIGN_TOKENS.spacing.scale.sm}px`,
            }}
          >
            {defaultUser.fullName}
          </h2>
          <p
            style={{
              fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              color: DESIGN_TOKENS.colors.brand.orange,
              marginBottom: `${DESIGN_TOKENS.spacing.scale.xs}px`,
            }}
          >
            {defaultUser.position}
          </p>
          <p
            className="text-muted-foreground"
            style={{
              fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.normal,
            }}
          >
            ID: {defaultUser.idCode}
          </p>
        </div>

        {/* Instructions */}
        <div
          className="border-t pt-6 max-w-md mx-auto"
          style={{
            borderColor: isDark
              ? "rgba(255, 255, 255, 0.1)"
              : "rgba(0, 0, 0, 0.1)",
          }}
        >
          <p
            className="text-muted-foreground"
            style={{
              fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.normal,
            }}
          >
            <Smartphone className="w-4 h-4 inline-block mr-2" />
            Show this QR code to event organizers for quick check-in
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
