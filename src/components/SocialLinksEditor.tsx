/**
 * =============================================================================
 * SOCIAL LINKS EDITOR COMPONENT
 * =============================================================================
 * 
 * Dynamic social links management:
 * - Add/remove unlimited social links
 * - Platform dropdown (Facebook, Twitter, Instagram, etc.)
 * - URL input for each link
 * - Icon display
 * - Fully editable
 * - Used in Homepage, Developer Modal, Founder Modal
 * 
 * =============================================================================
 */

import { useState } from 'react';
import { Plus, Trash2, Facebook, Twitter, Instagram, Linkedin, Github, Youtube, Music, Globe, ExternalLink } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import CustomDropdown from './CustomDropdown';

export interface SocialLink {
  id: string;
  platform: string;
  url: string;
  label?: string;
}

export const SOCIAL_PLATFORMS = [
  { value: 'facebook', label: 'Facebook', icon: Facebook },
  { value: 'twitter', label: 'Twitter (X)', icon: Twitter },
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { value: 'github', label: 'GitHub', icon: Github },
  { value: 'youtube', label: 'YouTube', icon: Youtube },
  { value: 'tiktok', label: 'TikTok', icon: Music },
  { value: 'website', label: 'Website', icon: Globe },
  { value: 'other', label: 'Other', icon: ExternalLink },
];

export const getPlatformIcon = (platform: string) => {
  const found = SOCIAL_PLATFORMS.find(p => p.value === platform);
  return found ? found.icon : ExternalLink;
};

interface SocialLinksEditorProps {
  links: SocialLink[];
  onChange: (links: SocialLink[]) => void;
  isDark: boolean;
  isEditing?: boolean;
}

export default function SocialLinksEditor({ links, onChange, isDark, isEditing = false }: SocialLinksEditorProps) {
  const addLink = () => {
    const newLink: SocialLink = {
      id: Date.now().toString(),
      platform: 'facebook',
      url: '',
      label: ''
    };
    onChange([...links, newLink]);
    toast.success('Social link added', {
      description: 'Fill in the details below'
    });
  };

  const removeLink = (id: string) => {
    onChange(links.filter(link => link.id !== id));
    toast.success('Social link removed');
  };

  const updateLink = (id: string, field: keyof SocialLink, value: string) => {
    onChange(links.map(link => 
      link.id === id ? { ...link, [field]: value } : link
    ));
  };

  const Icon = (platform: string) => getPlatformIcon(platform);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 
            className="text-lg"
            style={{ 
              fontFamily: 'var(--font-headings)', 
              fontWeight: 'var(--font-weight-bold)',
              color: '#ee8724'
            }}
          >
            Social Links
          </h3>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '500' }}>
            Add your social media profiles and websites
          </p>
        </div>
        {isEditing && (
          <button
            onClick={addLink}
            className="px-4 py-2 rounded-lg transition-all duration-300 hover:scale-105 flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
              color: 'white',
              fontWeight: '700',
            }}
          >
            <Plus className="w-4 h-4" />
            Add Link
          </button>
        )}
      </div>

      {/* Links List */}
      {links.length > 0 ? (
        <div className="space-y-3">
          {links.map((link) => {
            const IconComponent = Icon(link.platform);
            return (
              <div
                key={link.id}
                className="p-4 rounded-xl border-2 transition-all"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                {isEditing ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 grid md:grid-cols-2 gap-3">
                        {/* Platform Dropdown */}
                        <div>
                          <label className={`block text-xs mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '600' }}>
                            Platform
                          </label>
                          <CustomDropdown
                            value={link.platform}
                            onChange={(value) => updateLink(link.id, 'platform', value)}
                            options={SOCIAL_PLATFORMS.map(p => ({ value: p.value, label: p.label }))}
                            isDark={isDark}
                            size="sm"
                          />
                        </div>

                        {/* Label (optional) */}
                        <div>
                          <label className={`block text-xs mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '600' }}>
                            Label (Optional)
                          </label>
                          <input
                            type="text"
                            value={link.label || ''}
                            onChange={(e) => updateLink(link.id, 'label', e.target.value)}
                            placeholder="e.g., My Profile"
                            className="w-full px-3 py-2 rounded-lg border-2 transition-all outline-none"
                            style={{
                              background: isDark ? 'rgba(0, 0, 0, 0.2)' : 'white',
                              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                              color: isDark ? 'white' : 'black',
                            }}
                          />
                        </div>
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={() => removeLink(link.id)}
                        className="p-2 rounded-lg transition-all duration-300 hover:scale-110 flex-shrink-0"
                        style={{
                          background: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                        }}
                        aria-label="Remove link"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* URL Input */}
                    <div>
                      <label className={`block text-xs mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '600' }}>
                        URL
                      </label>
                      <input
                        type="url"
                        value={link.url}
                        onChange={(e) => updateLink(link.id, 'url', e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-2 rounded-lg border-2 transition-all outline-none"
                        style={{
                          background: isDark ? 'rgba(0, 0, 0, 0.2)' : 'white',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          color: isDark ? 'white' : 'black',
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  // Display Mode
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 transition-all duration-300 hover:scale-105"
                  >
                    <div
                      className="p-2 rounded-lg"
                      style={{
                        background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
                        color: 'white',
                      }}
                    >
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-semibold truncate"
                        style={{
                          color: isDark ? 'white' : '#1e293b',
                        }}
                      >
                        {link.label || SOCIAL_PLATFORMS.find(p => p.value === link.platform)?.label || link.platform}
                      </p>
                      <p
                        className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                        style={{ fontWeight: '500' }}
                      >
                        {link.url}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="p-8 rounded-xl text-center border-2 border-dashed"
          style={{
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <Globe className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'} style={{ fontWeight: '500' }}>
            {isEditing ? 'No social links yet. Click "Add Link" to get started.' : 'No social links available'}
          </p>
        </div>
      )}
    </div>
  );
}
