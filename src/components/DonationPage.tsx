import { useState } from 'react';
import { ArrowLeft, Phone, Upload, X, Check, Copy, AlertCircle, Heart, Users, TrendingUp, Clock, CheckCircle, XCircle, Moon, Sun } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { toast } from 'sonner@2.0.3';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import Breadcrumb from './design-system/Breadcrumb';

interface Donation {
  id: number;
  name: string;
  amount: number;
  date: string;
  status: 'pending' | 'verified' | 'rejected';
  receiptUrl?: string;
}

interface DonationPageProps {
  onClose: () => void;
  donations: Donation[];
  onDonationsUpdate: (donations: Donation[]) => void;
  isAdmin: boolean;
}

export default function DonationPage({ onClose, donations, onDonationsUpdate, isAdmin }: DonationPageProps) {
  const [showPaymentModal, setShowPaymentModal] = useState<'gcash' | 'maya' | null>(null);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [donorName, setDonorName] = useState('');
  const [donationAmount, setDonationAmount] = useState('');
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);

  const toggleDark = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const totalDonations = donations
    .filter(d => d.status === 'verified')
    .reduce((sum, d) => sum + d.amount, 0);

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size too large', {
          description: 'Please upload an image smaller than 10MB'
        });
        return;
      }
      if (!file.type.match(/image\/(png|jpg|jpeg)/)) {
        toast.error('Invalid file type', {
          description: 'Please upload a PNG or JPG image'
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptImage(reader.result as string);
        toast.success('Receipt uploaded successfully!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDonationSubmit = () => {
    if (!donationAmount || parseFloat(donationAmount) <= 0) {
      toast.error('Invalid amount', {
        description: 'Please enter a valid donation amount'
      });
      return;
    }
    if (!receiptImage) {
      toast.error('Receipt required', {
        description: 'Please upload your payment receipt'
      });
      return;
    }

    const newDonation: Donation = {
      id: donations.length + 1,
      name: donorName || 'Anonymous',
      amount: parseFloat(donationAmount),
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      receiptUrl: receiptImage
    };

    onDonationsUpdate([newDonation, ...donations]);
    toast.success('Donation submitted!', {
      description: 'Thank you for your generous support. Your donation is pending verification.'
    });

    // Reset form
    setDonorName('');
    setDonationAmount('');
    setReceiptImage(null);
  };

  const copyToClipboard = (text: string, type: string) => {
    // Try modern Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopiedAccount(type);
          toast.success('Copied to clipboard!', {
            description: `${type} account number copied`
          });
          setTimeout(() => setCopiedAccount(null), 2000);
        })
        .catch(() => {
          // Fallback to older method
          fallbackCopyTextToClipboard(text, type);
        });
    } else {
      // Use fallback for older browsers
      fallbackCopyTextToClipboard(text, type);
    }
  };

  const fallbackCopyTextToClipboard = (text: string, type: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        setCopiedAccount(type);
        toast.success('Copied to clipboard!', {
          description: `${type} account number copied`
        });
        setTimeout(() => setCopiedAccount(null), 2000);
      } else {
        toast.error('Copy failed', {
          description: `Please manually copy: ${text}`
        });
      }
    } catch (err) {
      document.body.removeChild(textArea);
      toast.error('Copy failed', {
        description: `Please manually copy: ${text}`
      });
    }
  };

  const handleVerifyDonation = (id: number) => {
    onDonationsUpdate(donations.map(d => 
      d.id === id ? { ...d, status: 'verified' as const } : d
    ));
    toast.success('Donation verified!');
  };

  const handleRejectDonation = (id: number) => {
    onDonationsUpdate(donations.map(d => 
      d.id === id ? { ...d, status: 'rejected' as const } : d
    ));
    toast.error('Donation rejected');
  };

  const handleDeleteDonation = (id: number) => {
    onDonationsUpdate(donations.filter(d => d.id !== id));
    toast.success('Donation deleted');
  };

  const verifiedCount = donations.filter(d => d.status === 'verified').length;
  const pendingCount = donations.filter(d => d.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-orange-300/30 dark:bg-orange-500/20 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-70 animate-blob" />
        <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300/30 dark:bg-yellow-500/20 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-red-300/30 dark:bg-red-500/20 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-70 animate-blob animation-delay-4000" />
        <div className="absolute bottom-20 right-20 w-72 h-72 bg-pink-300/30 dark:bg-pink-500/20 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-70 animate-blob animation-delay-6000" />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Button
              onClick={onClose}
              variant="ghost"
              size="lg"
              className="gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 group"
            >
              <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
              Back to Home
            </Button>
            
            <div className="flex items-center gap-3">
              <Heart className="w-6 h-6 text-red-500 animate-pulse" />
              <h1 
                className="text-2xl md:text-3xl"
                style={{
                  fontFamily: 'var(--font-headings)',
                  fontWeight: 'var(--font-weight-bold)',
                  background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 50%, #fbcb29 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                Support Our Mission
              </h1>
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDark}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300 hover:rotate-180 flex items-center justify-center"
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 relative z-10" style={{ paddingTop: '120px' }}>
        {/* Breadcrumbs */}
        <Breadcrumb
          items={[
            { label: "Home", onClick: onClose },
            { label: "Donations", onClick: undefined },
          ]}
          isDark={isDark}
        />

        {/* Hero Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Total Donations */}
          <Card className="border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
                <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                  Verified
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle 
                className="text-4xl mb-2 text-green-600 dark:text-green-400"
                style={{ fontFamily: 'var(--font-headings)' }}
              >
                ₱{totalDonations.toLocaleString()}
              </CardTitle>
              <CardDescription>Total Donations Received</CardDescription>
            </CardContent>
          </Card>

          {/* Verified Donors */}
          <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle 
                className="text-4xl mb-2 text-blue-600 dark:text-blue-400"
                style={{ fontFamily: 'var(--font-headings)' }}
              >
                {verifiedCount}
              </CardTitle>
              <CardDescription>Verified Donors</CardDescription>
            </CardContent>
          </Card>

          {/* Pending Review */}
          <Card className="border-2 border-yellow-200 dark:border-yellow-800 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Clock className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                <Badge variant="secondary" className="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300">
                  Pending
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle 
                className="text-4xl mb-2 text-yellow-600 dark:text-yellow-400"
                style={{ fontFamily: 'var(--font-headings)' }}
              >
                {pendingCount}
              </CardTitle>
              <CardDescription>Awaiting Verification</CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Payment Methods */}
          <div className="lg:col-span-2 space-y-8">
            {/* Payment Methods */}
            <Card className="border-2 shadow-xl">
              <CardHeader>
                <CardTitle 
                  className="flex items-center gap-3"
                  style={{ 
                    fontFamily: 'var(--font-headings)',
                    fontSize: '1.5rem',
                    color: '#f6421f'
                  }}
                >
                  <Phone className="w-6 h-6" />
                  Choose Payment Method
                </CardTitle>
                <CardDescription>
                  Select your preferred e-wallet to make a donation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* GCash Button */}
                <button
                  onClick={() => setShowPaymentModal('gcash')}
                  className="w-full group relative overflow-hidden rounded-2xl border-2 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20" />
                  <div className="relative p-6 flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg group-hover:rotate-[360deg] transition-all duration-500">
                      <Phone className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-xl mb-1" style={{ fontWeight: '700', color: '#3b82f6' }}>
                        GCash
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Click to view QR code and account details
                      </p>
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                        <span className="text-xs text-blue-700 dark:text-blue-300" style={{ fontWeight: '600' }}>
                          Account: 09XX XXX XXXX
                        </span>
                      </div>
                    </div>
                    <div className="text-blue-500 group-hover:translate-x-2 transition-transform">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Maya Button */}
                <button
                  onClick={() => setShowPaymentModal('maya')}
                  className="w-full group relative overflow-hidden rounded-2xl border-2 border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600 transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 dark:from-green-500/20 dark:to-emerald-500/20" />
                  <div className="relative p-6 flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg group-hover:rotate-[360deg] transition-all duration-500">
                      <Phone className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-xl mb-1" style={{ fontWeight: '700', color: '#10b981' }}>
                        Maya
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Click to view QR code and account details
                      </p>
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/50 rounded-full">
                        <span className="text-xs text-green-700 dark:text-green-300" style={{ fontWeight: '600' }}>
                          Account: 09XX XXX XXXX
                        </span>
                      </div>
                    </div>
                    <div className="text-green-500 group-hover:translate-x-2 transition-transform">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
              </CardContent>
            </Card>

            {/* Receipt Submission Form */}
            <Card className="border-2 shadow-xl">
              <CardHeader>
                <CardTitle 
                  style={{ 
                    fontFamily: 'var(--font-headings)',
                    fontSize: '1.5rem',
                    color: '#f6421f'
                  }}
                >
                  Submit Your Donation
                </CardTitle>
                <CardDescription>
                  After making payment, upload your receipt and details below
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Donor Name */}
                <div className="space-y-2">
                  <Label htmlFor="donorName">
                    Your Name <span className="text-gray-400">(Optional)</span>
                  </Label>
                  <Input
                    id="donorName"
                    type="text"
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    placeholder="Leave blank to donate anonymously"
                    className="h-12 text-base"
                  />
                </div>

                {/* Donation Amount */}
                <div className="space-y-2">
                  <Label htmlFor="donationAmount">
                    Donation Amount <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-500 dark:text-gray-400" style={{ fontWeight: '700' }}>
                      ₱
                    </span>
                    <Input
                      id="donationAmount"
                      type="number"
                      value={donationAmount}
                      onChange={(e) => setDonationAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      required
                      className="h-12 pl-10 text-base"
                    />
                  </div>
                </div>

                <Separator />

                {/* Receipt Upload */}
                <div className="space-y-2">
                  <Label htmlFor="receiptUpload">
                    Payment Receipt <span className="text-red-500">*</span>
                  </Label>
                  
                  {!receiptImage ? (
                    <label
                      htmlFor="receiptUpload"
                      className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl cursor-pointer hover:border-[#f6421f] dark:hover:border-[#f6421f] transition-colors bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 group"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-16 h-16 text-gray-400 group-hover:text-[#f6421f] transition-colors mb-4" />
                        <p className="mb-2 text-base text-gray-700 dark:text-gray-300" style={{ fontWeight: '600' }}>
                          <span className="text-[#f6421f]">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          PNG or JPG (Max 10MB)
                        </p>
                      </div>
                      <input
                        id="receiptUpload"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={handleReceiptUpload}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="relative">
                      <img
                        src={receiptImage}
                        alt="Receipt preview"
                        className="w-full h-80 object-contain bg-gray-100 dark:bg-gray-900 rounded-2xl border-2 border-green-500 p-4"
                      />
                      <Button
                        onClick={() => setReceiptImage(null)}
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 rounded-full shadow-lg"
                      >
                        <X className="w-5 h-5" />
                      </Button>
                      <div className="mt-3 flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-4 py-2">
                        <Check className="w-5 h-5" />
                        <span style={{ fontWeight: '600' }}>Receipt uploaded successfully</span>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Submit Button */}
                <Button
                  onClick={handleDonationSubmit}
                  size="lg"
                  className="w-full h-14 text-lg shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    fontFamily: 'var(--font-headings)',
                    fontWeight: '700'
                  }}
                >
                  <Heart className="w-5 h-5 mr-2" />
                  Submit Donation
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Donations List */}
          <div className="space-y-6">
            <Card className="border-2 shadow-xl sticky top-24">
              <CardHeader>
                <CardTitle 
                  className="flex items-center gap-2"
                  style={{ 
                    fontFamily: 'var(--font-headings)',
                    fontSize: '1.25rem',
                    color: '#f6421f'
                  }}
                >
                  {isAdmin ? '🔒 Admin Dashboard' : 'Recent Donations'}
                </CardTitle>
                <CardDescription>
                  {isAdmin ? 'Manage all donations' : 'Recent verified supporters'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
                {isAdmin ? (
                  // Admin View
                  donations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No donations yet
                    </div>
                  ) : (
                    donations.map((donation) => (
                      <Card 
                        key={donation.id}
                        className="border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10"
                      >
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm truncate" style={{ fontWeight: '700' }}>
                                  {donation.name}
                                </p>
                                <Badge 
                                  variant={
                                    donation.status === 'verified' ? 'default' : 
                                    donation.status === 'pending' ? 'secondary' : 
                                    'destructive'
                                  }
                                  className="shrink-0"
                                >
                                  {donation.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                ₱{donation.amount.toLocaleString()} • {donation.date}
                              </p>
                            </div>
                          </div>
                          
                          {donation.receiptUrl && (
                            <img 
                              src={donation.receiptUrl} 
                              alt="Receipt" 
                              className="h-24 w-full object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => window.open(donation.receiptUrl, '_blank')}
                            />
                          )}
                          
                          <div className="flex gap-2">
                            {donation.status === 'pending' && (
                              <>
                                <Button
                                  onClick={() => handleVerifyDonation(donation.id)}
                                  size="sm"
                                  className="flex-1 bg-green-500 hover:bg-green-600"
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Verify
                                </Button>
                                <Button
                                  onClick={() => handleRejectDonation(donation.id)}
                                  size="sm"
                                  variant="destructive"
                                  className="flex-1"
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Reject
                                </Button>
                              </>
                            )}
                            <Button
                              onClick={() => handleDeleteDonation(donation.id)}
                              size="sm"
                              variant="outline"
                              className="shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )
                ) : (
                  // Public View
                  donations
                    .filter(d => d.status === 'verified')
                    .slice(0, 10)
                    .map((donation) => (
                      <div 
                        key={donation.id}
                        className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-800"
                      >
                        <p className="text-sm" style={{ fontWeight: '600' }}>
                          {donation.name}
                        </p>
                        <p className="text-sm text-purple-600 dark:text-purple-400" style={{ fontWeight: '700' }}>
                          ₱{donation.amount.toLocaleString()}
                        </p>
                      </div>
                    ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Payment Method Modal */}
      {showPaymentModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-100 p-4 animate-[fadeIn_0.2s_ease] overflow-y-auto"
          onClick={() => setShowPaymentModal(null)}
        >
          <Card 
            className="w-full max-w-md max-h-[90vh] overflow-y-auto animate-[scaleIn_0.3s_ease] border-2 shadow-2xl my-8 z-110"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="relative sticky top-0 bg-white dark:bg-gray-800 z-10 border-b">
              <Button
                onClick={() => setShowPaymentModal(null)}
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 rounded-full hover:rotate-90 transition-transform duration-300"
              >
                <X className="w-5 h-5" />
              </Button>
              
              <div className="text-center pt-4">
                <div 
                  className={`w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                    showPaymentModal === 'gcash' 
                      ? 'bg-gradient-to-br from-blue-500 to-cyan-500' 
                      : 'bg-gradient-to-br from-green-500 to-emerald-500'
                  }`}
                >
                  <Phone className="w-10 h-10 text-white" />
                </div>
                <CardTitle 
                  className="text-2xl"
                  style={{ 
                    fontFamily: 'var(--font-headings)',
                    color: showPaymentModal === 'gcash' ? '#3b82f6' : '#10b981'
                  }}
                >
                  {showPaymentModal === 'gcash' ? 'GCash' : 'Maya'} Payment
                </CardTitle>
                <CardDescription className="mt-2">
                  Scan QR code or use account details
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pb-6">
              {/* QR Code */}
              <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl p-8 border-2 border-gray-200 dark:border-gray-700">
                <div className="w-full aspect-square max-w-xs mx-auto bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center border-2 border-gray-300 dark:border-gray-600 overflow-hidden">
                  <ImageWithFallback
                    src="https://images.unsplash.com/photo-1587560699334-bea93391dcef?w=400&h=400&fit=crop"
                    alt={`${showPaymentModal} QR Code`}
                    className="w-full h-full object-contain p-4"
                  />
                </div>
                <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-3 italic">
                  {/* TODO: Replace with QR from Google Drive */}
                </p>
              </div>

              {/* Account Details */}
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Account Name</Label>
                  <p className="text-sm mt-1" style={{ fontWeight: '700' }}>
                    Youth Service Philippines - Tagum Chapter
                  </p>
                </div>

                <div>
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Account Number</Label>
                  <div className="flex items-center justify-between gap-2 mt-1 p-3 bg-gray-100 dark:bg-gray-900 rounded-lg">
                    <p className="font-mono text-sm" style={{ fontWeight: '700' }}>
                      09XX XXX XXXX
                    </p>
                    <Button
                      onClick={() => copyToClipboard('09XXXXXXXXX', showPaymentModal === 'gcash' ? 'GCash' : 'Maya')}
                      variant="ghost"
                      size="sm"
                    >
                      {copiedAccount === (showPaymentModal === 'gcash' ? 'GCash' : 'Maya') ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="text-sm" style={{ fontWeight: '700' }}>
                      Instructions:
                    </p>
                    <ol className="text-xs text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
                      <li>Send your donation to the account above</li>
                      <li>Take a screenshot of the receipt</li>
                      <li>Return to this page and upload it</li>
                      <li>Wait for admin verification</li>
                    </ol>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setShowPaymentModal(null)}
                size="lg"
                className="w-full"
                style={{
                  background: showPaymentModal === 'gcash' 
                    ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                }}
              >
                Got it, I'm ready to donate
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}