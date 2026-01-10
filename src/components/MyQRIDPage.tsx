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
 * ✅ Real backend integration via getStoredUser()
 * ✅ Skeleton loading while fetching user data
 * 
 * =============================================================================
 */

import { useState, useEffect, useRef } from "react";
import { Download, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { PageLayout, Button, DESIGN_TOKENS } from "./design-system";
import { getStoredUser, fetchUserProfile } from "../services/gasLoginService";

interface MyQRIDPageProps {
  onClose: () => void;
  isDark: boolean;
}

// Shared shimmer styles - matches SkeletonCard.tsx pattern
const ShimmerStyles = () => (
  <style>{`
    .skeleton-shimmer {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.4) 50%,
        transparent 100%
      );
      animation: shimmer 1.5s infinite;
    }

    .dark .skeleton-shimmer {
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.1) 50%,
        transparent 100%
      );
    }

    @keyframes shimmer {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(100%);
      }
    }
  `}</style>
);

// Skeleton Loading Component - matches existing design system
function SkeletonLoader({ isDark }: { isDark: boolean }) {
  const qrSize = typeof window !== "undefined" && window.innerWidth < 768 
    ? DESIGN_TOKENS.media.qrCode.sizeMobile 
    : DESIGN_TOKENS.media.qrCode.sizeDesktop;

  return (
    <div className={isDark ? 'dark' : ''}>
      <ShimmerStyles />
      
      {/* QR Code Skeleton */}
      <div
        className="inline-block rounded-2xl mx-auto"
        style={{
          padding: `${DESIGN_TOKENS.spacing.scale.lg}px`,
          border: `${DESIGN_TOKENS.media.qrCode.outlineThickness}px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          marginBottom: `${DESIGN_TOKENS.spacing.scale.xl}px`,
        }}
      >
        <div 
          className={`rounded-lg relative overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
          style={{ 
            width: qrSize,
            height: qrSize,
          }}
        >
          <div className="skeleton-shimmer" />
        </div>
      </div>

      {/* User Info Skeleton */}
      <div style={{ marginBottom: `${DESIGN_TOKENS.spacing.scale.xl}px` }}>
        {/* Name */}
        <div 
          className={`rounded-lg mx-auto relative overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
          style={{ 
            height: '32px', 
            width: '200px',
            marginBottom: `${DESIGN_TOKENS.spacing.scale.sm}px`,
          }}
        >
          <div className="skeleton-shimmer" />
        </div>
        {/* Position */}
        <div 
          className={`rounded-lg mx-auto relative overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
          style={{ 
            height: '24px', 
            width: '150px',
            marginBottom: `${DESIGN_TOKENS.spacing.scale.xs}px`,
          }}
        >
          <div className="skeleton-shimmer" />
        </div>
        {/* ID Code */}
        <div 
          className={`rounded-lg mx-auto relative overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
          style={{ 
            height: '20px', 
            width: '120px',
          }}
        >
          <div className="skeleton-shimmer" />
        </div>
      </div>

      {/* Instructions Skeleton */}
      <div
        className="border-t pt-6 max-w-md mx-auto"
        style={{
          borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
        }}
      >
        <div 
          className={`rounded-lg mx-auto relative overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
          style={{ height: '16px', width: '280px' }}
        >
          <div className="skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

export default function MyQRIDPage({
  onClose,
  isDark,
}: MyQRIDPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<{
    fullName: string;
    idCode: string;
    position: string;
  } | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  // Fetch user data from stored session on mount
  useEffect(() => {
    const loadUserData = async () => {
      setIsLoading(true);
      
      try {
        // First try to get from stored session
        const storedUser = getStoredUser();
        
        if (storedUser) {
          // Try to fetch full profile for more details
          try {
            const profileResponse = await fetchUserProfile(storedUser.username);
            if (profileResponse.success && profileResponse.profile) {
              setUserData({
                fullName: profileResponse.profile.fullName || storedUser.name,
                idCode: profileResponse.profile.idCode || storedUser.id,
                position: profileResponse.profile.position || storedUser.position || 'Member',
              });
            } else {
              // Fallback to stored session data
              setUserData({
                fullName: storedUser.name,
                idCode: storedUser.id,
                position: storedUser.position || 'Member',
              });
            }
          } catch {
            // If profile fetch fails, use stored session data
            setUserData({
              fullName: storedUser.name,
              idCode: storedUser.id,
              position: storedUser.position || 'Member',
            });
          }
        } else {
          // No user logged in - redirect or show error
          toast.error('Please log in to view your QR ID');
          onClose();
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        toast.error('Failed to load user data');
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [onClose]);

  const handleSaveQR = () => {
    if (!userData || !qrRef.current) {
      toast.error('Unable to save QR Code');
      return;
    }

    try {
      // Get the SVG element
      const svg = qrRef.current.querySelector('svg');
      if (!svg) {
        toast.error('QR Code not found');
        return;
      }

      // Create canvas to render the full QR ID card
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        toast.error('Unable to create canvas');
        return;
      }

      // Configuration
      const padding = 40;
      const orangeBorderWidth = 4;
      const qrPadding = 16; // Padding inside the orange border
      const nameHeight = 40;
      const idHeight = 30;
      const spacingBetween = 20;
      
      const svgRect = svg.getBoundingClientRect();
      const qrBoxWidth = svgRect.width + (qrPadding * 2) + (orangeBorderWidth * 2);
      const qrBoxHeight = svgRect.height + (qrPadding * 2) + (orangeBorderWidth * 2);
      
      // Total canvas size
      canvas.width = Math.max(qrBoxWidth, 300) + (padding * 2);
      canvas.height = nameHeight + spacingBetween + qrBoxHeight + spacingBetween + idHeight + (padding * 2);

      // Fill white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw user name at top
      ctx.fillStyle = DESIGN_TOKENS.colors.brand.red;
      ctx.font = 'bold 24px "Lexend", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(userData.fullName, canvas.width / 2, padding + (nameHeight / 2));

      // Calculate QR box position (centered)
      const qrBoxX = (canvas.width - qrBoxWidth) / 2;
      const qrBoxY = padding + nameHeight + spacingBetween;

      // Draw orange border rectangle
      ctx.fillStyle = DESIGN_TOKENS.colors.brand.orange;
      ctx.beginPath();
      ctx.roundRect(qrBoxX, qrBoxY, qrBoxWidth, qrBoxHeight, 16);
      ctx.fill();

      // Draw white background inside the border
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(
        qrBoxX + orangeBorderWidth, 
        qrBoxY + orangeBorderWidth, 
        qrBoxWidth - (orangeBorderWidth * 2), 
        qrBoxHeight - (orangeBorderWidth * 2), 
        12
      );
      ctx.fill();

      // Convert SVG to image and draw
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        // Draw QR code centered inside the border
        const qrX = qrBoxX + orangeBorderWidth + qrPadding;
        const qrY = qrBoxY + orangeBorderWidth + qrPadding;
        ctx.drawImage(img, qrX, qrY);
        URL.revokeObjectURL(url);

        // Draw ID code at bottom
        ctx.fillStyle = '#6B7280'; // Gray color for ID
        ctx.font = '600 18px "Lexend", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`ID: ${userData.idCode}`, canvas.width / 2, qrBoxY + qrBoxHeight + spacingBetween + (idHeight / 2));

        // Download the image
        const link = document.createElement('a');
        link.download = `${userData.idCode}_${userData.fullName.replace(/\s/g, '_')}_QR.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        toast.success('QR ID Card Downloaded', {
          description: `Saved as ${userData.idCode}_${userData.fullName.replace(/\s/g, '_')}_QR.png`,
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast.error('Failed to generate QR image');
      };
      img.src = url;
    } catch (error) {
      console.error('Error saving QR:', error);
      toast.error('Failed to save QR Code');
    }
  };

  // Determine QR size based on screen
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
        !isLoading && userData ? (
          <Button
            variant="primary"
            onClick={handleSaveQR}
            icon={<Download className="w-5 h-5" />}
          >
            Save as PNG
          </Button>
        ) : undefined
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
        {isLoading ? (
          <SkeletonLoader isDark={isDark} />
        ) : userData ? (
          <>
            {/* QR Code Container with Orange Outline */}
            <div
              ref={qrRef}
              className="inline-block bg-white rounded-2xl mx-auto"
              style={{
                padding: `${DESIGN_TOKENS.spacing.scale.lg}px`,
                border: `${DESIGN_TOKENS.media.qrCode.outlineThickness}px solid ${DESIGN_TOKENS.colors.brand.orange}`,
                marginBottom: `${DESIGN_TOKENS.spacing.scale.xl}px`,
              }}
            >
              <QRCodeSVG
                value={userData.idCode}
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
                {userData.fullName}
              </h2>
              <p
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.orange,
                  marginBottom: `${DESIGN_TOKENS.spacing.scale.xs}px`,
                }}
              >
                {userData.position}
              </p>
              <p
                className="text-muted-foreground"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.normal,
                }}
              >
                ID: {userData.idCode}
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
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Unable to load QR Code. Please try logging in again.</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
